import { prisma } from "src/config/prisma";
import type {
  AppointmentKind,
  Case as CaseDomain,
  CaseStatus,
  Encounter as EncounterDomain,
  EncounterClass,
  EncounterStatus,
} from "@yosemite-crew/types";

type CaseRow = {
  id: string;
  organisationId: string;
  companionId: string;
  parentId: string | null;
  status: string;
  appointmentKind: AppointmentKind;
  title: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EncounterRow = {
  id: string;
  caseId: string;
  organisationId: string;
  companionId: string;
  parentId: string | null;
  status: string;
  encounterClass: string;
  appointmentKind: AppointmentKind;
  title: string | null;
  reason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppointmentLinkRow = {
  id: string;
  caseId: string | null;
  encounterId: string | null;
  organisationId: string;
  companion: unknown;
};

export class CaseEncounterServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CaseEncounterServiceError";
  }
}

const CASE_STATUSES = new Set<CaseStatus>([
  "planned",
  "waitlist",
  "active",
  "onhold",
  "finished",
  "cancelled",
  "entered-in-error",
]);

const ENCOUNTER_STATUSES = new Set<EncounterStatus>([
  "planned",
  "arrived",
  "triaged",
  "in-progress",
  "onleave",
  "finished",
  "cancelled",
]);

const ENCOUNTER_CLASSES = new Set<EncounterClass>([
  "AMB",
  "IMP",
  "EMER",
  "OBSENC",
  "VR",
]);

const requireString = (value: string | undefined, field: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new CaseEncounterServiceError(`${field} is required.`, 400);
  }
  return trimmed;
};

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toCaseStatus = (status: string): CaseStatus => {
  if (!CASE_STATUSES.has(status as CaseStatus)) {
    throw new CaseEncounterServiceError("Invalid case status.", 400);
  }

  return status as CaseStatus;
};

const toEncounterStatus = (status: string): EncounterStatus => {
  if (!ENCOUNTER_STATUSES.has(status as EncounterStatus)) {
    throw new CaseEncounterServiceError("Invalid encounter status.", 400);
  }

  return status as EncounterStatus;
};

const toEncounterClass = (value: string): EncounterClass => {
  if (!ENCOUNTER_CLASSES.has(value as EncounterClass)) {
    throw new CaseEncounterServiceError("Invalid encounter class.", 400);
  }

  return value as EncounterClass;
};

const assertPeriod = (start?: Date, end?: Date) => {
  if (start && Number.isNaN(start.getTime())) {
    throw new CaseEncounterServiceError("Invalid encounter periodStart.", 400);
  }

  if (end && Number.isNaN(end.getTime())) {
    throw new CaseEncounterServiceError("Invalid encounter periodEnd.", 400);
  }

  if (start && end && end < start) {
    throw new CaseEncounterServiceError(
      "periodEnd must be after periodStart.",
      400,
    );
  }
};

