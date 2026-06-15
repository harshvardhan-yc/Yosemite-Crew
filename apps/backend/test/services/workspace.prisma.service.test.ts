import { prisma } from "src/config/prisma";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { ClinicalArtifactService } from "src/services/clinical-artifact.service";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "../../src/services/workspace.prisma.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findFirst: jest.fn() },
    encounter: { findFirst: jest.fn() },
    case: { findFirst: jest.fn() },
    patient: { findFirst: jest.fn() },
    parent: { findFirst: jest.fn() },
    task: { findMany: jest.fn() },
    taskSchedule: { findMany: jest.fn() },
    templateInstance: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
    renderedDocument: { findMany: jest.fn() },
    labOrder: { findMany: jest.fn() },
    labResult: { findMany: jest.fn() },
  },
}));

jest.mock("src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    listAppointmentFormSummaries: jest.fn(),
  },
}));

jest.mock("src/services/clinical-artifact.service", () => ({
  ClinicalArtifactService: {
    listSoapNotesForAppointment: jest.fn(),
    listSoapNotesForEncounter: jest.fn(),
    listPrescriptionsForAppointment: jest.fn(),
    listPrescriptionsForEncounter: jest.fn(),
    listDischargeSummariesForAppointment: jest.fn(),
    listDischargeSummariesForEncounter: jest.fn(),
    listVitalRecordsForAppointment: jest.fn(),
    listVitalRecordsForEncounter: jest.fn(),
  },
}));

