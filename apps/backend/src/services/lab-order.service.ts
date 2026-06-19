import type { LabOrderStatus } from "src/models/lab-order";
import { prisma } from "src/config/prisma";
import { getLabOrderAdapter, normalizeLabProvider } from "src/labs";
import type { LabOrderCreateInput, LabOrderUpdateInput } from "src/labs";
import logger from "src/utils/logger";
import { Prisma } from "@prisma/client";
import { InvoiceService } from "src/services/invoice.service";
import type { InvoiceItem } from "@yosemite-crew/types";

export class LabOrderServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LabOrderServiceError";
  }
}

const ensureNonEmpty = (value: string | undefined, field: string) => {
  if (!value?.trim()) {
    throw new LabOrderServiceError(`${field} is required.`, 400);
  }
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new LabOrderServiceError(`${field} is required.`, 400);
  }
  return value;
};

const ensureOptionalString = (
  value: unknown,
  field: string,
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return value;
};

const LAB_ORDER_STATUS_VALUES = new Set<LabOrderStatus>([
  "CREATED",
  "SUBMITTED",
  "AT_THE_LAB",
  "PARTIAL",
  "RUNNING",
  "COMPLETE",
  "CANCELLED",
  "ERROR",
]);

const ensureOptionalStatus = (value: unknown): LabOrderStatus | undefined => {
  const asString = ensureOptionalString(value, "status");
  if (!asString) return undefined;
  if (!LAB_ORDER_STATUS_VALUES.has(asString as LabOrderStatus)) {
    throw new LabOrderServiceError("Invalid status.", 400);
  }
  return asString as LabOrderStatus;
};

const ensureTestsProvided = (tests: string[] | undefined | null) => {
  if (!tests || tests.length === 0) {
    throw new LabOrderServiceError("tests are required.", 400);
  }
};

const toJsonInput = (value: unknown) => {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
};

const toStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

const toIvlsArray = (
  value: unknown,
): Array<{ serialNumber: string }> | undefined =>
  Array.isArray(value)
    ? (value.filter(
        (item): item is { serialNumber: string } =>
          typeof item === "object" &&
          item !== null &&
          "serialNumber" in item &&
          typeof (item as { serialNumber?: unknown }).serialNumber === "string",
      ) as Array<{ serialNumber: string }>)
    : undefined;

