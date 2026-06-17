import {
  Prisma,
  Invoice as PrismaInvoice,
  InvoiceStatus as PrismaInvoiceStatus,
  PaymentCollectionMethod,
  TaxBehavior as PrismaTaxBehavior,
} from "@prisma/client";
import { Invoice, InvoiceItem } from "@yosemite-crew/types";
import {
  calculateInvoicePricing,
  type InvoiceDiscountInput as PricingInvoiceDiscountInput,
} from "./finance/pricing";
import {
  DEFAULT_TAX_BEHAVIOR,
  getInvoiceTaxProviderAdapter,
} from "./finance/tax";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { AuditTrailService } from "./audit-trail.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import type { AuditEventType } from "src/models/audit-trail";
import { StripeService } from "./stripe.service";
import { resolvePaymentCollectionMethod } from "src/utils/payment";
import { assertSafeString } from "src/utils/sanitize";

export class InvoiceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "InvoiceServiceError";
  }
}

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL_ADDRESS ?? "support@yosemitecrew.com";

type AppointmentLink = {
  patientId?: string;
  parentId?: string;
};

type InvoiceMetadata = Record<string, string | number | boolean>;

type DraftInvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

type CreateInvoiceInput = {
  appointmentId: string;
  parentId: string;
  organisationId: string;
  patientId: string;
  items: DraftInvoiceItemInput[];
  notes?: string;
  invoiceDiscount?: PricingInvoiceDiscountInput;
  paymentCollectionMethod:
    | "PAYMENT_INTENT"
    | "PAYMENT_LINK"
    | "PAYMENT_AT_CLINIC";
};

const normalizeInvoiceMetadata = (
  value: Prisma.JsonValue | null | undefined,
): InvoiceMetadata | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(
    value as Record<string, unknown>,
  ).reduce<InvoiceMetadata>((acc, [key, raw]) => {
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      acc[key] = raw;
    }
    return acc;
  }, {});
};

const toInvoiceRecord = (row: PrismaInvoice): Invoice => {
  const items = Array.isArray(row.items)
    ? (row.items as InvoiceItem[]).map((item) => ({
        ...item,
        description: item.description ?? undefined,
      }))
    : [];

  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    patientId: row.patientId ?? undefined,
    organisationId: row.organisationId ?? undefined,
    appointmentId: row.appointmentId ?? undefined,
    items,
    subtotal: row.subtotal,
    totalAmount: row.totalAmount,
    taxPercent: row.taxPercent,
    currency: row.currency,
    taxTotal: row.taxTotal,
    discountTotal: row.discountTotal,
    stripePaymentIntentId: row.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: row.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: row.stripeInvoiceId ?? undefined,
    stripeCustomerId: row.stripeCustomerId ?? undefined,
    stripeChargeId: row.stripeChargeId ?? undefined,
    stripeReceiptUrl: row.stripeReceiptUrl ?? undefined,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: row.stripeCheckoutUrl ?? undefined,
    paymentCollectionMethod: row.paymentCollectionMethod,
    status: row.status as Invoice["status"],
    metadata: normalizeInvoiceMetadata(row.metadata),
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const buildInvoiceLineSnapshots = (items: DraftInvoiceItemInput[]) =>
  items.map((item) => ({
    ...item,
    name: item.description,
    total:
      item.quantity * item.unitPrice -
      (item.discountPercent
        ? (item.discountPercent / 100) * item.unitPrice * item.quantity
        : 0),
  }));

const toTaxLineItems = (items: DraftInvoiceItemInput[]) =>
  items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent: item.discountPercent,
  }));