describe("WorkspaceService", () => {
  const mockedPrisma = prisma as unknown as {
    appointment: { findFirst: jest.Mock };
    encounter: { findFirst: jest.Mock };
    case: { findFirst: jest.Mock };
    patient: { findFirst: jest.Mock };
    parent: { findFirst: jest.Mock };
    task: { findMany: jest.Mock };
    taskSchedule: { findMany: jest.Mock };
    templateInstance: { findMany: jest.Mock };
    document: { findMany: jest.Mock };
    renderedDocument: { findMany: jest.Mock };
    labOrder: { findMany: jest.Mock };
    labResult: { findMany: jest.Mock };
  };
  const mockedFormService = FormAssignmentService as unknown as {
    listAppointmentFormSummaries: jest.Mock;
  };
  const mockedClinicalArtifactService = ClinicalArtifactService as unknown as {
    listSoapNotesForAppointment: jest.Mock;
    listSoapNotesForEncounter: jest.Mock;
    listPrescriptionsForAppointment: jest.Mock;
    listPrescriptionsForEncounter: jest.Mock;
    listDischargeSummariesForAppointment: jest.Mock;
    listDischargeSummariesForEncounter: jest.Mock;
    listVitalRecordsForAppointment: jest.Mock;
    listVitalRecordsForEncounter: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.appointment.findFirst.mockResolvedValue(null);
    mockedPrisma.encounter.findFirst.mockResolvedValue(null);
    mockedPrisma.case.findFirst.mockResolvedValue(null);
    mockedPrisma.patient.findFirst.mockResolvedValue(null);
    mockedPrisma.parent.findFirst.mockResolvedValue(null);
    mockedPrisma.task.findMany.mockResolvedValue([]);
    mockedPrisma.taskSchedule.findMany.mockResolvedValue([]);
    mockedPrisma.templateInstance.findMany.mockResolvedValue([]);
    mockedPrisma.document.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.findMany.mockResolvedValue([]);
    mockedPrisma.labOrder.findMany.mockResolvedValue([]);
    mockedPrisma.labResult.findMany.mockResolvedValue([]);

    mockedFormService.listAppointmentFormSummaries.mockResolvedValue([
      {
        assignmentId: "assignment-1",
        id: "assignment-1",
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 1,
        appointmentId: "appt-1",
        encounterId: "enc-1",
        companionId: "patient-1",
        signerUserId: null,
        signerName: null,
        signerEmail: null,
        signerRole: null,
        mobileVisible: true,
        signingRequired: true,
        status: "pending",
        assignmentStatus: "SENT",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: null,
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        signerIdentity: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);

    mockedClinicalArtifactService.listSoapNotesForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listSoapNotesForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listPrescriptionsForAppointment.mockResolvedValue(
      [
        {
          artifact: {
            id: "prescription-1",
            status: "IN_PROGRESS",
            createdAt: new Date("2026-06-15T00:00:00.000Z"),
            updatedAt: new Date("2026-06-15T00:00:00.000Z"),
          },
          prescription: {
            medications: [{ name: "Amoxicillin" }],
          },
        },
      ],
    );
    mockedClinicalArtifactService.listPrescriptionsForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listDischargeSummariesForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listDischargeSummariesForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listVitalRecordsForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listVitalRecordsForEncounter.mockResolvedValue(
      [],
    );
  });

  it("builds the appointment bootstrap aggregate with derived action and permissions", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentKind: "OUTPATIENT",
      concern: "Annual review",
      encounterId: "enc-1",
      caseId: "case-1",
      patient: { id: "patient-1", parent: { id: "parent-1" } },
      startTime: new Date("2026-06-15T10:00:00.000Z"),
      endTime: new Date("2026-06-15T10:30:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-1",
      organisationId: "org-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "active",
      appointmentKind: "OUTPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-1",
      name: "Buddy",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.parent.findFirst.mockResolvedValue({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: "IN_PROGRESS",
        dueAt: new Date("2026-06-15T09:00:00.000Z"),
      },
    ]);
    mockedPrisma.labOrder.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: "SUBMITTED",
        idexxOrderId: "idexx-1",
        tests: ["CBC"],
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);
    mockedPrisma.labResult.findMany.mockResolvedValue([
      {
        id: "result-1",
        status: "COMPLETE",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);

    const result = await WorkspaceService.getAppointmentBootstrap(
      {
        organisationId: "org-1",
        appointmentId: "appt-1",
      },
      ["appointments:view:any", "tasks:view:any"],
    );

    expect(result.organisationId).toBe("org-1");
    expect(result.appointment?.id).toBe("appt-1");
    expect(result.companion?.id).toBe("patient-1");
    expect(result.client?.id).toBe("parent-1");
    expect(result.permissions.canViewAppointments).toBe(true);
    expect(result.permissions.canViewTasks).toBe(true);
    expect(result.forms).toEqual([
      expect.objectContaining({
        assignmentId: "assignment-1",
        status: "pending",
        assignmentStatus: "SENT",
      }),
    ]);
    expect(result.primaryAction.kind).toBe("COMPLETE_FORMS");
    expect(result.treatmentItems).toHaveLength(1);
    expect(result.diagnosticQueue).toHaveLength(2);
    expect(result.labSummary.pendingCount).toBe(1);
    expect(mockedFormService.listAppointmentFormSummaries).toHaveBeenCalledWith(
      "org-1",
      "appt-1",
    );
  });

  it("builds the encounter bootstrap even when no linked appointment is resolved", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-2",
      organisationId: "org-2",
      caseId: "case-2",
      patientId: "patient-2",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-2",
      organisationId: "org-2",
      patientId: "patient-2",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-2",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: "org-2",
        encounterId: "enc-2",
      },
      [],
    );

    expect(result.encounter?.id).toBe("enc-2");
    expect(result.appointment).toBeNull();
    expect(result.forms).toEqual([]);
    expect(result.primaryAction.kind).toBe("VIEW_SUMMARY");
  });

  it("resolves the linked appointment when bootstrapping from an encounter", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-enc-1",
      organisationId: "org-2",
      status: "UPCOMING",
      appointmentKind: "INPATIENT",
      concern: "Linked appointment",
      encounterId: "enc-2",
      caseId: "case-2",
      patient: { id: "patient-2", parent: { id: "parent-2" } },
      startTime: new Date("2026-06-14T10:00:00.000Z"),
      endTime: new Date("2026-06-14T11:00:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-2",
      organisationId: "org-2",
      caseId: "case-2",
      patientId: "patient-2",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-2",
      organisationId: "org-2",
      patientId: "patient-2",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-2",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: "org-2",
        encounterId: "enc-2",
      },
      ["forms:view:any"],
    );

    expect(result.appointment?.id).toBe("appt-enc-1");
    expect(mockedFormService.listAppointmentFormSummaries).toHaveBeenCalledWith(
      "org-2",
      "appt-enc-1",
    );
  });

  it("throws a not found error when the appointment is missing", async () => {
    await expect(
      WorkspaceService.getAppointmentBootstrap(
        {
          organisationId: "org-1",
          appointmentId: "missing",
        },
        [],
      ),
    ).rejects.toBeInstanceOf(WorkspaceServiceError);
  });
});
