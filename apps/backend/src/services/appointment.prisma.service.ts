import dayjs from "dayjs";
import { Prisma } from "@prisma/client";
import {
  Appointment as AppointmentDomain,
  AppointmentKind,
  AppointmentPaymentStatus,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";

type AppointmentStatus = AppointmentDomain["status"];

type AppointmentRow = {
  id: string;
  companion: Prisma.JsonValue;
  lead: Prisma.JsonValue | null;
  supportStaff: Prisma.JsonValue | null;
  room: Prisma.JsonValue | null;
  appointmentType: Prisma.JsonValue | null;
  appointmentKind: AppointmentKind;
  caseId: string | null;
  encounterId: string | null;
  productItemId: string | null;
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  endTime: Date;
  timeSlot: string;
  durationMinutes: number;
  status: AppointmentStatus;
  isEmergency: boolean;
  concern: string | null;
  attachments: Prisma.JsonValue | null;
  formIds: string[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class AppointmentPrismaServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppointmentPrismaServiceError";
  }
}

type RescheduleChanges = {
  startTime: string | Date;
  endTime: string | Date;
  concern?: string;
  isEmergency?: boolean;
  durationMinutes?: number;
};

type AppointmentListFilters = {
  organisationId?: string;
  companionId?: string;
  parentId?: string;
  leadId?: string;
  status?: AppointmentStatus[];
  startDate?: Date;
  endDate?: Date;
};

const DEFAULT_KIND: AppointmentKind = "OUTPATIENT";
const BOOKABLE_INVOICE_STATUSES = [
  "PAID",
  "PENDING",
  "AWAITING_PAYMENT",
  "FAILED",
  "REFUNDED",
] as const;

const toDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toJsonValue = <T>(value: T): Prisma.InputJsonValue =>
  value as unknown as Prisma.InputJsonValue;

const toNullableJsonValue = (
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined =>
  value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const normalizeAppointmentKind = (
  value?: AppointmentKind | null,
): AppointmentKind => (value === "INPATIENT" ? "INPATIENT" : DEFAULT_KIND);

const assertExists = <T>(value: T | null | undefined, message: string): T => {
  if (value == null) {
    throw new AppointmentPrismaServiceError(message, 404);
  }
  return value;
};

const assertAppointmentTransition = (
  current: AppointmentStatus,
  next: AppointmentStatus,
  context: string,
) => {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    REQUESTED: ["UPCOMING", "CANCELLED"],
    UPCOMING: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "REQUESTED"],
    CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

  if (current === next) return;
  if (!transitions[current].includes(next)) {
    throw new AppointmentPrismaServiceError(
      `Appointment cannot transition from ${current} to ${next} in ${context}.`,
      409,
    );
  }
};

const buildWhereFromFilters = (
  filters: AppointmentListFilters,
): Prisma.AppointmentWhereInput => {
  const where: Prisma.AppointmentWhereInput = {};
  const and: Prisma.AppointmentWhereInput[] = [];

  if (filters.organisationId) {
    where.organisationId = filters.organisationId;
  }

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.startDate || filters.endDate) {
    where.startTime = {
      gte: filters.startDate ?? undefined,
      lte: filters.endDate ?? undefined,
    };
  }

  if (filters.companionId) {
    and.push({
      companion: {
        path: ["id"],
        equals: filters.companionId,
      } as never,
    });
  }

  if (filters.parentId) {
    and.push({
      companion: {
        path: ["parent", "id"],
        equals: filters.parentId,
      } as never,
    });
  }

  if (filters.leadId) {
    and.push({
      lead: {
        path: ["id"],
        equals: filters.leadId,
      } as never,
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
};

const resolvePaymentStatusMap = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const uniqueIds = [...new Set(appointmentIds.filter(Boolean))];
  const paymentStatusMap = new Map<string, AppointmentPaymentStatus>();

  if (!uniqueIds.length) {
    return paymentStatusMap;
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      appointmentId: { in: uniqueIds },
      status: { in: [...BOOKABLE_INVOICE_STATUSES] },
    },
    select: {
      appointmentId: true,
      status: true,
    },
  });

  const tracker = new Map<string, { hasPaid: boolean; hasUnpaid: boolean }>();

  for (const invoice of invoices) {
    if (!invoice.appointmentId) continue;
    const entry = tracker.get(invoice.appointmentId) ?? {
      hasPaid: false,
      hasUnpaid: false,
    };

    if (invoice.status === "PAID") {
      entry.hasPaid = true;
    } else {
      entry.hasUnpaid = true;
    }

    tracker.set(invoice.appointmentId, entry);
  }

  for (const [appointmentId, entry] of tracker) {
    paymentStatusMap.set(
      appointmentId,
      entry.hasPaid && !entry.hasUnpaid ? "PAID" : "UNPAID",
    );
  }

  return paymentStatusMap;
};