const resolveInvoiceTotals = (
  items: DraftInvoiceItemInput[],
  taxPercent = 0,
  invoiceDiscount?: PricingInvoiceDiscountInput,
  taxBehavior: PrismaTaxBehavior = DEFAULT_TAX_BEHAVIOR,
  provider?: string | null,
  mode: "preview" | "finalize" = "preview",
) => {
  const pricing = calculateInvoicePricing({
    lines: items.map((item) => ({
      quantity: item.quantity,
      unitAmount: item.unitPrice,
      discountType: item.discountPercent != null ? "PERCENTAGE" : undefined,
      discountValue: item.discountPercent ?? undefined,
      taxBehavior,
    })),
    taxRatePercent: taxPercent,
    invoiceDiscount,
  });
  const adapter = getInvoiceTaxProviderAdapter(provider);

  return {
    subtotal: pricing.subtotal,
    discountTotal: pricing.lineDiscountTotal,
    invoiceDiscountTotal: pricing.invoiceDiscountTotal,
    taxTotal: pricing.taxTotal,
    taxPercent: taxPercent ?? 0,
    totalAmount: pricing.totalAmount,
    taxSnapshot:
      mode === "finalize"
        ? adapter.finalize({
            provider: adapter.provider,
            taxBehavior,
            taxRatePercent: taxPercent,
            invoiceDiscount,
            pricing,
            lineItems: toTaxLineItems(items),
          })
        : adapter.preview({
            provider: adapter.provider,
            taxBehavior,
            taxRatePercent: taxPercent,
            invoiceDiscount,
            pricing,
            lineItems: toTaxLineItems(items),
          }),
  };
};

const getAppointmentLinks = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}): AppointmentLink => {
  const value = appointment.patient ?? appointment.companion ?? null;
  if (!value || typeof value !== "object") {
    return {};
  }

  const companion = value as Record<string, unknown>;
  const patientId = typeof companion.id === "string" ? companion.id : undefined;
  const parent = companion.parent as Record<string, unknown> | undefined;
  const parentId =
    parent && typeof parent.id === "string" ? parent.id : undefined;
  return { patientId, parentId };
};

const getAppointmentPatientIdOrThrow = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => {
  const { patientId } = getAppointmentLinks(appointment);
  if (!patientId) {
    throw new InvoiceServiceError("Appointment patient links are missing", 500);
  }
  return patientId;
};

const getAppointmentParentIdOrThrow = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => {
  const { parentId } = getAppointmentLinks(appointment);
  if (!parentId) {
    throw new InvoiceServiceError(
      "Appointment missing parent or patient links",
      500,
    );
  }
  return parentId;
};

const assertAppointmentInOrganisation = async (
  appointmentId: string,
  organisationId: string,
) => {
  assertSafeString(organisationId, "organisationId");
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organisationId },
    select: { id: true },
  });

  if (!appointment) {
    throw new InvoiceServiceError(
      "Appointment not found for organisation",
      404,
    );
  }
};

const resolveAuditTargetsForInvoiceRow = async (row: {
  organisationId: string | null;
  patientId: string | null;
  appointmentId: string | null;
}) => {
  if (row.organisationId && row.patientId) {
    return { organisationId: row.organisationId, patientId: row.patientId };
  }

  if (row.appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: row.appointmentId },
      select: { organisationId: true, patient: true },
    });
    if (appointment?.organisationId) {
      const { patientId } = getAppointmentLinks(appointment);
      if (patientId) {
        return {
          organisationId: appointment.organisationId,
          patientId,
        };
      }
    }
  }

  return {
    organisationId: row.organisationId ?? undefined,
    patientId: row.patientId ?? undefined,
  };
};

const recordInvoiceAuditEvent = async (
  targets: { organisationId?: string | null; patientId?: string | null },
  payload: {
    eventType: AuditEventType;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) => {
  if (!targets.organisationId || !targets.patientId) {
    return;
  }

  await AuditTrailService.recordSafely({
    organisationId: targets.organisationId,
    patientId: targets.patientId,
    eventType: payload.eventType,
    actorType: "SYSTEM",
    entityType: "INVOICE",
    entityId: payload.entityId,
    metadata: payload.metadata,
  });
};

const recordInvoiceAuditForRow = async (
  row: {
    organisationId: string | null;
    patientId: string | null;
    appointmentId: string | null;
  },
  eventType: AuditEventType,
  entityId: string,
  metadata: Record<string, unknown>,
) => {
  const targets = await resolveAuditTargetsForInvoiceRow(row);
  await recordInvoiceAuditEvent(targets, { eventType, entityId, metadata });
};

const mapCatalogSelectionToDraftItems = (selection: {
  billingItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    defaultDiscountPercent?: number | null;
  }>;
}): DraftInvoiceItemInput[] =>
  selection.billingItems.map((item) => ({
    description: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent: item.defaultDiscountPercent ?? undefined,
  }));