const resolvePrimaryParentId = async (patientId: string) => {
  const parentLink = await prisma.parentPatient.findFirst({
    where: {
      patientId,
      role: "PRIMARY",
      status: "ACTIVE",
    },
  });

  if (!parentLink?.parentId) {
    throw new LabOrderServiceError(
      "Primary parent not found for companion.",
      400,
    );
  }

  return parentLink.parentId;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildInvoiceItemsFromTests = async (
  testCodes: string[],
): Promise<InvoiceItem[]> => {
  if (!testCodes.length) return [];

  const entries = await prisma.codeEntry.findMany({
    where: {
      system: "IDEXX",
      type: "TEST",
      code: { in: testCodes },
      active: true,
    },
  });

  const normalizedEntries = entries as unknown as Array<{
    code: string;
    display?: string | null;
    meta?: unknown;
  }>;
  const entryByCode = new Map(
    normalizedEntries.map((entry) => [entry.code, entry]),
  );

  return testCodes.map((code) => {
    const entry = entryByCode.get(code);
    const display = entry?.display ?? `IDEXX Test ${code}`;
    const listPrice = toNumber(
      (entry?.meta as Record<string, unknown>)?.listPrice,
    );
    if (listPrice === null) {
      throw new LabOrderServiceError(
        `Missing list price for IDEXX test ${code}.`,
        422,
      );
    }

    return {
      id: `laborder:test:${code}`,
      name: display,
      description: `IDEXX test ${code}`,
      quantity: 1,
      unitPrice: listPrice,
      total: listPrice,
    };
  });
};

const maybeBillSubmittedOrder = async (order: {
  id: string;
  status: LabOrderStatus;
  billedAt: Date | null;
  appointmentId: string | null;
  tests: unknown;
}) => {
  if (order.status !== "SUBMITTED") return;
  if (order.billedAt) return;
  if (!order.appointmentId) {
    logger.warn("Lab order billing skipped: missing appointmentId.", {
      labOrderId: order.id,
    });
    return;
  }

  try {
    const items = await buildInvoiceItemsFromTests(
      Array.isArray(order.tests) ? (order.tests as string[]) : [],
    );
    if (!items.length) {
      throw new LabOrderServiceError(
        "No billable lab tests found for this order.",
        422,
      );
    }

    const invoice = await InvoiceService.addChargesToAppointment(
      order.appointmentId,
      items,
    );

    await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        invoiceId: invoice.id,
        billedAt: new Date(),
        billingError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lab order billing failed.";
    await prisma.labOrder.update({
      where: { id: order.id },
      data: { billingError: message },
    });
    logger.error("Lab order billing failed", error);
  }
};

export const LabOrderService = {
  async listProviderTests(
    providerInput: string,
    params: { query?: string; limit?: number; page?: number; codes?: string[] },
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const filter: Record<string, unknown> = {
      system: "IDEXX",
      type: "TEST",
      active: true,
    };

    if (params.codes && params.codes.length > 0) {
      filter.code = { in: params.codes };
    }

    if (params.query) {
      if (typeof params.query !== "string") {
        throw new LabOrderServiceError("Invalid query.", 400);
      }
      const trimmedQuery = params.query.trim();
      if (trimmedQuery) {
        const escaped = trimmedQuery.replaceAll(
          /[.*+?^${}()|[\]\\]/g,
          String.raw`\\$&`,
        );
        filter.$or = [
          { code: new RegExp(escaped, "i") },
          { display: new RegExp(escaped, "i") },
          { synonyms: new RegExp(escaped, "i") },
        ];
      }
    }

    const limit =
      typeof params.limit === "number" && params.limit > 0
        ? Math.min(params.limit, 200)
        : 50;
    const page =
      typeof params.page === "number" && params.page > 0 ? params.page : 1;
    const skip = (page - 1) * limit;

    const queryText = params.query?.trim();
    const hasCodes = (params.codes?.length ?? 0) > 0;

    const total: number = await prisma.codeEntry.count({
      where: {
        system: "IDEXX",
        type: "TEST",
        active: true,
        ...(hasCodes ? { code: { in: params.codes } } : {}),
        ...(queryText
          ? {
              OR: [
                { code: { contains: queryText, mode: "insensitive" } },
                { display: { contains: queryText, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });
    const items: Array<{
      system: string;
      code: string;
      display: string;
      type: string;
      meta?: unknown;
    }> = await prisma.codeEntry.findMany({
      where: {
        system: "IDEXX",
        type: "TEST",
        active: true,
        ...(hasCodes ? { code: { in: params.codes } } : {}),
        ...(queryText
          ? {
              OR: [
                { code: { contains: queryText, mode: "insensitive" } },
                { display: { contains: queryText, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { display: "asc" },
      skip,
      take: limit,
      select: {
        system: true,
        code: true,
        display: true,
        type: true,
        meta: true,
      },
    });

    return { total, page, limit, tests: items };
  },
  async createOrder(providerInput: string, input: LabOrderCreateInput) {
    ensureNonEmpty(input.organisationId, "organisationId");
    ensureNonEmpty(input.patientId, "patientId");
    ensureTestsProvided(input.tests);

    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const adapter = getLabOrderAdapter(provider);
    const parentId =
      input.parentId ?? (await resolvePrimaryParentId(input.patientId));
    const appointmentId = input.appointmentId ?? null;

    const labOrder = await prisma.labOrder.create({
      data: {
        organisationId: input.organisationId,
        provider,
        patientId: input.patientId,
        parentId,
        appointmentId,
        createdByUserId: input.createdByUserId ?? null,
        status: "CREATED",
        modality: input.modality ?? "REFERENCE_LAB",
        tests: toJsonInput(input.tests),
        veterinarian: input.veterinarian ?? null,
        technician: input.technician ?? null,
        notes: input.notes ?? null,
        specimenCollectionDate: input.specimenCollectionDate ?? null,
        ivls: toJsonInput(input.ivls),
        requestPayload: undefined,
        responsePayload: undefined,
        invoiceId: null,
        billedAt: null,
        billingError: null,
      },
    });

    try {
      const result = await adapter.createOrder({
        ...input,
        parentId,
      });

      const updated = await prisma.labOrder.update({
        where: { id: labOrder.id },
        data: {
          idexxOrderId: result.idexxOrderId ?? null,
          uiUrl: result.uiUrl ?? null,
          pdfUrl: result.pdfUrl ?? null,
          status: (result.status as LabOrderStatus) ?? labOrder.status,
          externalStatus: result.externalStatus ?? null,
          requestPayload: toJsonInput(result.requestPayload),
          responsePayload: toJsonInput(result.responsePayload),
          modality: input.modality ?? labOrder.modality,
          ivls: toJsonInput(input.ivls),
        },
      });

      if (
        updated.status === "SUBMITTED" &&
        !updated.billedAt &&
        updated.appointmentId
      ) {
        try {
          const items = await buildInvoiceItemsFromTests(
            (updated.tests as string[]) ?? [],
          );
          const invoice = await InvoiceService.addChargesToAppointment(
            updated.appointmentId,
            items,
          );
          await prisma.labOrder.update({
            where: { id: updated.id },
            data: {
              invoiceId: invoice.id,
              billedAt: new Date(),
              billingError: null,
            },
          });
        } catch (billingError) {
          const message =
            billingError instanceof Error
              ? billingError.message
              : "Lab order billing failed.";
          await prisma.labOrder.update({
            where: { id: updated.id },
            data: { billingError: message },
          });
        }
      }

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Order creation failed.";
      await prisma.labOrder.update({
        where: { id: labOrder.id },
        data: { status: "ERROR", error: message },
      });

      logger.error("Lab order creation failed", error);
      throw new LabOrderServiceError("Lab order creation failed.", 502);
    }
  },

  async getOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const adapter = getLabOrderAdapter(provider);
    const existing = await prisma.labOrder.findFirst({
      where: {
        organisationId: safeOrganisationId,
        provider,
        idexxOrderId: safeIdexxOrderId,
      },
    });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const tests = toStringArray(existing.tests) ?? [];
    const ivls = toIvlsArray(existing.ivls);

    const result = await adapter.getOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      patientId: existing.patientId,
      parentId: existing.parentId,
      tests,
      modality: existing.modality ?? undefined,
      ivls,
    });

    const updated = await prisma.labOrder.update({
      where: { id: existing.id },
      data: {
        status: (result.status as LabOrderStatus) ?? existing.status,
        externalStatus:
          result.externalStatus ?? existing.externalStatus ?? null,
        uiUrl: result.uiUrl ?? existing.uiUrl ?? null,
        pdfUrl: result.pdfUrl ?? existing.pdfUrl ?? null,
        responsePayload: toJsonInput(result.responsePayload),
      },
    });
    await maybeBillSubmittedOrder(updated);
    return updated;
  },

  async updateOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
    input: LabOrderUpdateInput,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const existing = await prisma.labOrder.findFirst({
      where: {
        organisationId: safeOrganisationId,
        provider,
        idexxOrderId: safeIdexxOrderId,
      },
    });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    if (existing.status !== "CREATED") {
      throw new LabOrderServiceError(
        "Only CREATED orders can be updated.",
        400,
      );
    }
    if (input.tests?.length === 0) {
      throw new LabOrderServiceError("tests are required.", 400);
    }

    const adapter = getLabOrderAdapter(provider);
    const result = await adapter.updateOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      patientId: existing.patientId,
      parentId: existing.parentId,
      tests: input.tests ?? toStringArray(existing.tests) ?? [],
      modality: input.modality ?? existing.modality ?? undefined,
      ivls: input.ivls ?? toIvlsArray(existing.ivls) ?? undefined,
      veterinarian: input.veterinarian ?? existing.veterinarian ?? null,
      technician: input.technician ?? existing.technician ?? null,
      notes: input.notes ?? existing.notes ?? null,
      specimenCollectionDate:
        input.specimenCollectionDate ?? existing.specimenCollectionDate ?? null,
    });

    return prisma.labOrder.update({
      where: { id: existing.id },
      data: {
        status: (result.status as LabOrderStatus) ?? existing.status,
        externalStatus:
          result.externalStatus ?? existing.externalStatus ?? null,
        uiUrl: result.uiUrl ?? existing.uiUrl ?? null,
        pdfUrl: result.pdfUrl ?? existing.pdfUrl ?? null,
        requestPayload: toJsonInput(result.requestPayload),
        responsePayload: toJsonInput(result.responsePayload),
        tests: toJsonInput(input.tests ?? toStringArray(existing.tests) ?? []),
        modality: input.modality ?? existing.modality ?? null,
        ivls: toJsonInput(input.ivls ?? toIvlsArray(existing.ivls) ?? null),
        veterinarian: input.veterinarian ?? existing.veterinarian ?? null,
        technician: input.technician ?? existing.technician ?? null,
        notes: input.notes ?? existing.notes ?? null,
        specimenCollectionDate:
          input.specimenCollectionDate ??
          existing.specimenCollectionDate ??
          null,
      },
    });
  },

  async cancelOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const existing = await prisma.labOrder.findFirst({
      where: {
        organisationId: safeOrganisationId,
        provider,
        idexxOrderId: safeIdexxOrderId,
      },
    });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const adapter = getLabOrderAdapter(provider);
    const result = await adapter.cancelOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      patientId: existing.patientId,
      parentId: existing.parentId,
      tests: toStringArray(existing.tests) ?? [],
      modality: existing.modality ?? undefined,
      ivls: toIvlsArray(existing.ivls),
    });

    const updated = await prisma.labOrder.update({
      where: { id: existing.id },
      data: {
        status: (result.status as LabOrderStatus) ?? "CANCELLED",
        externalStatus:
          result.externalStatus ?? existing.externalStatus ?? null,
        responsePayload: toJsonInput(result.responsePayload),
      },
    });
    if (existing.invoiceId) {
      try {
        await InvoiceService.handleInvoiceCancellation(
          existing.invoiceId,
          "Lab order cancelled",
        );
      } catch (error) {
        logger.error("Failed to cancel/refund invoice for lab order", error);
      }
    }

    return updated;
  },

  async listOrders(params: {
    organisationId: string;
    appointmentId?: string;
    patientId?: string;
    provider?: string;
    status?: LabOrderStatus;
    limit?: number;
  }) {
    const {
      organisationId,
      appointmentId,
      patientId,
      provider,
      status,
      limit,
    } = params;

    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeAppointmentId = ensureOptionalString(
      appointmentId,
      "appointmentId",
    );
    const safeCompanionId = ensureOptionalString(patientId, "patientId");
    const safeProvider = ensureOptionalString(provider, "provider");
    const safeStatus = ensureOptionalStatus(status);
    const safeLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    const normalizedProvider = safeProvider
      ? normalizeLabProvider(safeProvider)
      : undefined;
    if (safeProvider && !normalizedProvider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    return prisma.labOrder.findMany({
      where: {
        organisationId: safeOrganisationId,
        ...(safeAppointmentId ? { appointmentId: safeAppointmentId } : {}),
        ...(safeCompanionId ? { patientId: safeCompanionId } : {}),
        ...(normalizedProvider ? { provider: normalizedProvider } : {}),
        ...(safeStatus ? { status: safeStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  },
};
