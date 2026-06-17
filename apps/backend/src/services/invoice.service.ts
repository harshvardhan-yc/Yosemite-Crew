import mongoose, { Types } from "mongoose";
import InvoiceModel, { InvoiceDocument, InvoiceMongo } from "../models/invoice";
import AppointmentModel, {
  type AppointmentMongo,
} from "src/models/appointment";
import ServiceModel from "src/models/service";
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  toInvoiceResponseDTO,
} from "@yosemite-crew/types";
import { StripeService } from "./stripe.service";
import OrganizationModel from "src/models/organization";
import { ParentModel } from "src/models/parent";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { AuditTrailService } from "./audit-trail.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import type { AuditEventType } from "src/models/audit-trail";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import { getOrgBillingCurrency } from "src/utils/billing";
import { ensureObjectId as ensureObjectIdStrict } from "src/utils/mongo";
import { resolvePaymentCollectionMethod } from "src/utils/payment";
import { assertSafeString } from "src/utils/sanitize";
import {
  InvoiceStatus as PrismaInvoiceStatus,
  PaymentCollectionMethod,
  Prisma,
  type Invoice as PrismaInvoice,
} from "@prisma/client";

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

const ensureObjectId = (val: unknown, field: string): Types.ObjectId =>
  ensureObjectIdStrict(val, field, (message) => {
    return new InvoiceServiceError(message, 400);
  });

const assertAppointmentInOrganisation = async (
  appointmentId: string,
  organisationId: string,
) => {
  assertSafeString(organisationId, "organisationId");

  if (isReadFromPostgres()) {
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
    return;
  }

  const appointmentObjectId = ensureObjectId(appointmentId, "appointmentId");
  const appointment = await AppointmentModel.findOne({
    _id: appointmentObjectId,
    organisationId,
  })
    .setOptions({ sanitizeFilter: true })
    .select("_id")
    .lean();

  if (!appointment) {
    throw new InvoiceServiceError(
      "Appointment not found for organisation",
      404,
    );
  }
};

const resolveAuditTargetsForInvoice = async (
  invoice: InvoiceDocument,
): Promise<{
  organisationId?: string;
  patientId?: string;
}> => {
  if (invoice.organisationId && invoice.patientId) {
    return {
      organisationId: invoice.organisationId,
      patientId: invoice.patientId,
    };
  }

  if (invoice.appointmentId) {
    const appointment = await AppointmentModel.findById(invoice.appointmentId, {
      organisationId: 1,
      patient: 1,
    }).lean<Pick<AppointmentMongo, "organisationId" | "patient">>();

    if (appointment?.organisationId) {
      const { patientId } = getAppointmentPatientLink(appointment);
      if (patientId) {
        return {
          organisationId: appointment.organisationId,
          patientId,
        };
      }
    }
  }

  return {
    organisationId: invoice.organisationId,
    patientId: invoice.patientId,
  };
};

type InvoiceMetadataPrimitive = string | number | boolean;
type InvoiceMetadata = Record<string, InvoiceMetadataPrimitive>;