const resolveCatalogSelectionSafe = async (
  selectionId: string,
  organisationId: string,
) => {
  try {
    return await CatalogService.resolveSelection(selectionId, organisationId);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

const resolveOrganisationCurrency = async (organisationId: string) => {
  const billing = await prisma.organizationBilling.findUnique({
    where: { orgId: organisationId },
    select: { currency: true },
  });
  return billing?.currency ?? "usd";
};

const cancelUnpaidInvoice = async (invoice: PrismaInvoice, reason: string) =>
  prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "CANCELLED",
      metadata: {
        ...(normalizeInvoiceMetadata(invoice.metadata) ?? {}),
        cancellationReason: reason,
      } as unknown as Prisma.InputJsonValue,
    },
  });

const refundPaidInvoice = async (invoice: PrismaInvoice, reason: string) => {
  if (!invoice.stripePaymentIntentId) {
    throw new InvoiceServiceError(
      "Cannot refund: missing Stripe paymentIntentId",
      500,
    );
  }

  const refund = await StripeService.refundPaymentIntent(
    invoice.stripePaymentIntentId,
  );

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "REFUNDED",
      metadata: {
        ...(normalizeInvoiceMetadata(invoice.metadata) ?? {}),
        cancellationReason: reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
        refundDate: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { updated, refund };
};

const normalizeCreateInput = (
  input: CreateInvoiceInput,
  patientId: string,
  parentId: string,
  currency: string,
  taxBehavior: PrismaTaxBehavior = DEFAULT_TAX_BEHAVIOR,
) => {
  const items = buildInvoiceLineSnapshots(input.items);
  const totals = resolveInvoiceTotals(
    input.items,
    0,
    input.invoiceDiscount,
    taxBehavior,
  );

  return {
    items,
    totals,
    data: {
      appointmentId: input.appointmentId,
      parentId,
      organisationId: input.organisationId,
      patientId,
      currency,
      status: "AWAITING_PAYMENT" as const,
      paymentCollectionMethod: input.paymentCollectionMethod,
      taxProvider: totals.taxSnapshot.provider,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      invoiceDiscountTotal: totals.invoiceDiscountTotal,
      invoiceDiscountType: input.invoiceDiscount?.type ?? null,
      invoiceDiscountValue: input.invoiceDiscount?.value ?? null,
      taxTotal: totals.taxTotal,
      taxPercent: totals.taxPercent,
      totalAmount: totals.totalAmount,
      metadata: {
        ...(input.notes ? { notes: input.notes } : {}),
      } as unknown as Prisma.InputJsonValue,
    },
    taxSnapshot: totals.taxSnapshot,
  };
};

export const InvoiceService = {
  async createDraftForAppointment(
    input: CreateInvoiceInput,
    session?: unknown,
  ) {
    void session;
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, organisationId: true, patient: true },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const patientId = getAppointmentPatientIdOrThrow(appointment);
    const parentId = getAppointmentParentIdOrThrow(appointment);
    if (input.patientId && input.patientId !== patientId) {
      throw new InvoiceServiceError(
        "Appointment patient links are missing",
        500,
      );
    }

    const currency = await resolveOrganisationCurrency(input.organisationId);
    const { data, taxSnapshot } = normalizeCreateInput(
      input,
      patientId,
      parentId,
      currency,
    );
    const createdInvoice = await prisma.invoice.create({
      data: {
        ...data,
        taxSnapshot: {
          create: taxSnapshot,
        },
      },
    });

    const targets = await resolveAuditTargetsForInvoiceRow(createdInvoice);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_CREATED",
      entityId: createdInvoice.id,
      metadata: {
        appointmentId: input.appointmentId,
        status: createdInvoice.status,
        totalAmount: createdInvoice.totalAmount,
        currency: createdInvoice.currency,
      },
    });

    await NotificationService.sendToUser(
      parentId,
      NotificationTemplates.Payment.PAYMENT_PENDING(
        createdInvoice.totalAmount,
        createdInvoice.currency,
      ),
    );

    return toInvoiceRecord(createdInvoice);
  },

  async getOrCreateDraftForAppointment(input: CreateInvoiceInput) {
    const existing = await this.findOpenInvoiceForAppointment(
      input.appointmentId,
    );
    if (existing) {
      return existing;
    }
    return this.createDraftForAppointment(input);
  },

  async createExtraInvoiceForAppointment(input: {
    appointmentId: string;
    items: InvoiceItem[];
    invoiceDiscount?: PricingInvoiceDiscountInput;
    metadata?: Record<string, string | number | boolean | undefined>;
  }) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, organisationId: true, patient: true },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const currency = await resolveOrganisationCurrency(
      appointment.organisationId,
    );
    const { patientId, parentId } = getAppointmentLinks(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or patient links",
        500,
      );
    }

    const items = input.items.map((item) => ({
      description: item.description ?? item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent ?? undefined,
    }));
    const totals = resolveInvoiceTotals(items, 0, input.invoiceDiscount);

    const invoice = await prisma.invoice.create({
      data: {
        appointmentId: appointment.id,
        parentId,
        patientId,
        organisationId: appointment.organisationId,
        currency,
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        taxProvider: totals.taxSnapshot.provider,
        items: buildInvoiceLineSnapshots(
          items,
        ) as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        invoiceDiscountTotal: totals.invoiceDiscountTotal,
        invoiceDiscountType: input.invoiceDiscount?.type ?? null,
        invoiceDiscountValue: input.invoiceDiscount?.value ?? null,
        taxTotal: totals.taxTotal,
        taxPercent: totals.taxPercent,
        totalAmount: totals.totalAmount,
        metadata: {
          ...(input.metadata ?? {}),
          source: "EXTRA_CHARGES",
        } as unknown as Prisma.InputJsonValue,
        taxSnapshot: {
          create: totals.taxSnapshot,
        },
      },
    });

    const targets = await resolveAuditTargetsForInvoiceRow(invoice);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_CREATED",
      entityId: invoice.id,
      metadata: {
        appointmentId: appointment.id,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
    });

    await NotificationService.sendToUser(
      parentId,
      NotificationTemplates.Payment.PAYMENT_PENDING(
        invoice.totalAmount,
        invoice.currency,
      ),
    );

    return toInvoiceRecord(invoice);
  },

  async attachStripeDetails(invoiceId: string, updates: Partial<Invoice>) {
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentIntentId: updates.stripePaymentIntentId ?? undefined,
        stripePaymentLinkId: updates.stripePaymentLinkId ?? undefined,
        stripeInvoiceId: updates.stripeInvoiceId ?? undefined,
        stripeCustomerId: updates.stripeCustomerId ?? undefined,
        stripeChargeId: updates.stripeChargeId ?? undefined,
        stripeReceiptUrl: updates.stripeReceiptUrl ?? undefined,
        stripeCheckoutSessionId: updates.stripeCheckoutSessionId ?? undefined,
        stripeCheckoutUrl: updates.stripeCheckoutUrl ?? undefined,
        status: updates.status as PrismaInvoiceStatus | undefined,
        paymentCollectionMethod: updates.paymentCollectionMethod as
          | PaymentCollectionMethod
          | undefined,
        paidAt: updates.paidAt ?? undefined,
        metadata: updates.metadata as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  async markInvoicePaid(params: {
    invoiceId: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    stripeReceiptUrl?: string;
  }) {
    const existing = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });
    if (!existing || existing.status === "PAID") {
      return null;
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentIntentId: params.stripePaymentIntentId ?? undefined,
        stripeChargeId: params.stripeChargeId ?? undefined,
        stripeReceiptUrl: params.stripeReceiptUrl ?? undefined,
      },
    });

    await recordInvoiceAuditForRow(invoice, "INVOICE_PAID", invoice.id, {
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
    });

    return invoice;
  },

  async markInvoicePaidManually(invoiceId: string, organisationId: string) {
    const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!doc || doc.organisationId !== organisationId) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (doc.paymentCollectionMethod !== "PAYMENT_AT_CLINIC") {
      throw new InvoiceServiceError(
        "Invoice is not marked for in-clinic payment.",
        409,
      );
    }

    if (["CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be marked paid.", 409);
    }

    const updated = await this.markInvoicePaid({ invoiceId: doc.id });
    return updated ? toInvoiceRecord(updated) : null;
  },

  async updatePaymentCollectionMethod(
    invoiceId: string,
    organisationId: string,
    paymentCollectionMethod: string,
  ) {
    const resolvedPaymentCollectionMethod = resolvePaymentCollectionMethod(
      paymentCollectionMethod,
      (message) => new InvoiceServiceError(message, 400),
    ) as PaymentCollectionMethod;

    const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!doc || doc.organisationId !== organisationId) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (["PAID", "CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be updated.", 409);
    }

    if (doc.paymentCollectionMethod === resolvedPaymentCollectionMethod) {
      return toInvoiceRecord(doc);
    }

    const updated = await prisma.invoice.update({
      where: { id: doc.id },
      data: { paymentCollectionMethod: resolvedPaymentCollectionMethod },
    });

    return updated;
  },

  async markFailed(invoiceId: string) {
    const doc = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "FAILED" },
    });

    await recordInvoiceAuditForRow(doc, "INVOICE_FAILED", doc.id, {
      status: doc.status,
      totalAmount: doc.totalAmount,
      currency: doc.currency,
    });

    return doc;
  },

  async markRefunded(invoiceId: string): Promise<Invoice> {
    const doc = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "REFUNDED" },
    });

    await recordInvoiceAuditForRow(doc, "INVOICE_REFUNDED", doc.id, {
      status: doc.status,
      totalAmount: doc.totalAmount,
      currency: doc.currency,
    });

    return toInvoiceRecord(doc);
  },

  async updateStatus(invoiceId: string, status: PrismaInvoiceStatus) {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });

    await recordInvoiceAuditForRow(invoice, "INVOICE_UPDATED", invoice.id, {
      status: invoice.status,
    });

    return invoice;
  },

  async getByAppointmentId(appId: string, organisationId?: string) {
    const docs = await prisma.invoice.findMany({
      where: {
        appointmentId: appId,
        ...(organisationId ? { organisationId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return docs.map((d) => toInvoiceRecord(d));
  },

  async bootstrapForAppointment(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        organisationId: true,
        patient: true,
        appointmentType: true,
        productItemId: true,
        concern: true,
      },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const openInvoice = await prisma.invoice.findFirst({
      where: {
        appointmentId,
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (openInvoice) {
      return openInvoice;
    }

    const latestInvoice = await prisma.invoice.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
    });
    if (latestInvoice && ["PAID", "REFUNDED"].includes(latestInvoice.status)) {
      return latestInvoice;
    }

    const serviceId =
      typeof appointment.appointmentType === "object" &&
      appointment.appointmentType &&
      typeof (appointment.appointmentType as Record<string, unknown>).id ===
        "string"
        ? ((appointment.appointmentType as Record<string, unknown>)
            .id as string)
        : undefined;
    const productItemId = appointment.productItemId ?? serviceId;
    if (!serviceId && !productItemId) {
      throw new InvoiceServiceError("Service or product not found", 404);
    }

    const { patientId, parentId } = getAppointmentLinks(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or companion",
        400,
      );
    }

    const catalogSelection = productItemId
      ? await resolveCatalogSelectionSafe(
          productItemId,
          appointment.organisationId,
        )
      : null;

    let items: DraftInvoiceItemInput[];
    if (catalogSelection) {
      items = mapCatalogSelectionToDraftItems(catalogSelection);
    } else {
      const service = serviceId
        ? await prisma.service.findUnique({ where: { id: serviceId } })
        : null;
      if (!service) {
        throw new InvoiceServiceError("Service not found", 404);
      }

      const description =
        typeof appointment.appointmentType === "object" &&
        appointment.appointmentType
          ? ((appointment.appointmentType as Record<string, unknown>).name as
              | string
              | undefined)
          : undefined;

      items = [
        {
          description: description ?? service.name ?? "Consultation",
          quantity: 1,
          unitPrice: service.cost,
          discountPercent: service.maxDiscount ?? undefined,
        },
      ];
    }

    return this.createDraftForAppointment({
      appointmentId,
      parentId,
      patientId,
      organisationId: appointment.organisationId,
      items,
      notes: appointment.concern ?? undefined,
      paymentCollectionMethod: "PAYMENT_LINK",
    });
  },

  async getById(id: string) {
    const doc = await prisma.invoice.findUnique({ where: { id } });
    if (!doc) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    const org = doc.organisationId
      ? await prisma.organization.findUnique({
          where: { id: doc.organisationId },
          include: { address: true },
        })
      : null;

    return {
      organistion: {
        name: org?.name ?? "",
        placesId: org?.googlePlacesId ?? "",
        address: org?.address ?? "",
        image: org?.imageUrl ?? "",
      },
      invoice: toInvoiceRecord(doc),
    };
  },

  async listForOrganisation(organisationId: string) {
    const docs = await prisma.invoice.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async listForParent(parentId: string) {
    const docs = await prisma.invoice.findMany({
      where: { parentId },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async listForCompanion(patientId: string) {
    const docs = await prisma.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async addItemsToInvoice(invoiceId: string, items: InvoiceItem[]) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { taxSnapshot: true },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (invoice.status === "PAID") {
      throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
    }

    if (invoice.finalizedAt) {
      throw new InvoiceServiceError("Cannot modify a finalized invoice", 409);
    }

    const existingItems = Array.isArray(invoice.items)
      ? (invoice.items as unknown as DraftInvoiceItemInput[])
      : [];
    const newItems = items.map((item) => ({
      description: item.description ?? item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent ?? undefined,
    }));
    const mergedItems = [...existingItems, ...newItems];
    const totals = resolveInvoiceTotals(
      mergedItems,
      invoice.taxPercent,
      invoice.invoiceDiscountType && invoice.invoiceDiscountValue != null
        ? {
            type: invoice.invoiceDiscountType as PricingInvoiceDiscountInput["type"],
            value: invoice.invoiceDiscountValue,
          }
        : undefined,
      invoice.taxSnapshot?.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
    );

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        taxProvider: totals.taxSnapshot.provider,
        items: buildInvoiceLineSnapshots(
          mergedItems,
        ) as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        invoiceDiscountTotal: totals.invoiceDiscountTotal,
        taxTotal: totals.taxTotal,
        taxPercent: totals.taxPercent,
        totalAmount: totals.totalAmount,
        stripeCheckoutSessionId:
          invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
          invoice.stripeCheckoutSessionId
            ? null
            : invoice.stripeCheckoutSessionId,
        stripeCheckoutUrl:
          invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
          invoice.stripeCheckoutSessionId
            ? null
            : invoice.stripeCheckoutUrl,
        taxSnapshot: {
          upsert: {
            create: totals.taxSnapshot,
            update: totals.taxSnapshot,
          },
        },
      },
    });

    const targets = await resolveAuditTargetsForInvoiceRow(updated);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_UPDATED",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        totalAmount: updated.totalAmount,
        currency: updated.currency,
        itemsAdded: items.length,
      },
    });

    return toInvoiceRecord(updated);
  },

  async finalizeTaxForInvoice(invoiceId: string, taxProvider?: string | null) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { taxSnapshot: true },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["PAID", "CANCELLED", "REFUNDED"].includes(invoice.status)) {
      throw new InvoiceServiceError("Invoice cannot be finalized", 409);
    }

    if (invoice.finalizedAt) {
      return toInvoiceRecord(invoice);
    }

    const items = Array.isArray(invoice.items)
      ? (invoice.items as unknown as DraftInvoiceItemInput[])
      : [];
    const invoiceDiscount =
      invoice.invoiceDiscountType && invoice.invoiceDiscountValue != null
        ? {
            type: invoice.invoiceDiscountType as PricingInvoiceDiscountInput["type"],
            value: invoice.invoiceDiscountValue,
          }
        : undefined;
    const totals = resolveInvoiceTotals(
      items,
      invoice.taxPercent,
      invoiceDiscount,
      invoice.taxSnapshot?.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
      taxProvider ?? invoice.taxSnapshot?.provider,
      "finalize",
    );

    const finalizedAt = new Date();
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        finalizedAt,
        taxProvider: totals.taxSnapshot.provider,
        taxTotal: totals.taxTotal,
        taxSnapshot: {
          upsert: {
            create: {
              ...totals.taxSnapshot,
              calculatedAt: finalizedAt,
            },
            update: {
              ...totals.taxSnapshot,
              calculatedAt: finalizedAt,
            },
          },
        },
      },
    });

    await recordInvoiceAuditForRow(updated, "INVOICE_UPDATED", updated.id, {
      status: updated.status,
      totalAmount: updated.totalAmount,
      currency: updated.currency,
      taxFinalizedAt: finalizedAt.toISOString(),
    });

    return toInvoiceRecord(updated);
  },

  async addChargesToAppointment(
    appointmentId: string,
    items: InvoiceItem[],
    organisationId?: string,
  ) {
    if (organisationId) {
      await assertAppointmentInOrganisation(appointmentId, organisationId);
    }

    const invoice = await this.findOpenInvoiceForAppointment(
      appointmentId,
      organisationId,
    );
    if (!invoice) {
      return this.createExtraInvoiceForAppointment({ appointmentId, items });
    }

    return this.addItemsToInvoice(invoice.id, items);
  },

  async findOpenInvoiceForAppointment(
    appointmentId: string,
    organisationId?: string,
  ) {
    return prisma.invoice.findFirst({
      where: {
        appointmentId,
        ...(organisationId ? { organisationId } : {}),
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async handleAppointmentCancellation(appointmentId: string, reason: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
    });

    if (!invoice) {
      return { action: "NO_INVOICE" };
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      const updated = await cancelUnpaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_CANCELLED", updated.id, {
        status: updated.status,
        reason,
      });
      return { action: "CANCELLED_UNPAID" };
    }

    if (invoice.status === "PAID") {
      const { updated, refund } = await refundPaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_REFUNDED", updated.id, {
        status: updated.status,
        reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
      });
      return { action: "REFUNDED", refundId: refund.refundId };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async handleInvoiceCancellation(invoiceId: string, reason: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      const updated = await cancelUnpaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_CANCELLED", updated.id, {
        status: updated.status,
        reason,
      });
      return { action: "CANCELLED_UNPAID", status: updated.status };
    }

    if (invoice.status === "PAID") {
      const { updated, refund } = await refundPaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_REFUNDED", updated.id, {
        status: updated.status,
        reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
        currency: updated.currency,
      });
      return { action: "REFUNDED", status: updated.status };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async getByPaymentIntentId(paymentIntentId: string, organisationId?: string) {
    const doc = await prisma.invoice.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
        ...(organisationId ? { organisationId } : {}),
      },
    });
    if (!doc) {
      return null;
    }
    return toInvoiceRecord(doc);
  },

  async createCheckoutSessionAndEmailParent(invoiceId: string) {
    const checkout =
      await StripeService.createCheckoutSessionForInvoice(invoiceId);
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    let emailSent = false;
    if (checkout?.url && invoice.parentId) {
      const parent = await prisma.parent.findUnique({
        where: { id: invoice.parentId },
        select: { email: true, firstName: true, lastName: true },
      });
      const organisation = invoice.organisationId
        ? await prisma.organization.findUnique({
            where: { id: invoice.organisationId },
            select: { name: true },
          })
        : null;
      const parentName = parent
        ? [parent.firstName, parent.lastName].filter(Boolean).join(" ")
        : undefined;
      const amountText =
        typeof invoice.totalAmount === "number" && invoice.currency
          ? `${invoice.currency.toUpperCase()} ${invoice.totalAmount.toFixed(2)}`
          : undefined;

      if (parent?.email) {
        try {
          await sendEmailTemplate({
            to: parent.email,
            templateId: "invoicePaymentCheckout",
            templateData: {
              parentName,
              organisationName: organisation?.name ?? undefined,
              invoiceId: invoice.id,
              amountText,
              checkoutUrl: checkout.url,
              ctaUrl: checkout.url,
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
          emailSent = true;
        } catch (error) {
          logger.error("Failed to send invoice checkout email", error);
        }
      }
    }

    return {
      checkout,
      emailSent,
    };
  },
};
