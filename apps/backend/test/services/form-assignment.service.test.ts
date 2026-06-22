import { prisma } from "src/config/prisma";
import {
  FormAssignmentService,
  FormAssignmentServiceError,
} from "../../src/services/form-assignment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    template: { findFirst: jest.fn() },
    templateVersion: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    formAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    parentPatient: { findMany: jest.fn() },
    parent: { findMany: jest.fn() },
    templateInstance: { findMany: jest.fn() },
  },
}));

describe("FormAssignmentService", () => {
  const mockedPrisma = prisma as unknown as {
    template: { findFirst: jest.Mock };
    templateVersion: { findFirst: jest.Mock };
    appointment: { findFirst: jest.Mock };
    formAssignment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    parentPatient: { findMany: jest.Mock };
    parent: { findMany: jest.Mock };
    templateInstance: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.template.findFirst.mockResolvedValue({
      id: "template-1",
      latestVersion: 3,
      publishedVersion: 2,
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValue({
      templateId: "template-1",
      version: 2,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      encounterId: "enc-1",
      patient: { id: "comp-1" },
    });
    mockedPrisma.formAssignment.create.mockResolvedValue({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: "user-1",
      signerName: "Alex Nurse",
      signerEmail: "alex@example.com",
      signerRole: "CLIENT",
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.findFirst.mockResolvedValue({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: "user-1",
      signerName: "Alex Nurse",
      signerEmail: "alex@example.com",
      signerRole: "CLIENT",
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.findMany.mockResolvedValue([]);
    mockedPrisma.formAssignment.update.mockImplementation(
      async (_args: unknown, data?: unknown) => data,
    );
  });

  it("creates a sent assignment from a template-backed form", async () => {
    const assignment = await FormAssignmentService.createForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      createdBy: "user-1",
      signerIdentity: {
        userId: "user-1",
        name: "Alex Nurse",
        email: "alex@example.com",
        role: "CLIENT",
      },
    });

    expect(mockedPrisma.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "template-1",
          organisationId: "org-1",
        }),
      }),
    );
    expect(mockedPrisma.formAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          mobileVisible: true,
          signingRequired: true,
          createdBy: "user-1",
        }),
      }),
    );
    expect(assignment.assignmentId).toBe("assignment-1");
    expect(assignment.status).toBe("sent");
    expect(assignment.signerIdentity).toEqual({
      userId: "user-1",
      name: "Alex Nurse",
      email: "alex@example.com",
      role: "CLIENT",
    });
  });

  it("falls back to the latest published template version when no version is provided", async () => {
    await FormAssignmentService.createForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      createdBy: "user-1",
    });

    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateId: "template-1",
          version: 2,
        },
      }),
    );
  });

  it("rejects assignments for missing templates", async () => {
    mockedPrisma.template.findFirst.mockResolvedValueOnce(null);

    await expect(
      FormAssignmentService.createForAppointment({
        organisationId: "org-1",
        appointmentId: "appt-1",
        templateId: "missing-template",
        createdBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(FormAssignmentServiceError);
  });

  it("returns mapped assignments for an appointment", async () => {
    mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 2,
        appointmentId: "appt-1",
        encounterId: "enc-1",
        companionId: "comp-1",
        signerUserId: null,
        signerName: null,
        signerEmail: null,
        signerRole: null,
        mobileVisible: true,
        signingRequired: true,
        status: "SENT",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: null,
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);

    const rows = await FormAssignmentService.listForAppointment(
      "org-1",
      "appt-1",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].signerIdentity).toBeNull();
  });

  it("prevents resend after cancellation", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "CANCELLED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: new Date("2026-06-14T10:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    await expect(
      FormAssignmentService.resend("assignment-1", "org-1", "user-2"),
    ).rejects.toBeInstanceOf(FormAssignmentServiceError);
  });

  it("cancels an active assignment and returns the updated row", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.update.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "CANCELLED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: new Date("2026-06-15T10:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: "user-2",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });

    const assignment = await FormAssignmentService.cancel(
      "assignment-1",
      "org-1",
      "user-2",
    );

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          updatedBy: "user-2",
        }),
      }),
    );
    expect(assignment.status).toBe("cancelled");
  });

  describe("listForOrganisation", () => {
    it("enriches rows with template, companion, primary parent, and signed doc", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([
        {
          id: "fa-1",
          templateId: "tpl-1",
          templateVersion: 3,
          companionId: "comp-1",
          appointmentId: "appt-1",
          status: "SIGNED",
          signingRequired: true,
          mobileVisible: true,
          viewedAt: new Date("2026-06-22T08:00:00.000Z"),
          submittedAt: new Date("2026-06-22T08:10:00.000Z"),
          signedAt: new Date("2026-06-22T08:15:00.000Z"),
          expiredAt: null,
          cancelledAt: null,
          template: { name: "Intake Form" },
          companion: { name: "Milo", parentLinks: [{ parentId: "par-1" }] },
        },
      ]);
      mockedPrisma.parent.findMany.mockResolvedValue([
        { id: "par-1", firstName: "Jane", lastName: "Doe" },
      ]);
      mockedPrisma.templateInstance.findMany.mockResolvedValue([
        {
          id: "inst-1",
          templateId: "tpl-1",
          templateVersion: 3,
          appointmentId: "appt-1",
          generatedPdfUrl: "https://pdf",
        },
      ]);

      const result = await FormAssignmentService.listForOrganisation("org-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "fa-1",
        templateName: "Intake Form",
        templateTitle: "Intake Form",
        companionName: "Milo",
        parentId: "par-1",
        parentName: "Jane Doe",
        status: "SIGNED",
        signedAt: "2026-06-22T08:15:00.000Z",
        signedDocument: { documentId: "inst-1", pdfUrl: "https://pdf" },
      });
      // DRAFT assignments must be filtered out of the default query.
      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org-1",
            status: { not: "DRAFT" },
          }),
        }),
      );
    });

    it("leaves signedDocument null when the assignment is not signed", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([
        {
          id: "fa-2",
          templateId: "tpl-1",
          templateVersion: 1,
          companionId: "comp-1",
          appointmentId: "appt-1",
          status: "SENT",
          signingRequired: true,
          mobileVisible: true,
          viewedAt: null,
          submittedAt: null,
          signedAt: null,
          expiredAt: null,
          cancelledAt: null,
          template: { name: "Intake Form" },
          companion: { name: "Milo", parentLinks: [] },
        },
      ]);

      const result = await FormAssignmentService.listForOrganisation("org-1");

      expect(result[0].signedDocument).toBeNull();
      expect(result[0].parentId).toBeNull();
      expect(result[0].parentName).toBeNull();
      // No signed rows => no template-instance lookup.
      expect(mockedPrisma.templateInstance.findMany).not.toHaveBeenCalled();
    });

    it("resolves a parentId filter to the parent's companions", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
      ]);
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation("org-1", {
        parentId: "par-9",
      });

      expect(mockedPrisma.parentPatient.findMany).toHaveBeenCalledWith({
        where: { parentId: "par-9" },
        select: { patientId: true },
      });
      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companionId: { in: ["comp-9"] } }),
        }),
      );
    });

    it("returns an empty list when a parent has no linked companions", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([]);

      const result = await FormAssignmentService.listForOrganisation("org-1", {
        parentId: "par-none",
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.formAssignment.findMany).not.toHaveBeenCalled();
    });

    it("intersects parentId and companionId: empty when companion is not the parent's", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
      ]);

      const result = await FormAssignmentService.listForOrganisation("org-1", {
        parentId: "par-9",
        companionId: "comp-OTHER",
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.formAssignment.findMany).not.toHaveBeenCalled();
    });

    it("intersects parentId and companionId: scopes to the companion when it belongs to the parent", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
        { patientId: "comp-10" },
      ]);
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation("org-1", {
        parentId: "par-9",
        companionId: "comp-9",
      });

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companionId: "comp-9" }),
        }),
      );
    });
  });
});