const toDomain = (doc: InvoiceDocument): Invoice => {
  const o = doc.toObject() as InvoiceMongo & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

  const items: InvoiceItem[] = o.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent: item.discountPercent ?? undefined,
    total: item.total,
  }));

  const metadata =
    o.metadata && typeof o.metadata === "object"
      ? Object.entries(o.metadata).reduce<InvoiceMetadata>(
          (acc, [key, value]) => {
            if (
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            ) {
              acc[key] = value;
            }
            return acc;
          },
          {},
        )
      : undefined;

  return {
    id: o._id.toString(),
    parentId: o.parentId?.toString(),
    patientId: o.patientId?.toString(),
    organisationId: o.organisationId?.toString(),
    appointmentId: o.appointmentId?.toString(),
    items,
    subtotal: o.subtotal,
    totalAmount: o.totalAmount,
    taxPercent: o.taxPercent,
    currency: o.currency,
    taxTotal: o.taxTotal,
    discountTotal: o.discountTotal,
    stripePaymentIntentId: o.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: o.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: o.stripeInvoiceId ?? undefined,
    stripeCustomerId: o.stripeCustomerId ?? undefined,
    stripeChargeId: o.stripeChargeId ?? undefined,
    stripeReceiptUrl: o.stripeReceiptUrl ?? undefined,
    stripeCheckoutSessionId: o.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: o.stripeCheckoutUrl ?? undefined,
    paymentCollectionMethod: o.paymentCollectionMethod,
    status: o.status as InvoiceStatus,
    metadata,
    paidAt: o.paidAt ?? undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

const normalizeInvoiceMetadata = (
  value: Prisma.JsonValue | null | undefined,
): Record<string, string | number | boolean> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string | number | boolean>
  >((acc, [key, raw]) => {
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

const toDomainFromPrisma = (row: {
  id: string;
  parentId: string | null;
  patientId: string | null;
  organisationId: string | null;
  appointmentId: string | null;
  items: Prisma.JsonValue;
  subtotal: number;
  totalAmount: number;
  taxPercent: number;
  taxTotal: number;
  discountTotal: number;
  currency: string;
  paymentCollectionMethod: PaymentCollectionMethod;
  stripePaymentIntentId: string | null;
  stripePaymentLinkId: string | null;
  stripeInvoiceId: string | null;
  stripeCustomerId: string | null;
  stripeChargeId: string | null;
  stripeReceiptUrl: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCheckoutUrl: string | null;
  status: PrismaInvoiceStatus;
  metadata: Prisma.JsonValue | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Invoice => {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = (rawItems as InvoiceItem[]).map((item) => ({
    ...item,
    description: item.description ?? undefined,
  }));

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
    status: row.status as InvoiceStatus,
    metadata: normalizeInvoiceMetadata(row.metadata),
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const resolveInvoiceTotals = (items: InvoiceItem[], taxPercent = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discountTotal = items.reduce(
    (sum, item) =>
      sum +
      (item.discountPercent
        ? (item.discountPercent / 100) * item.unitPrice * item.quantity
        : 0),
    0,
  );
  const normalizedTaxPercent = taxPercent ?? 0;
  const taxTotal = (normalizedTaxPercent / 100) * (subtotal - discountTotal);
  const totalAmount = subtotal - discountTotal + taxTotal;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    taxPercent: normalizedTaxPercent,
    totalAmount,
  };
};

const coerceMetadataRecord = (
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

type RefundResult = Awaited<
  ReturnType<typeof StripeService.refundPaymentIntent>
>;

const buildCancellationMetadata = (
  metadata: Prisma.JsonValue | null | undefined,
  reason: string,
) => ({
  ...coerceMetadataRecord(metadata),
  cancellationReason: reason,
});

const buildRefundMetadata = (
  metadata: Prisma.JsonValue | null | undefined,
  reason: string,
  refund: RefundResult,
) => ({
  ...coerceMetadataRecord(metadata),
  cancellationReason: reason,
  refundId: refund.refundId,
  amount: refund.amountRefunded,
  refundDate: new Date().toISOString(),
});

const buildMongoCancellationMetadata = (
  reason: string,
  metadata: InvoiceMongo["metadata"] = {},
) => ({
  ...metadata,
  cancellationReason: reason,
});

const buildMongoRefundMetadata = (
  reason: string,
  refund: RefundResult,
  metadata: InvoiceMongo["metadata"] = {},
) => ({
  ...metadata,
  cancellationReason: reason,
  refundId: refund.refundId,
  amount: refund.amountRefunded,
  refundDate: new Date().toISOString(),
});

const recordInvoiceAuditEvent = async (
  targets: {
    organisationId?: string | null;
    patientId?: string | null;
  },
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

const recordInvoiceAuditForDoc = async (
  doc: InvoiceDocument,
  eventType: AuditEventType,
  entityId: string,
  metadata: Record<string, unknown>,
) => {
  const targets = await resolveAuditTargetsForInvoice(doc);
  await recordInvoiceAuditEvent(targets, { eventType, entityId, metadata });
};

const getAppointmentPatientLink = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => {
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
  const { patientId } = getAppointmentPatientLink(appointment);

  if (!patientId) {
    throw new InvoiceServiceError("Appointment patient links are missing", 500);
  }

  return patientId;
};

const cancelUnpaidInvoiceRow = async (
  invoice: PrismaInvoice,
  reason: string,
) => {
  const metadata = buildCancellationMetadata(invoice.metadata, reason);
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "CANCELLED",
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });
};

const refundPaidInvoiceRow = async (invoice: PrismaInvoice, reason: string) => {
  if (!invoice.stripePaymentIntentId) {
    throw new InvoiceServiceError(
      "Cannot refund: missing Stripe paymentIntentId",
      500,
    );
  }

  const refund = await StripeService.refundPaymentIntent(
    invoice.stripePaymentIntentId,
  );

  const metadata = buildRefundMetadata(invoice.metadata, reason, refund);
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "REFUNDED",
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });

  return { updated, refund };
};

const cancelUnpaidInvoiceDoc = async (
  invoice: InvoiceDocument,
  reason: string,
) => {
  invoice.status = "CANCELLED";
  invoice.metadata = buildMongoCancellationMetadata(reason, invoice.metadata);
  await invoice.save();
  await syncInvoiceToPostgres(invoice);
  return invoice;
};

const refundPaidInvoiceDoc = async (
  invoice: InvoiceDocument,
  reason: string,
) => {
  if (!invoice.stripePaymentIntentId) {
    throw new InvoiceServiceError(
      "Cannot refund: missing Stripe paymentIntentId",
      500,
    );
  }

  const refund = await StripeService.refundPaymentIntent(
    invoice.stripePaymentIntentId,
  );

  invoice.status = "REFUNDED";
  invoice.metadata = buildMongoRefundMetadata(reason, refund, invoice.metadata);
  await invoice.save();
  await syncInvoiceToPostgres(invoice);

  return { updated: invoice, refund };
};

const coerceAppointmentCompanionId = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}): string | undefined => getAppointmentPatientLink(appointment).patientId;

const coerceAppointmentParentId = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}): string | undefined => getAppointmentPatientLink(appointment).parentId;