const toDomain = (
  row: AppointmentRow,
  paymentStatus?: AppointmentPaymentStatus,
): AppointmentDomain => ({
  id: row.id,
  companion: row.companion as AppointmentDomain["companion"],
  lead: (row.lead as AppointmentDomain["lead"]) ?? undefined,
  supportStaff:
    (row.supportStaff as AppointmentDomain["supportStaff"]) ?? undefined,
  room: (row.room as AppointmentDomain["room"]) ?? undefined,
  appointmentType:
    (row.appointmentType as AppointmentDomain["appointmentType"]) ?? undefined,
  appointmentKind: normalizeAppointmentKind(row.appointmentKind),
  organisationId: row.organisationId,
  appointmentDate: new Date(row.appointmentDate),
  startTime: new Date(row.startTime),
  timeSlot: row.timeSlot,
  durationMinutes: row.durationMinutes,
  endTime: new Date(row.endTime),
  status: row.status,
  paymentStatus,
  isEmergency: row.isEmergency,
  concern: row.concern ?? undefined,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
  attachments:
    (row.attachments as AppointmentDomain["attachments"]) ?? undefined,
  formIds: row.formIds ?? [],
});

const toResponse = async (
  row: AppointmentRow,
): Promise<AppointmentResponseDTO> => {
  const paymentStatusMap = await resolvePaymentStatusMap([row.id]);
  return toAppointmentResponseDTO(
    toDomain(row, paymentStatusMap.get(row.id) ?? "UNPAID"),
  );
};

const toResponseList = async (
  rows: AppointmentRow[],
): Promise<AppointmentResponseDTO[]> => {
  if (!rows.length) return [];

  const paymentStatusMap = await resolvePaymentStatusMap(
    rows.map((row) => row.id),
  );
  return rows.map((row) =>
    toAppointmentResponseDTO(
      toDomain(row, paymentStatusMap.get(row.id) ?? "UNPAID"),
    ),
  );
};

const createAppointment = async (
  dto: AppointmentRequestDTO,
  status: AppointmentStatus,
): Promise<AppointmentResponseDTO> => {
  const input = fromAppointmentRequestDTO(dto);
  const created = await prisma.appointment.create({
    data: {
      companion: toJsonValue(input.companion),
      lead: input.lead ? toJsonValue(input.lead) : Prisma.JsonNull,
      supportStaff: input.supportStaff ? toJsonValue(input.supportStaff) : [],
      room: input.room ? toJsonValue(input.room) : Prisma.JsonNull,
      appointmentType: input.appointmentType
        ? toJsonValue(input.appointmentType)
        : Prisma.JsonNull,
      appointmentKind: normalizeAppointmentKind(input.appointmentKind),
      organisationId: input.organisationId,
      appointmentDate: input.appointmentDate,
      startTime: input.startTime,
      endTime: input.endTime,
      timeSlot: input.timeSlot,
      durationMinutes: input.durationMinutes,
      status,
      isEmergency: input.isEmergency ?? false,
      concern: input.concern ?? null,
      attachments: input.attachments
        ? toJsonValue(input.attachments)
        : Prisma.JsonNull,
      formIds: input.formIds ?? [],
      caseId: null,
      encounterId: null,
      productItemId: null,
      expiresAt: null,
    },
  });

  return toResponse(created as AppointmentRow);
};

const applyDtoPatch = (
  current: AppointmentRow,
  dto: AppointmentRequestDTO,
  nextStatus?: AppointmentStatus,
) => {
  const input = fromAppointmentRequestDTO(dto);

  return {
    companion: toJsonValue(input.companion),
    lead:
      input.lead === undefined
        ? toNullableJsonValue(current.lead)
        : toJsonValue(input.lead),
    supportStaff:
      input.supportStaff === undefined
        ? toNullableJsonValue(current.supportStaff)
        : toJsonValue(input.supportStaff),
    room:
      input.room === undefined
        ? toNullableJsonValue(current.room)
        : toJsonValue(input.room),
    appointmentType:
      input.appointmentType === undefined
        ? toNullableJsonValue(current.appointmentType)
        : toJsonValue(input.appointmentType),
    appointmentKind: normalizeAppointmentKind(
      input.appointmentKind ?? current.appointmentKind,
    ),
    appointmentDate: input.appointmentDate ?? current.appointmentDate,
    startTime: input.startTime ?? current.startTime,
    endTime: input.endTime ?? current.endTime,
    timeSlot: input.timeSlot || current.timeSlot,
    durationMinutes: input.durationMinutes || current.durationMinutes,
    status: nextStatus ?? input.status ?? current.status,
    isEmergency: input.isEmergency ?? current.isEmergency,
    concern: input.concern ?? current.concern,
    attachments:
      input.attachments === undefined
        ? toNullableJsonValue(current.attachments)
        : toJsonValue(input.attachments),
    formIds: input.formIds ?? current.formIds,
  };
};