const toCaseDomain = (row: CaseRow): CaseDomain => ({
  id: row.id,
  organisationId: row.organisationId,
  companionId: row.companionId,
  parentId: row.parentId ?? undefined,
  status: row.status as CaseStatus,
  appointmentKind: row.appointmentKind,
  title: row.title ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toEncounterDomain = (row: EncounterRow): EncounterDomain => ({
  id: row.id,
  caseId: row.caseId,
  organisationId: row.organisationId,
  companionId: row.companionId,
  parentId: row.parentId ?? undefined,
  status: row.status as EncounterStatus,
  encounterClass: row.encounterClass as EncounterClass,
  appointmentKind: row.appointmentKind,
  title: row.title ?? undefined,
  reason: row.reason ?? undefined,
  periodStart: row.periodStart ?? undefined,
  periodEnd: row.periodEnd ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toAppointmentCompanionId = (value: unknown): string =>
  ((value as { id?: string } | null)?.id ?? "").trim();

const attachEncounterAppointmentIds = async (
  encounters: EncounterDomain[],
): Promise<EncounterDomain[]> => {
  if (encounters.length === 0) {
    return encounters;
  }

  const appointmentLinks = (await prisma.appointment.findMany({
    where: {
      encounterId: {
        in: encounters
          .map((encounter) => encounter.id)
          .filter((value): value is string => Boolean(value)),
      },
    },
    select: {
      id: true,
      encounterId: true,
    },
  })) as Array<{ id: string; encounterId: string | null }>;

  const appointmentIdByEncounterId = new Map<string, string>();
  for (const appointment of appointmentLinks) {
    if (appointment.encounterId) {
      appointmentIdByEncounterId.set(appointment.encounterId, appointment.id);
    }
  }

  return encounters.map((encounter) => ({
    ...encounter,
    appointmentId:
      encounter.id == null
        ? encounter.appointmentId
        : (appointmentIdByEncounterId.get(encounter.id) ??
          encounter.appointmentId),
  }));
};

export const CaseEncounterService = {
  async createCase(input: CaseDomain): Promise<CaseDomain> {
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const companionId = requireString(input.companionId, "companionId");
    const status = toCaseStatus(input.status);

    const created = await prisma.case.create({
      data: {
        organisationId,
        companionId,
        parentId: normalizeOptionalString(input.parentId) ?? null,
        status,
        appointmentKind: input.appointmentKind,
        title: normalizeOptionalString(input.title) ?? null,
        description: normalizeOptionalString(input.description) ?? null,
      },
    });

    return toCaseDomain(created as CaseRow);
  },

  async updateCase(
    caseId: string,
    input: Partial<CaseDomain>,
  ): Promise<CaseDomain> {
    const id = requireString(caseId, "caseId");
    const status = input.status ? toCaseStatus(input.status) : undefined;

    const existing = await prisma.case.findUnique({ where: { id } });
    if (!existing) {
      throw new CaseEncounterServiceError("Case not found.", 404);
    }

    const updated = await prisma.case.update({
      where: { id },
      data: {
        status,
        appointmentKind: input.appointmentKind ?? undefined,
        parentId:
          input.parentId === undefined
            ? undefined
            : (normalizeOptionalString(input.parentId) ?? null),
        title:
          input.title === undefined
            ? undefined
            : (normalizeOptionalString(input.title) ?? null),
        description:
          input.description === undefined
            ? undefined
            : (normalizeOptionalString(input.description) ?? null),
      },
    });

    return toCaseDomain(updated as CaseRow);
  },

  async getCaseById(caseId: string): Promise<CaseDomain> {
    const id = requireString(caseId, "caseId");
    const row = await prisma.case.findUnique({ where: { id } });
    if (!row) {
      throw new CaseEncounterServiceError("Case not found.", 404);
    }
    return toCaseDomain(row as CaseRow);
  },

  async listCases(filters: {
    organisationId?: string;
    companionId?: string;
    parentId?: string;
    status?: CaseStatus;
    appointmentKind?: AppointmentKind;
  }) {
    const rows = (await prisma.case.findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        companionId: normalizeOptionalString(filters.companionId),
        parentId: normalizeOptionalString(filters.parentId),
        status: filters.status,
        appointmentKind: filters.appointmentKind,
      },
      orderBy: { updatedAt: "desc" },
    })) as CaseRow[];

    return rows.map(toCaseDomain);
  },

  async createEncounter(input: EncounterDomain): Promise<EncounterDomain> {
    const caseId = requireString(input.caseId, "caseId");
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const companionId = requireString(input.companionId, "companionId");
    const status = toEncounterStatus(input.status);
    const encounterClass = toEncounterClass(input.encounterClass);
    assertPeriod(input.periodStart, input.periodEnd);

    const created = await prisma.$transaction(async (tx) => {
      const caseRow = await tx.case.findUnique({ where: { id: caseId } });
      if (!caseRow) {
        throw new CaseEncounterServiceError("Case not found.", 404);
      }

      if (caseRow.organisationId !== organisationId) {
        throw new CaseEncounterServiceError(
          "Encounter organisationId must match case organisationId.",
          409,
        );
      }

      if (caseRow.companionId !== companionId) {
        throw new CaseEncounterServiceError(
          "Encounter companionId must match case companionId.",
          409,
        );
      }

      const appointmentId = normalizeOptionalString(input.appointmentId);
      if (appointmentId) {
        const appointment = (await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            id: true,
            caseId: true,
            encounterId: true,
            organisationId: true,
            companion: true,
          },
        })) as AppointmentLinkRow | null;

        if (!appointment) {
          throw new CaseEncounterServiceError("Appointment not found.", 404);
        }

        if (appointment.organisationId !== organisationId) {
          throw new CaseEncounterServiceError(
            "Encounter appointment organisation mismatch.",
            409,
          );
        }

        if (toAppointmentCompanionId(appointment.companion) !== companionId) {
          throw new CaseEncounterServiceError(
            "Encounter appointment companion mismatch.",
            409,
          );
        }

        if (appointment.caseId && appointment.caseId !== caseId) {
          throw new CaseEncounterServiceError(
            "Appointment is already linked to a different case.",
            409,
          );
        }

        if (appointment.encounterId) {
          throw new CaseEncounterServiceError(
            "Appointment is already linked to a different encounter.",
            409,
          );
        }
      }

      const createdEncounter = await tx.encounter.create({
        data: {
          caseId,
          organisationId,
          companionId,
          parentId: normalizeOptionalString(input.parentId) ?? null,
          status,
          encounterClass,
          appointmentKind: input.appointmentKind,
          title: normalizeOptionalString(input.title) ?? null,
          reason: normalizeOptionalString(input.reason) ?? null,
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
        },
      });

      if (appointmentId) {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            caseId,
            encounterId: createdEncounter.id,
          },
        });
      }

      return createdEncounter;
    });

    return {
      ...toEncounterDomain(created as EncounterRow),
      appointmentId: normalizeOptionalString(input.appointmentId),
    };
  },

  async updateEncounter(
    encounterId: string,
    input: Partial<EncounterDomain>,
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const status = input.status ? toEncounterStatus(input.status) : undefined;
    const encounterClass = input.encounterClass
      ? toEncounterClass(input.encounterClass)
      : undefined;
    assertPeriod(input.periodStart, input.periodEnd);

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const row = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;
      if (!row) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      const nextCaseId = normalizeOptionalString(input.caseId) ?? row.caseId;
      const nextOrganisationId =
        normalizeOptionalString(input.organisationId) ?? row.organisationId;
      const nextCompanionId =
        normalizeOptionalString(input.companionId) ?? row.companionId;

      if (
        nextCaseId !== row.caseId ||
        nextOrganisationId !== row.organisationId ||
        nextCompanionId !== row.companionId
      ) {
        throw new CaseEncounterServiceError(
          "caseId, organisationId and companionId cannot be changed for an encounter.",
          400,
        );
      }

      const currentAppointment = (await tx.appointment.findFirst({
        where: { encounterId: id },
        select: {
          id: true,
          caseId: true,
          encounterId: true,
          organisationId: true,
          companion: true,
        },
      })) as AppointmentLinkRow | null;

      const nextAppointmentId =
        input.appointmentId === undefined
          ? undefined
          : (normalizeOptionalString(input.appointmentId) ?? null);

      if (
        nextAppointmentId !== undefined &&
        nextAppointmentId !== currentAppointment?.id
      ) {
        if (currentAppointment) {
          await tx.appointment.update({
            where: { id: currentAppointment.id },
            data: {
              encounterId: null,
            },
          });
        }

        if (nextAppointmentId) {
          const nextAppointment = (await tx.appointment.findUnique({
            where: { id: nextAppointmentId },
            select: {
              id: true,
              caseId: true,
              encounterId: true,
              organisationId: true,
              companion: true,
            },
          })) as AppointmentLinkRow | null;

          if (!nextAppointment) {
            throw new CaseEncounterServiceError("Appointment not found.", 404);
          }

          if (nextAppointment.organisationId !== row.organisationId) {
            throw new CaseEncounterServiceError(
              "Encounter appointment organisation mismatch.",
              409,
            );
          }

          if (
            toAppointmentCompanionId(nextAppointment.companion) !==
            row.companionId
          ) {
            throw new CaseEncounterServiceError(
              "Encounter appointment companion mismatch.",
              409,
            );
          }

          if (nextAppointment.caseId && nextAppointment.caseId !== row.caseId) {
            throw new CaseEncounterServiceError(
              "Appointment is already linked to a different case.",
              409,
            );
          }

          if (
            nextAppointment.encounterId &&
            nextAppointment.encounterId !== id
          ) {
            throw new CaseEncounterServiceError(
              "Appointment is already linked to a different encounter.",
              409,
            );
          }

          await tx.appointment.update({
            where: { id: nextAppointmentId },
            data: {
              caseId: row.caseId,
              encounterId: id,
            },
          });
        }
      }

      return (await tx.encounter.update({
        where: { id },
        data: {
          status,
          encounterClass,
          appointmentKind: input.appointmentKind ?? undefined,
          parentId:
            input.parentId === undefined
              ? undefined
              : (normalizeOptionalString(input.parentId) ?? null),
          title:
            input.title === undefined
              ? undefined
              : (normalizeOptionalString(input.title) ?? null),
          reason:
            input.reason === undefined
              ? undefined
              : (normalizeOptionalString(input.reason) ?? null),
          periodStart: input.periodStart ?? undefined,
          periodEnd: input.periodEnd ?? undefined,
        },
      })) as EncounterRow;
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async getEncounterById(encounterId: string): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const row = await prisma.encounter.findUnique({ where: { id } });
    if (!row) {
      throw new CaseEncounterServiceError("Encounter not found.", 404);
    }
    return (
      await attachEncounterAppointmentIds([
        toEncounterDomain(row as EncounterRow),
      ])
    )[0];
  },

  async listEncounters(filters: {
    organisationId?: string;
    caseId?: string;
    companionId?: string;
    parentId?: string;
    status?: EncounterStatus;
    appointmentKind?: AppointmentKind;
  }) {
    const rows = (await prisma.encounter.findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        caseId: normalizeOptionalString(filters.caseId),
        companionId: normalizeOptionalString(filters.companionId),
        parentId: normalizeOptionalString(filters.parentId),
        status: filters.status,
        appointmentKind: filters.appointmentKind,
      },
      orderBy: { updatedAt: "desc" },
    })) as EncounterRow[];

    return attachEncounterAppointmentIds(rows.map(toEncounterDomain));
  },
};
