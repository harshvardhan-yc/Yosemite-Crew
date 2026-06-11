import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CaseEncounterService,
  CaseEncounterServiceError,
} from "../../src/services/case-encounter.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    case: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    encounter: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

const baseCaseRow = {
  id: "case_1",
  organisationId: "org_1",
  companionId: "comp_1",
  parentId: "parent_1",
  status: "active",
  appointmentKind: "INPATIENT" as const,
  title: "Case title",
  description: "Case description",
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

const baseEncounterRow = {
  id: "enc_1",
  caseId: "case_1",
  organisationId: "org_1",
  companionId: "comp_1",
  parentId: "parent_1",
  status: "planned",
  encounterClass: "IMP",
  appointmentKind: "INPATIENT" as const,
  title: "Admission encounter",
  reason: "Observation",
  periodStart: new Date("2026-06-11T10:30:00.000Z"),
  periodEnd: new Date("2026-06-11T11:00:00.000Z"),
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

describe("CaseEncounterService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockedPrisma),
    );
    mockedPrisma.admission.findMany.mockResolvedValue([] as never);
  });

  it("creates a case", async () => {
    mockedPrisma.case.create.mockResolvedValue(baseCaseRow as never);

    const result = await CaseEncounterService.createCase({
      organisationId: "org_1",
      companionId: "comp_1",
      parentId: "parent_1",
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Case title",
      description: "Case description",
    });

    expect(mockedPrisma.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org_1",
        companionId: "comp_1",
        status: "active",
        appointmentKind: "INPATIENT",
      }),
    });
    expect(result.id).toBe("case_1");
  });

  it("creates an encounter and links the appointment", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      companion: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.create.mockResolvedValue(baseEncounterRow as never);
    mockedPrisma.appointment.update.mockResolvedValue({
      id: "appt_1",
    } as never);

    const result = await CaseEncounterService.createEncounter({
      caseId: "case_1",
      appointmentId: "appt_1",
      organisationId: "org_1",
      companionId: "comp_1",
      parentId: "parent_1",
      status: "planned",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Admission encounter",
      reason: "Observation",
      periodStart: new Date("2026-06-11T10:30:00.000Z"),
      periodEnd: new Date("2026-06-11T11:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.create).toHaveBeenCalled();
    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.appointmentId).toBe("appt_1");
  });

  it("rejects encounter creation when appointment belongs to another companion", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      companion: { id: "comp_2" },
    } as never);

    await expect(
      CaseEncounterService.createEncounter({
        caseId: "case_1",
        appointmentId: "appt_1",
        organisationId: "org_1",
        companionId: "comp_1",
        status: "planned",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
      }),
    ).rejects.toMatchObject({
      message: "Encounter appointment companion mismatch.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("updates an encounter and re-links the appointment", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt_old",
      caseId: "case_1",
      encounterId: "enc_1",
      organisationId: "org_1",
      companion: { id: "comp_1" },
    } as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_new",
      caseId: "case_1",
      encounterId: null,
      organisationId: "org_1",
      companion: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "arrived",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_new", encounterId: "enc_1" },
    ] as never);

    const result = await CaseEncounterService.updateEncounter("enc_1", {
      appointmentId: "appt_new",
      status: "arrived",
    });

    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "appt_old" },
      data: { encounterId: null },
    });
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(2, {
      where: { id: "appt_new" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.status).toBe("arrived");
    expect(result.appointmentId).toBe("appt_new");
  });

  it("gets an encounter with its linked appointment id", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        companionId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.getEncounterById("enc_1");

    expect(result.id).toBe("enc_1");
    expect(result.appointmentId).toBe("appt_1");
    expect(result.admission?.encounterId).toBe("enc_1");
  });

  it("lists encounters with linked appointment ids", async () => {
    mockedPrisma.encounter.findMany.mockResolvedValue([
      baseEncounterRow,
      { ...baseEncounterRow, id: "enc_2", caseId: "case_2" },
    ] as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
      { id: "appt_2", encounterId: "enc_2" },
    ] as never);

    const results = await CaseEncounterService.listEncounters({
      organisationId: "org_1",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.appointmentId).toBe("appt_1");
    expect(results[1]?.appointmentId).toBe("appt_2");
  });

  it("discharges an inpatient encounter and closes admission", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      companionId: "comp_1",
      bedUnitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
      periodEnd: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        companionId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.dischargeEncounter("enc_1", {
      dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      data: {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "finished",
        periodEnd: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(result.status).toBe("finished");
    expect(result.admission?.dischargedAt?.toISOString()).toBe(
      "2026-06-11T12:00:00.000Z",
    );
  });
});