export const AppointmentPrismaService = {
  async createRequestedFromMobile(dto: AppointmentRequestDTO) {
    return createAppointment(dto, "REQUESTED");
  },

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    _createPayment = false,
    _paymentCollectionMethod?: string,
  ) {
    void _createPayment;
    void _paymentCollectionMethod;
    return createAppointment(dto, "UPCOMING");
  },

  async approveRequestedFromPms(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(
      row.status,
      "UPCOMING",
      "approveRequestedFromPms",
    );

    const patch = applyDtoPatch(row, dto, "UPCOMING");
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...patch,
        updatedAt: new Date(),
      },
    });

    return toResponse(updated as AppointmentRow);
  },

  async rejectRequestedAppointment(appointmentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(
      row.status,
      "CANCELLED",
      "rejectRequestedAppointment",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async checkInAppointmentParent(appointmentId: string, parentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    assertAppointmentTransition(
      row.status,
      "CHECKED_IN",
      "checkInAppointmentParent",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CHECKED_IN", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async checkInAppointment(appointmentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(row.status, "CHECKED_IN", "checkInAppointment");

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CHECKED_IN", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async rescheduleFromParent(
    appointmentId: string,
    parentId: string,
    changes: RescheduleChanges,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    if (row.status === "COMPLETED" || row.status === "CANCELLED") {
      throw new AppointmentPrismaServiceError(
        "Completed or cancelled appointments cannot be rescheduled.",
        400,
      );
    }

    const newStart = toDate(changes.startTime);
    const newEnd = toDate(changes.endTime);
    const nextStatus = row.status === "UPCOMING" ? "REQUESTED" : row.status;
    assertAppointmentTransition(row.status, nextStatus, "rescheduleFromParent");

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startTime: newStart,
        endTime: newEnd,
        appointmentDate: newStart,
        timeSlot: dayjs(newStart).format("HH:mm"),
        durationMinutes:
          typeof changes.durationMinutes === "number"
            ? changes.durationMinutes
            : dayjs(newEnd).diff(dayjs(newStart), "minute"),
        concern:
          typeof changes.concern === "string" ? changes.concern : row.concern,
        isEmergency:
          typeof changes.isEmergency === "boolean"
            ? changes.isEmergency
            : row.isEmergency,
        status: nextStatus,
        lead:
          nextStatus === "REQUESTED"
            ? Prisma.JsonNull
            : toNullableJsonValue(row.lead),
        supportStaff:
          nextStatus === "REQUESTED"
            ? []
            : toNullableJsonValue(row.supportStaff),
        room:
          nextStatus === "REQUESTED"
            ? Prisma.JsonNull
            : toNullableJsonValue(row.room),
        updatedAt: new Date(),
      },
    });

    return toResponse(updated as AppointmentRow);
  },

  async updateAppointmentPMS(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const patch = applyDtoPatch(row, dto, row.status);

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...patch,
        updatedAt: new Date(),
      },
    });

    return toResponse(updated as AppointmentRow);
  },

  async cancelAppointmentFromParent(
    appointmentId: string,
    parentId: string,
    _reason?: string,
  ) {
    void _reason;
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    assertAppointmentTransition(
      row.status,
      "CANCELLED",
      "cancelAppointmentFromParent",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async cancelAppointment(appointmentId: string, _reason?: string) {
    void _reason;
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(row.status, "CANCELLED", "cancelAppointment");

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async getById(appointmentId: string): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError(
        "Appointment ID is required",
        400,
      );
    }

    const row = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!row) {
      throw new AppointmentPrismaServiceError("Appointment not found", 404);
    }

    return toResponse(row as AppointmentRow);
  },

  async getAppointmentsForCompanion(
    companionId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!companionId) {
      throw new AppointmentPrismaServiceError("companionId is required", 400);
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        companion: { path: ["id"], equals: companionId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForCompanionByOrganisation(
    companionId: string,
    organisationId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!companionId) {
      throw new AppointmentPrismaServiceError("companionId is required", 400);
    }
    if (!organisationId) {
      throw new AppointmentPrismaServiceError(
        "organisationId is required",
        400,
      );
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        organisationId,
        companion: { path: ["id"], equals: companionId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForParent(
    parentId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        companion: { path: ["parent", "id"], equals: parentId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForOrganisation(
    organisationId: string,
    filters?: {
      status?: AppointmentStatus[];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AppointmentResponseDTO[]> {
    if (!organisationId) {
      throw new AppointmentPrismaServiceError(
        "organisationId is required",
        400,
      );
    }

    const where = buildWhereFromFilters({
      organisationId,
      status: filters?.status,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    const rows = (await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForLead(
    leadId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!leadId) {
      throw new AppointmentPrismaServiceError("leadId is required", 400);
    }

    const where = buildWhereFromFilters({
      leadId,
      organisationId,
    });

    const rows = (await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async attachFormsToAppointment(
    appointmentId: string,
    formIds: string[],
  ): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const nextFormIds = Array.from(
      new Set([...(row.formIds ?? []), ...(formIds ?? [])]),
    ).filter(Boolean);

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { formIds: nextFormIds, updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },
};
