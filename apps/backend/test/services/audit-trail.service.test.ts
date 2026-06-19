import {
  AuditTrailService,
  AuditTrailServiceError,
} from "../../src/services/audit-trail.service";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    auditTrail: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/utils/logger");

describe("AuditTrailService", () => {
  const baseInput = {
    organisationId: "org-1",
    patientId: "patient-1",
    eventType: "APPOINTMENT_CREATED" as const,
    actorType: "PARENT" as const,
    actorId: "parent-1",
    entityType: "APPOINTMENT" as const,
    entityId: "appointment-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({
      id: "audit-1",
      ...baseInput,
      occurredAt: new Date("2024-01-01T00:00:00.000Z"),
    });
  });

  it("records an audit entry in postgres", async () => {
    const occurredAt = new Date("2024-01-01T00:00:00.000Z");

    await AuditTrailService.record({
      ...baseInput,
      occurredAt,
      metadata: { appointmentId: "appointment-1" },
    });

    expect(prisma.auditTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org-1",
        patientId: "patient-1",
        eventType: "APPOINTMENT_CREATED",
        actorType: "PARENT",
        actorId: "parent-1",
        entityType: "APPOINTMENT",
        entityId: "appointment-1",
        occurredAt,
      }),
    });
  });

  it("resolves parent actor names from postgres", async () => {
    (prisma.parent.findFirst as jest.Mock).mockResolvedValueOnce({
      firstName: "Jane",
      lastName: "Doe",
    });

    await AuditTrailService.record({
      ...baseInput,
      actorName: undefined,
    });

    expect(prisma.parent.findFirst).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      select: { firstName: true, lastName: true },
    });
    expect(prisma.auditTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorName: "Jane Doe" }),
    });
  });

  it("resolves user actor names from postgres", async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
      firstName: "Admin",
      lastName: "User",
    });

    await AuditTrailService.record({
      ...baseInput,
      actorType: "PMS_USER",
      actorId: "user-1",
      actorName: undefined,
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { firstName: true, lastName: true },
    });
    expect(prisma.auditTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorName: "Admin User" }),
    });
  });

  it("validates unsafe string fields", async () => {
    await expect(
      AuditTrailService.record({ ...baseInput, organisationId: "" }),
    ).rejects.toThrow("organisationId is required");

    await expect(
      AuditTrailService.record({ ...baseInput, patientId: "bad.id" }),
    ).rejects.toThrow("Invalid patientId");
  });

  it("records safely without throwing on failure", async () => {
    (prisma.auditTrail.create as jest.Mock).mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      AuditTrailService.recordSafely(baseInput),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "Audit trail record failed",
      expect.any(Error),
    );
  });

  it("lists organisation audits with prisma filters", async () => {
    const occurredAt = new Date("2024-01-02T00:00:00.000Z");
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "audit-2", occurredAt },
    ]);

    const result = await AuditTrailService.listForOrganisation({
      organisationId: "org-1",
      patientId: "patient-1",
      eventTypes: ["APPOINTMENT_CREATED"],
      entityTypes: ["APPOINTMENT"],
      before: occurredAt,
      limit: 300,
    });

    expect(prisma.auditTrail.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        patientId: "patient-1",
        eventType: { in: ["APPOINTMENT_CREATED"] },
        entityType: { in: ["APPOINTMENT"] },
        occurredAt: { lt: occurredAt },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    expect(result.nextCursor).toBe(occurredAt.toISOString());
  });

  it("lists appointment audits with metadata lookup", async () => {
    const occurredAt = new Date("2024-01-03T00:00:00.000Z");
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "audit-3", occurredAt },
    ]);

    const result = await AuditTrailService.listForAppointment({
      organisationId: "org-1",
      appointmentId: "appointment-1",
      before: occurredAt,
    });

    expect(prisma.auditTrail.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        OR: [
          { entityType: "APPOINTMENT", entityId: "appointment-1" },
          {
            metadata: {
              path: ["appointmentId"],
              equals: "appointment-1",
            },
          },
        ],
        occurredAt: { lt: occurredAt },
      },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });
    expect(result.nextCursor).toBe(occurredAt.toISOString());
  });

  it("exposes the custom error shape", () => {
    const error = new AuditTrailServiceError("boom", 418);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuditTrailServiceError");
    expect(error.statusCode).toBe(418);
  });
});