const coerceAppointmentTypeId = (
  appointmentType: Prisma.JsonValue | null,
): string | undefined => {
  if (!appointmentType || typeof appointmentType !== "object") {
    return undefined;
  }
  const appointmentTypeObj = appointmentType as Record<string, unknown>;
  return typeof appointmentTypeObj.id === "string"
    ? appointmentTypeObj.id
    : undefined;
};

const coerceAppointmentTypeName = (
  appointmentType: Prisma.JsonValue | null,
): string | undefined => {
  if (!appointmentType || typeof appointmentType !== "object") {
    return undefined;
  }
  const appointmentTypeObj = appointmentType as Record<string, unknown>;
  return typeof appointmentTypeObj.name === "string"
    ? appointmentTypeObj.name
    : undefined;
};

type DraftInvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
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

const resolveAuditTargetsForInvoiceRow = async (row: {
  organisationId: string | null;
  patientId: string | null;
  appointmentId: string | null;
}) => {
  if (row.organisationId && row.patientId) {
    return {
      organisationId: row.organisationId,
      patientId: row.patientId,
    };
  }

  if (row.appointmentId) {
    const appointment = (await prisma.appointment.findUnique({
      where: { id: row.appointmentId },
      select: { organisationId: true, patient: true },
    })) as {
      organisationId?: string | null;
      patient?: Prisma.JsonValue | null;
      companion?: Prisma.JsonValue | null;
    } | null;

    if (appointment?.organisationId) {
      const patientId = coerceAppointmentCompanionId(appointment);
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

const toPrismaInvoiceData = (doc: InvoiceDocument) => {
  const obj = doc.toObject() as InvoiceMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    parentId: obj.parentId?.toString() ?? undefined,
    patientId: obj.patientId?.toString() ?? undefined,
    organisationId: obj.organisationId?.toString() ?? undefined,
    appointmentId: obj.appointmentId?.toString() ?? undefined,
    items: obj.items as unknown as Prisma.InputJsonValue,
    subtotal: obj.subtotal,
    discountTotal: obj.discountTotal ?? 0,
    taxTotal: obj.taxTotal ?? 0,
    taxPercent: obj.taxPercent ?? 0,
    totalAmount: obj.totalAmount,
    currency: obj.currency,
    paymentCollectionMethod:
      obj.paymentCollectionMethod as PaymentCollectionMethod,
    stripePaymentIntentId: obj.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: obj.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: obj.stripeInvoiceId ?? undefined,
    stripeCustomerId: obj.stripeCustomerId ?? undefined,
    stripeChargeId: obj.stripeChargeId ?? undefined,
    stripeReceiptUrl: obj.stripeReceiptUrl ?? undefined,
    stripeCheckoutSessionId: obj.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: obj.stripeCheckoutUrl ?? undefined,
    status: obj.status as PrismaInvoiceStatus,
    metadata: (obj.metadata ?? undefined) as unknown as Prisma.InputJsonValue,
    paidAt: obj.paidAt ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncInvoiceToPostgres = async (doc: InvoiceDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaInvoiceData(doc);
    await prisma.invoice.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Invoice", err);
  }
};

const recalculateTotals = (invoice: InvoiceDocument) => {
  invoice.subtotal = invoice.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );

  invoice.discountTotal = invoice.items.reduce(
    (sum, i) =>
      sum +
      (i.discountPercent
        ? (i.discountPercent / 100) * i.unitPrice * i.quantity
        : 0),
    0,
  );

  invoice.taxPercent = invoice.taxPercent ?? 0;
  invoice.taxTotal =
    (invoice.taxPercent / 100) * (invoice.subtotal - invoice.discountTotal);

  invoice.totalAmount =
    invoice.subtotal - invoice.discountTotal + invoice.taxTotal;
};

export const InvoiceService = {
  async createDraftForAppointment(
    input: {
      appointmentId: string;
      parentId: string;
      organisationId: string;
      patientId: string;
      items: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
      }[];
      notes?: string;
      paymentCollectionMethod:
        | "PAYMENT_INTENT"
        | "PAYMENT_LINK"
        | "PAYMENT_AT_CLINIC";
    },
    session?: mongoose.ClientSession,
  ) {
    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          organisationId: true,
          patient: true,
        },
      });

      if (!appointment) {
        throw new InvoiceServiceError("Appointment not found", 404);
      }

      const itemsDetailed = input.items.map((item) => ({
        ...item,
        name: item.description,
        total: item.quantity * item.unitPrice,
      }));

      const totals = resolveInvoiceTotals(itemsDetailed, 0);
      const currency = await getOrgBillingCurrency(input.organisationId);
      const patientId = coerceAppointmentCompanionId(appointment);
      const parentId = coerceAppointmentParentId(appointment);
      if (!patientId || !parentId) {
        throw new InvoiceServiceError(
          "Appointment missing parent or patient links",
          500,
        );
      }

      const createdInvoice = await prisma.invoice.create({
        data: {
          appointmentId: input.appointmentId,
          parentId: input.parentId,
          organisationId: input.organisationId,
          patientId: patientId ?? undefined,
          currency,
          status: "AWAITING_PAYMENT",
          paymentCollectionMethod: input.paymentCollectionMethod,
          items: itemsDetailed as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxPercent: totals.taxPercent,
          totalAmount: totals.totalAmount,
        },
      });

      const auditTargets =
        await resolveAuditTargetsForInvoiceRow(createdInvoice);
      if (auditTargets.organisationId && auditTargets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: auditTargets.organisationId,
          patientId: auditTargets.patientId,
          eventType: "INVOICE_CREATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: createdInvoice.id,
          metadata: {
            appointmentId: input.appointmentId,
            status: createdInvoice.status,
            totalAmount: createdInvoice.totalAmount,
            currency: createdInvoice.currency,
          },
        });
      }

      const notificationPayload = NotificationTemplates.Payment.PAYMENT_PENDING(
        createdInvoice.totalAmount,
        createdInvoice.currency,
      );
      await NotificationService.sendToUser(input.parentId, notificationPayload);

      return createdInvoice;
    }

    // 1. Validate appointment exists
    const appointment = await AppointmentModel.findById(
      input.appointmentId,
    ).session(session ?? null);

    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    // 2. Build amounts
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const discountTotal = input.items.reduce(
      (sum, item) =>
        sum +
        (item.discountPercent
          ? (item.discountPercent / 100) * (item.unitPrice * item.quantity)
          : 0),
      0,
    );

    const taxTotal = 0; // add GST/VAT logic later
    const totalPayable = subtotal - discountTotal + taxTotal;
    const currency = await getOrgBillingCurrency(input.organisationId);

    const itemsDetailed = input.items.map((item) => ({
      ...item,
      name: item.description,
      total: item.quantity * item.unitPrice,
    }));

    // 3. Create invoice
    const invoice = await InvoiceModel.create(
      [
        {
          appointmentId: input.appointmentId,
          parentId: input.parentId,
          organisationId: input.organisationId,
          currency,

          status: "AWAITING_PAYMENT",
          paymentCollectionMethod: input.paymentCollectionMethod,
          items: itemsDetailed,
          subtotal,
          discountTotal,
          taxTotal,
          totalAmount: totalPayable,

          notes: input.notes,
        },
      ],
      { session },
    );

    const createdInvoice = Array.isArray(invoice) ? invoice[0] : invoice;
    await syncInvoiceToPostgres(createdInvoice);
    const patientId = getAppointmentPatientIdOrThrow(appointment);

    await AuditTrailService.recordSafely({
      organisationId: input.organisationId,
      patientId,
      eventType: "INVOICE_CREATED",
      actorType: "SYSTEM",
      entityType: "INVOICE",
      entityId: createdInvoice._id.toString(),
      metadata: {
        appointmentId: input.appointmentId,
        status: createdInvoice.status,
        totalAmount: createdInvoice.totalAmount,
        currency: createdInvoice.currency,
      },
    });

    const notificationPayload = NotificationTemplates.Payment.PAYMENT_PENDING(
      totalPayable,
      currency,
    );
    await NotificationService.sendToUser(input.parentId, notificationPayload);

    return createdInvoice;
  },

  async getOrCreateDraftForAppointment(
    input: {
      appointmentId: string;
      parentId: string;
      organisationId: string;
      patientId: string;
      items: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
      }[];
      notes?: string;
      paymentCollectionMethod:
        | "PAYMENT_INTENT"
        | "PAYMENT_LINK"
        | "PAYMENT_AT_CLINIC";
    },
    session?: mongoose.ClientSession,
  ) {
    const existing = await this.findOpenInvoiceForAppointment(
      input.appointmentId,
    );
    if (existing) {
      return existing;
    }

    return this.createDraftForAppointment(input, session);
  },

  async createExtraInvoiceForAppointment(input: {
    appointmentId: string;
    items: InvoiceItem[];
    metadata?: Record<string, string | number | boolean | undefined>;
  }) {
    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          organisationId: true,
          patient: true,
        },
      });
      if (!appointment) {
        throw new InvoiceServiceError("Appointment not found", 404);
      }

      const currency = await getOrgBillingCurrency(appointment.organisationId);
      const itemsDetailed = input.items.map((item) => ({
        ...item,
        name: item.description ?? item.name,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      }));

      const totals = resolveInvoiceTotals(itemsDetailed, 0);
      const patientId = coerceAppointmentCompanionId(appointment);
      const parentId = coerceAppointmentParentId(appointment);

      const invoice = await prisma.invoice.create({
        data: {
          appointmentId: appointment.id,
          parentId: parentId ?? undefined,
          patientId: patientId ?? undefined,
          organisationId: appointment.organisationId,
          currency,
          status: "AWAITING_PAYMENT",
          items: itemsDetailed as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxPercent: totals.taxPercent,
          totalAmount: totals.totalAmount,
          metadata: {
            ...input.metadata,
            source: "EXTRA_CHARGES",
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const auditTargets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (auditTargets.organisationId && auditTargets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: auditTargets.organisationId,
          patientId: auditTargets.patientId,
          eventType: "INVOICE_CREATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            appointmentId: appointment.id,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }

      if (parentId) {
        await NotificationService.sendToUser(
          parentId,
          NotificationTemplates.Payment.PAYMENT_PENDING(
            invoice.totalAmount,
            invoice.currency,
          ),
        );
      }

      return toDomainFromPrisma(invoice);
    }

    const appointment = await AppointmentModel.findById(input.appointmentId);
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const currency = await getOrgBillingCurrency(appointment.organisationId);
    const { patientId, parentId } = getAppointmentPatientLink(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or patient links",
        500,
      );
    }
    const invoice = new InvoiceModel({
      appointmentId: appointment._id,
      parentId,
      patientId,
      organisationId: appointment.organisationId,
      currency,

      purpose: "APPOINTMENT_EXTRA",
      status: "AWAITING_PAYMENT",

      items: input.items.map((item) => ({
        ...item,
        name: item.description,
        total: item.quantity * item.unitPrice,
      })),
      metadata: {
        ...input.metadata,
        source: "EXTRA_CHARGES",
      },
    });

    recalculateTotals(invoice);
    await invoice.save();
    await syncInvoiceToPostgres(invoice);

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      patientId,
      eventType: "INVOICE_CREATED",
      actorType: "SYSTEM",
      entityType: "INVOICE",
      entityId: invoice._id.toString(),
      metadata: {
        appointmentId: appointment._id.toString(),
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

    return toDomain(invoice);
  },

  async attachStripeDetails(invoiceId: string, updates: Partial<Invoice>) {
    if (isReadFromPostgres()) {
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

      return toDomainFromPrisma(updated);
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: updates },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    await syncInvoiceToPostgres(doc);

    await syncInvoiceToPostgres(doc);

    return toDomain(doc);
  },

  async markInvoicePaid(params: {
    invoiceId: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    stripeReceiptUrl?: string;
  }) {
    if (isReadFromPostgres()) {
      const existing = await prisma.invoice.findUnique({
        where: { id: params.invoiceId },
      });
      if (!existing) {
        return null;
      }
      if (existing.status === "PAID") {
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

      const targets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (targets.organisationId && targets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          patientId: targets.patientId,
          eventType: "INVOICE_PAID",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }

      return invoice;
    }

    const invoice = await InvoiceModel.findOneAndUpdate(
      { _id: params.invoiceId, status: { $ne: "PAID" } },
      {
        $set: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId: params.stripePaymentIntentId,
          stripeChargeId: params.stripeChargeId,
          stripeReceiptUrl: params.stripeReceiptUrl,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (invoice) {
      await syncInvoiceToPostgres(invoice);
      const targets = await resolveAuditTargetsForInvoice(invoice);
      if (targets.organisationId && targets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          patientId: targets.patientId,
          eventType: "INVOICE_PAID",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice._id.toString(),
          metadata: {
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }
    }

    return invoice;
  },

  async markInvoicePaidManually(invoiceId: string, organisationId: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!doc) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }

      if (doc.organisationId !== organisationId) {
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

      const updated = await this.markInvoicePaid({
        invoiceId: doc.id,
      });

      return updated
        ? toInvoiceResponseDTO(
            toDomainFromPrisma(updated as unknown as PrismaInvoice),
          )
        : null;
    }

    const doc = await InvoiceModel.findById(invoiceId);
    if (!doc) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (doc.organisationId?.toString() !== organisationId) {
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

    const updated = await this.markInvoicePaid({
      invoiceId: doc._id.toString(),
    });

    return updated
      ? toInvoiceResponseDTO(toDomain(updated as InvoiceDocument))
      : null;
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

    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!doc) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }

      if (doc.organisationId !== organisationId) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }

      if (["PAID", "CANCELLED", "REFUNDED"].includes(doc.status)) {
        throw new InvoiceServiceError("Invoice cannot be updated.", 409);
      }

      if (doc.paymentCollectionMethod === resolvedPaymentCollectionMethod) {
        return toInvoiceResponseDTO(toDomainFromPrisma(doc));
      }

      const updated = await prisma.invoice.update({
        where: { id: doc.id },
        data: {
          paymentCollectionMethod: resolvedPaymentCollectionMethod,
        },
      });

      return toInvoiceResponseDTO(toDomainFromPrisma(updated));
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");
    const doc = await InvoiceModel.findById(_id);
    if (!doc) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (doc.organisationId?.toString() !== organisationId) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (["PAID", "CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be updated.", 409);
    }

    if (doc.paymentCollectionMethod !== resolvedPaymentCollectionMethod) {
      doc.paymentCollectionMethod = resolvedPaymentCollectionMethod;
      doc.updatedAt = new Date();
      await doc.save();
      await syncInvoiceToPostgres(doc);
    }

    return toInvoiceResponseDTO(toDomain(doc));
  },

  async markFailed(invoiceId: string) {
    if (isReadFromPostgres()) {
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
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "FAILED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    await syncInvoiceToPostgres(doc);

    await recordInvoiceAuditForDoc(doc, "INVOICE_FAILED", doc._id.toString(), {
      status: doc.status,
      totalAmount: doc.totalAmount,
      currency: doc.currency,
    });

    return doc;
  },

  async markRefunded(invoiceId: string): Promise<Invoice> {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "REFUNDED" },
      });

      await recordInvoiceAuditForRow(doc, "INVOICE_REFUNDED", doc.id, {
        status: doc.status,
        totalAmount: doc.totalAmount,
        currency: doc.currency,
      });

      return toDomainFromPrisma(doc);
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "REFUNDED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    await recordInvoiceAuditForDoc(
      doc,
      "INVOICE_REFUNDED",
      doc._id.toString(),
      {
        status: doc.status,
        totalAmount: doc.totalAmount,
        currency: doc.currency,
      },
    );

    return toDomain(doc);
  },

  async updateStatus(invoiceId: string, status: InvoiceMongo["status"]) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: status as PrismaInvoiceStatus },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (targets.organisationId && targets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          patientId: targets.patientId,
          eventType: "INVOICE_UPDATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            status: invoice.status,
          },
        });
      }

      return invoice;
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    invoice.status = status;
    await invoice.save();
    await syncInvoiceToPostgres(invoice);

    const targets = await resolveAuditTargetsForInvoice(invoice);
    if (targets.organisationId && targets.patientId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        patientId: targets.patientId,
        eventType: "INVOICE_UPDATED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: invoice._id.toString(),
        metadata: {
          status: invoice.status,
        },
      });
    }
    return invoice;
  },

  async getByAppointmentId(appId: string, organisationId?: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: {
          appointmentId: appId,
          ...(organisationId ? { organisationId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      appointmentId: appId,
      ...(organisationId ? { organisationId } : {}),
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async bootstrapForAppointment(appointmentId: string) {
    if (isReadFromPostgres()) {
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
      if (
        latestInvoice &&
        ["PAID", "REFUNDED"].includes(latestInvoice.status)
      ) {
        return latestInvoice;
      }

      const serviceId = coerceAppointmentTypeId(appointment.appointmentType);
      const productItemId =
        appointment.productItemId ??
        coerceAppointmentTypeId(appointment.appointmentType);
      if (!serviceId && !productItemId) {
        throw new InvoiceServiceError("Service or product not found", 404);
      }

      const parentId = coerceAppointmentParentId(appointment);
      const patientId = coerceAppointmentCompanionId(appointment);
      if (!parentId || !patientId) {
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
          ? await prisma.service.findUnique({
              where: { id: serviceId },
            })
          : null;
        if (!service) {
          throw new InvoiceServiceError("Service not found", 404);
        }

        const description =
          coerceAppointmentTypeName(appointment.appointmentType) ??
          service.name ??
          "Consultation";
        items = [
          {
            description,
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
    }

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const openInvoice = await this.findOpenInvoiceForAppointment(appointmentId);
    if (openInvoice) {
      return openInvoice;
    }

    const latestInvoice = await InvoiceModel.findOne({ appointmentId }).sort({
      createdAt: -1,
    });
    if (latestInvoice && ["PAID", "REFUNDED"].includes(latestInvoice.status)) {
      return latestInvoice;
    }

    const serviceId = appointment.appointmentType?.id;
    if (!serviceId) {
      throw new InvoiceServiceError("Service or product not found", 404);
    }

    const catalogSelection = await resolveCatalogSelectionSafe(
      serviceId,
      appointment.organisationId,
    );

    let items: DraftInvoiceItemInput[];
    if (catalogSelection) {
      items = mapCatalogSelectionToDraftItems(catalogSelection);
    } else {
      const service = await ServiceModel.findById(serviceId);
      if (!service) {
        throw new InvoiceServiceError("Service not found", 404);
      }

      const description =
        appointment.appointmentType?.name ?? service.name ?? "Consultation";
      items = [
        {
          description,
          quantity: 1,
          unitPrice: service.cost,
          discountPercent: service.maxDiscount ?? undefined,
        },
      ];
    }

    const { patientId, parentId } = getAppointmentPatientLink(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or patient links",
        500,
      );
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
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findUnique({ where: { id } });
      if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

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
        invoice: toInvoiceResponseDTO(toDomainFromPrisma(doc)),
      };
    }

    const _id = ensureObjectId(id, "invoiceId");

    const doc = await InvoiceModel.findById(_id);
    const org = await OrganizationModel.findById(doc?.organisationId);

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    return {
      organistion: {
        name: org?.name || "",
        placesId: org?.googlePlacesId || "",
        address: org?.address || "",
        image: org?.imageURL || "",
      },
      invoice: toInvoiceResponseDTO(toDomain(doc)),
    };
  },

  async listForOrganisation(organisationId: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { organisationId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      organisationId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForParent(parentId: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { parentId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      parentId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForCompanion(patientId: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      patientId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async addItemsToInvoice(invoiceId: string, items: InvoiceItem[]) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

      if (invoice.status === "PAID") {
        throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
      }

      const existingItems = Array.isArray(invoice.items)
        ? (invoice.items as InvoiceItem[])
        : [];
      const newItems = items.map((item) => ({
        ...item,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      }));
      const mergedItems = [...existingItems, ...newItems];
      const totals = resolveInvoiceTotals(mergedItems, invoice.taxPercent);

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          items: mergedItems as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
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
        },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(updated);
      if (targets.organisationId && targets.patientId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          patientId: targets.patientId,
          eventType: "INVOICE_UPDATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: updated.id,
          metadata: {
            status: updated.status,
            totalAmount: updated.totalAmount,
            currency: updated.currency,
            itemsAdded: items.length,
          },
        });
      }

      return toDomainFromPrisma(updated);
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    if (invoice.status === "PAID") {
      throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
    }

    for (const item of items) {
      invoice.items.push({
        ...item,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      });
    }

    recalculateTotals(invoice);
    invoice.updatedAt = new Date();

    // If a Checkout Session already exists, its amount cannot be updated.
    // Clear it so the next checkout uses fresh totals.
    if (
      invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
      invoice.stripeCheckoutSessionId
    ) {
      invoice.stripeCheckoutSessionId = undefined;
      invoice.stripeCheckoutUrl = null;
    }

    await invoice.save();
    await syncInvoiceToPostgres(invoice);

    const targets = await resolveAuditTargetsForInvoice(invoice);
    if (targets.organisationId && targets.patientId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        patientId: targets.patientId,
        eventType: "INVOICE_UPDATED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: invoice._id.toString(),
        metadata: {
          status: invoice.status,
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
          itemsAdded: items.length,
        },
      });
    }

    return toDomain(invoice);
  },

  async addChargesToAppointment(
    appointmentId: string,
    items: InvoiceItem[],
    organisationId?: string,
  ) {
    if (organisationId) {
      await assertAppointmentInOrganisation(appointmentId, organisationId);
    }

    if (isReadFromPostgres()) {
      const invoice = await this.findOpenInvoiceForAppointment(
        appointmentId,
        organisationId,
      );
      if (!invoice) {
        return this.createExtraInvoiceForAppointment({
          appointmentId,
          items,
        });
      }
      const invoiceId =
        typeof (invoice as { id?: string }).id === "string"
          ? (invoice as { id: string }).id
          : undefined;
      if (!invoiceId) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }
      return this.addItemsToInvoice(invoiceId, items);
    }

    const invoice = await this.findOpenInvoiceForAppointment(
      appointmentId,
      organisationId,
    );

    // No open invoice → create EXTRA invoice
    if (!invoice) {
      return this.createExtraInvoiceForAppointment({
        appointmentId,
        items,
      });
    }

    // Open invoice exists → append
    return this.addItemsToInvoice(
      (invoice as { _id: { toString(): string } })._id.toString(),
      items,
    );
  },

  async findOpenInvoiceForAppointment(
    appointmentId: string,
    organisationId?: string,
  ) {
    if (isReadFromPostgres()) {
      return prisma.invoice.findFirst({
        where: {
          appointmentId,
          ...(organisationId ? { organisationId } : {}),
          status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return InvoiceModel.findOne({
      appointmentId,
      ...(organisationId ? { organisationId } : {}),
      status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
    }).sort({ createdAt: -1 });
  },

  async handleAppointmentCancellation(appointmentId: string, reason: string) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findFirst({
        where: { appointmentId },
      });

      if (!invoice) {
        return { action: "NO_INVOICE" };
      }

      if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
        return { action: "ALREADY_HANDLED", status: invoice.status };
      }

      if (
        invoice.status === "AWAITING_PAYMENT" ||
        invoice.status === "PENDING"
      ) {
        const updated = await cancelUnpaidInvoiceRow(invoice, reason);
        await recordInvoiceAuditForRow(
          updated,
          "INVOICE_CANCELLED",
          updated.id,
          {
            status: updated.status,
            reason,
          },
        );
        return { action: "CANCELLED_UNPAID" };
      }

      if (invoice.status === "PAID") {
        const { updated, refund } = await refundPaidInvoiceRow(invoice, reason);
        await recordInvoiceAuditForRow(
          updated,
          "INVOICE_REFUNDED",
          updated.id,
          {
            status: updated.status,
            reason,
            refundId: refund.refundId,
            amount: refund.amountRefunded,
          },
        );
        return { action: "REFUNDED", refundId: refund.refundId };
      }

      return { action: "NO_ACTION", status: invoice.status };
    }

    // 1. Load invoice (if exists)
    const invoice = await InvoiceModel.findOne({ appointmentId });

    if (!invoice) {
      // No invoice created → safe to return
      return { action: "NO_INVOICE" };
    }

    // If already cancelled or refunded — idempotent
    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    // If invoice not yet paid, simply cancel it
    if (invoice.status === "AWAITING_PAYMENT" || invoice.status === "PENDING") {
      const updated = await cancelUnpaidInvoiceDoc(invoice, reason);
      await recordInvoiceAuditForDoc(
        updated,
        "INVOICE_CANCELLED",
        updated._id.toString(),
        {
          status: updated.status,
          reason,
        },
      );
      return { action: "CANCELLED_UNPAID" };
    }

    // -----------------------------
    // PAID invoice → refund required
    // -----------------------------
    if (invoice.status === "PAID") {
      const { updated, refund } = await refundPaidInvoiceDoc(invoice, reason);
      await recordInvoiceAuditForDoc(
        updated,
        "INVOICE_REFUNDED",
        updated._id.toString(),
        {
          status: updated.status,
          reason,
          refundId: refund.refundId,
          amount: refund.amountRefunded,
        },
      );
      return { action: "REFUNDED", refundId: refund.refundId };
    }

    // Fallback — unknown (should not happen)
    return { action: "NO_ACTION", status: invoice.status };
  },

  async handleInvoiceCancellation(invoiceId: string, reason: string) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) {
        throw new InvoiceServiceError("Invoice not found", 404);
      }

      if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
        return { action: "ALREADY_HANDLED", status: invoice.status };
      }

      if (
        invoice.status === "AWAITING_PAYMENT" ||
        invoice.status === "PENDING"
      ) {
        const updated = await cancelUnpaidInvoiceRow(invoice, reason);
        await recordInvoiceAuditForRow(
          updated,
          "INVOICE_CANCELLED",
          updated.id,
          {
            status: updated.status,
            reason,
          },
        );
        return { action: "CANCELLED_UNPAID", status: updated.status };
      }

      if (invoice.status === "PAID") {
        const { updated, refund } = await refundPaidInvoiceRow(invoice, reason);
        await recordInvoiceAuditForRow(
          updated,
          "INVOICE_REFUNDED",
          updated.id,
          {
            status: updated.status,
            refundId: refund.refundId,
            amount: refund.amountRefunded,
            currency: updated.currency,
          },
        );
        return { action: "REFUNDED", status: updated.status };
      }

      return { action: "NO_ACTION", status: invoice.status };
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const invoice = await InvoiceModel.findById(_id);
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (invoice.status === "AWAITING_PAYMENT" || invoice.status === "PENDING") {
      const updated = await cancelUnpaidInvoiceDoc(invoice, reason);
      await recordInvoiceAuditForDoc(
        updated,
        "INVOICE_CANCELLED",
        updated._id.toString(),
        {
          status: updated.status,
          reason,
        },
      );
      return { action: "CANCELLED_UNPAID", status: invoice.status };
    }

    if (invoice.status === "PAID") {
      const { updated, refund } = await refundPaidInvoiceDoc(invoice, reason);
      await recordInvoiceAuditForDoc(
        updated,
        "INVOICE_REFUNDED",
        updated._id.toString(),
        {
          status: updated.status,
          refundId: refund.refundId,
          amount: refund.amountRefunded,
          currency: updated.currency,
        },
      );
      return { action: "REFUNDED", status: invoice.status };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async getByPaymentIntentId(paymentIntentId: string, organisationId?: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          ...(organisationId ? { organisationId } : {}),
        },
      });
      if (!doc) {
        return null;
      }
      return toInvoiceResponseDTO(toDomainFromPrisma(doc));
    }

    const doc = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
      ...(organisationId ? { organisationId } : {}),
    });

    if (!doc) {
      return null;
    }

    return toInvoiceResponseDTO(toDomain(doc));
  },

  async createCheckoutSessionAndEmailParent(invoiceId: string) {
    const checkout =
      await StripeService.createCheckoutSessionForInvoice(invoiceId);

    const invoice = isReadFromPostgres()
      ? await prisma.invoice.findUnique({ where: { id: invoiceId } })
      : await InvoiceModel.findById(invoiceId).lean();
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    let emailSent = false;
    if (checkout?.url && invoice.parentId) {
      const parent = isReadFromPostgres()
        ? await prisma.parent.findUnique({
            where: { id: invoice.parentId },
            select: { email: true, firstName: true, lastName: true },
          })
        : await ParentModel.findById(invoice.parentId)
            .select("email firstName lastName")
            .lean();
      const organisation = invoice.organisationId
        ? isReadFromPostgres()
          ? await prisma.organization.findUnique({
              where: { id: invoice.organisationId },
              select: { name: true },
            })
          : await OrganizationModel.findById(invoice.organisationId)
              .select("name")
              .lean()
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
              invoiceId: isReadFromPostgres()
                ? (invoice as { id: string }).id
                : (invoice as { _id: Types.ObjectId })._id.toString(),
              amountText,
              checkoutUrl: checkout.url,
              ctaUrl: checkout.url,
              ctaLabel: "Pay Invoice",
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
          emailSent = true;
        } catch (error) {
          logger.error("Failed to send invoice checkout email.", error);
        }
      }
    }

    return { checkout, emailSent };
  },
};
