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
    formSubmission: { findMany: jest.fn() },
    formAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("FormAssignmentService", () => {
  const mockedPrisma = prisma as unknown as {
    template: { findFirst: jest.Mock };
    templateVersion: { findFirst: jest.Mock };
    appointment: { findFirst: jest.Mock };
    formSubmission: { findMany: jest.Mock };
    formAssignment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.template.findFirst.mockReset();
    mockedPrisma.templateVersion.findFirst.mockReset();
    mockedPrisma.appointment.findFirst.mockReset();
    mockedPrisma.formSubmission.findMany.mockReset();
    mockedPrisma.formAssignment.create.mockReset();
    mockedPrisma.formAssignment.findFirst.mockReset();
    mockedPrisma.formAssignment.findMany.mockReset();
    mockedPrisma.formAssignment.update.mockReset();
    mockedPrisma.formAssignment.updateMany.mockReset();

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
    mockedPrisma.formAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.formSubmission.findMany.mockResolvedValue([]);
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
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
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

  it("lists organisation assignments with signed document metadata", async () => {
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
        status: "SIGNED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signedAt: new Date("2026-06-14T13:00:00.000Z"),
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T13:00:00.000Z"),
        template: { id: "template-1", name: "Annual Intake" },
        companion: { id: "comp-1", name: "Milo" },
        appointment: {
          patient: {
            id: "comp-1",
            name: "Milo",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
    mockedPrisma.formSubmission.findMany.mockResolvedValueOnce([
      {
        id: "submission-1",
        formId: "template-1",
        formVersion: 2,
        appointmentId: "appt-1",
        patientId: "comp-1",
        parentId: "parent-1",
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signing: {
          status: "SIGNED",
          documentId: "doc-123",
          pdf: { url: "https://files.example/signed.pdf" },
        },
      },
    ]);

    const rows = await FormAssignmentService.listForOrganisation({
      organisationId: "org-1",
      parentId: "parent-1",
      status: "signed",
    });

    expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          status: { in: ["SIGNED"] },
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: "assignment-1",
        templateName: "Annual Intake",
        templateTitle: "Annual Intake",
        companionName: "Milo",
        parentId: "parent-1",
        parentName: "Jane Doe",
        status: "SIGNED",
        signedDocument: {
          documentId: "doc-123",
          pdfUrl: "https://files.example/signed.pdf",
        },
      }),
    ]);
  });

  it("marks a viewed assignment when the parent opens the appointment", async () => {
    await FormAssignmentService.markViewedForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
    });

    expect(mockedPrisma.formAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          appointmentId: "appt-1",
          status: "SENT",
        }),
        data: expect.objectContaining({
          status: "VIEWED",
        }),
      }),
    );
  });

  it("marks a submitted assignment when the form is submitted", async () => {
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
        status: "VIEWED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T11:00:00.000Z"),
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
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
      status: "SUBMITTED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: new Date("2026-06-14T11:00:00.000Z"),
      submittedAt: new Date("2026-06-14T12:00:00.000Z"),
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T12:00:00.000Z"),
    });

    const row = await FormAssignmentService.markSubmittedFromSubmission({
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      companionId: "comp-1",
      parentId: "parent-1",
    });

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      }),
    );
    expect(row?.status).toBe("SUBMITTED");
  });

  it("marks a signed assignment when the signed document arrives", async () => {
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
        status: "SUBMITTED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T12:00:00.000Z"),
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
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
      status: "SIGNED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: new Date("2026-06-14T11:00:00.000Z"),
      submittedAt: new Date("2026-06-14T12:00:00.000Z"),
      signedAt: new Date("2026-06-14T13:00:00.000Z"),
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T13:00:00.000Z"),
    });

    const row = await FormAssignmentService.markSignedFromSubmission({
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      companionId: "comp-1",
      parentId: "parent-1",
    });

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({
          status: "SIGNED",
        }),
      }),
    );
    expect(row?.status).toBe("SIGNED");
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
});
