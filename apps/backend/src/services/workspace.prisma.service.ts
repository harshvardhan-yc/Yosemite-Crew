import { prisma } from "src/config/prisma";
import { ClinicalArtifactService } from "./clinical-artifact.service";
import { FormAssignmentService } from "./form-assignment.service";
import type {
  Case,
  Encounter,
  WorkspaceBootstrapAggregate,
  WorkspaceBootstrapInput,
  WorkspaceDiagnosticQueueItem,
  WorkspaceDocumentRow,
  WorkspaceLabSummary,
  WorkspaceLockState,
  WorkspacePermissionSnapshot,
  WorkspaceFormRow,
  WorkspacePrimaryAction,
  WorkspaceSummaryItem,
  WorkspaceTreatmentItem,
} from "@yosemite-crew/types";

export class WorkspaceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

type AppointmentRow = {
  id: string;
  organisationId: string;
  status: string;
  appointmentKind: string;
  concern: string | null;
  encounterId: string | null;
  caseId: string | null;
  patient: unknown;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
};

type EncounterRow = {
  id: string;
  organisationId: string;
  caseId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  encounterClass: string;
  appointmentKind: string;
  title: string | null;
  reason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CaseRow = {
  id: string;
  organisationId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  appointmentKind: string;
  title: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PatientRow = {
  id: string;
  name: string;
  type: string;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ParentRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RenderedDocumentRow = {
  id: string;
  sourceKind: string;
  sourceId: string;
  templateId: string | null;
  templateVersion: number | null;
  kind: string;
  title: string;
  status: string;
  pdfUrl: string | null;
  signing: unknown;
  createdAt: Date;
  updatedAt: Date;
  templateInstance: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
  clinicalArtifact: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
};

type WorkspaceContext = {
  appointment: AppointmentRow | null;
  encounter: Encounter | null;
  episodeOfCare: Case | null;
  companion: PatientRow | null;
  client: ParentRow | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getPatientIdFromAppointment = (patient: unknown): string | undefined => {
  if (!isRecord(patient)) return undefined;
  return getString(patient.id);
};

const getParentIdFromAppointment = (patient: unknown): string | undefined => {
  if (!isRecord(patient) || !isRecord(patient.parent)) return undefined;
  return getString(patient.parent.id);
};

const buildWorkspaceSummaryItem = (input: {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceSummaryItem => input;

const mapEncounterRow = (row: EncounterRow): Encounter => ({
  id: row.id,
  caseId: row.caseId,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as Encounter["status"],
  encounterClass: row.encounterClass as Encounter["encounterClass"],
  appointmentKind: row.appointmentKind as Encounter["appointmentKind"],
  title: row.title ?? undefined,
  reason: row.reason ?? undefined,
  periodStart: row.periodStart ?? undefined,
  periodEnd: row.periodEnd ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapCaseRow = (row: CaseRow): Case => ({
  id: row.id,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as Case["status"],
  appointmentKind: row.appointmentKind as Case["appointmentKind"],
  title: row.title ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const buildPermissionSnapshot = (
  permissions: string[] | undefined,
): WorkspacePermissionSnapshot => {
  const resolved = [
    ...new Set((permissions ?? []).filter((permission) => permission.trim())),
  ];
  return {
    permissions: resolved,
    canViewAppointments:
      resolved.includes("appointments:view:any") ||
      resolved.includes("appointments:view:own"),
    canViewTasks:
      resolved.includes("tasks:view:any") ||
      resolved.includes("tasks:view:own"),
    canViewDocuments: resolved.includes("document:view:any"),
    canViewForms: resolved.includes("forms:view:any"),
    canViewPrescriptions:
      resolved.includes("prescription:view:any") ||
      resolved.includes("prescription:view:own"),
    canViewLabs: resolved.includes("labs:view:any"),
  };
};

const buildLocks = (): WorkspaceLockState => ({
  appointment: false,
  encounter: false,
  episodeOfCare: false,
  templateInstances: false,
  clinicalArtifacts: false,
  prescriptions: false,
  documents: false,
});

const buildPrimaryAction = (input: {
  forms: Array<{ status: "completed" | "pending" }>;
  tasks: Array<{ status: string }>;
  clinicalArtifacts: Array<{ status: string }>;
  labSummary: WorkspaceLabSummary;
}): WorkspacePrimaryAction => {
  if (input.forms.some((form) => form.status === "pending")) {
    return {
      kind: "COMPLETE_FORMS",
      label: "Complete forms",
      detail: "There are outstanding forms to finish before continuing.",
    };
  }

  if (
    input.tasks.some(
      (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
    )
  ) {
    return {
      kind: "REVIEW_TASKS",
      label: "Review tasks",
      detail: "There are active tasks that still need attention.",
    };
  }

  if (
    input.clinicalArtifacts.some(
      (artifact) =>
        artifact.status === "DRAFT" || artifact.status === "IN_PROGRESS",
    )
  ) {
    return {
      kind: "CONTINUE_CHARTING",
      label: "Continue charting",
      detail: "An open clinical record can be resumed.",
    };
  }

  if (input.labSummary.pendingCount > 0) {
    return {
      kind: "VIEW_LABS",
      label: "Review labs",
      detail: "There are pending lab items to review.",
    };
  }

  return {
    kind: "VIEW_SUMMARY",
    label: "View summary",
    detail: "No outstanding action was detected for this workspace.",
  };
};

const buildLabSummary = (
  orders: unknown[],
  results: unknown[],
): WorkspaceLabSummary => ({
  orders,
  results,
  pendingCount: orders.filter(
    (order) =>
      isRecord(order) &&
      typeof order.status === "string" &&
      order.status !== "COMPLETE",
  ).length,
});

const buildDiagnosticQueue = (
  orders: Array<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    tests?: unknown;
  }>,
  results: Array<{
    id: string;
    status?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): WorkspaceDiagnosticQueueItem[] => {
  const orderItems = orders.map((order) => ({
    id: order.id,
    kind: "LAB_ORDER" as const,
    status: order.status,
    label:
      Array.isArray(order.tests) && order.tests.length > 0
        ? "Lab order with tests"
        : "Lab order",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));

  const resultItems = results.map((result) => ({
    id: result.id,
    kind: "LAB_RESULT" as const,
    status: result.status ?? null,
    label: "Lab result",
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }));

  return [...orderItems, ...resultItems];
};

const buildTreatmentItems = (
  prescriptions: Array<{
    artifact: { id: string; status: string; createdAt: Date; updatedAt: Date };
    prescription: { medications: unknown };
  }>,
): WorkspaceTreatmentItem[] =>
  prescriptions.map((record) => {
    const medications = Array.isArray(record.prescription.medications)
      ? record.prescription.medications
      : [];
    return {
      id: record.artifact.id,
      prescriptionId: record.artifact.id,
      name: medications.length ? "Treatment items" : "Prescription",
      medicationCount: medications.length,
      status: record.artifact.status,
      createdAt: record.artifact.createdAt,
      updatedAt: record.artifact.updatedAt,
    };
  });

const mapDocumentRow = (input: {
  documentId: string;
  sourceKind: string;
  sourceId: string;
  appointmentId: string | null;
  encounterId: string | null;
  companionId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  title: string;
  kind: string;
  status: string;
  signingStatus: string;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceDocumentRow => input;

const mapRenderedDocumentRow = (
  document: RenderedDocumentRow,
): WorkspaceDocumentRow => ({
  documentId: document.id,
  sourceKind: document.sourceKind,
  sourceId: document.sourceId,
  appointmentId:
    document.templateInstance?.appointmentId ??
    document.clinicalArtifact?.appointmentId ??
    null,
  encounterId:
    document.templateInstance?.encounterId ??
    document.clinicalArtifact?.encounterId ??
    null,
  companionId: null,
  templateId: document.templateId,
  templateVersion: document.templateVersion,
  title: document.title,
  kind: document.kind,
  status: document.status,
  signingStatus:
    isRecord(document.signing) && typeof document.signing.status === "string"
      ? String(document.signing.status)
      : document.status === "SIGNED"
        ? "SIGNED"
        : "NOT_STARTED",
  pdfUrl: document.pdfUrl,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

const buildContext = async (
  input: WorkspaceBootstrapInput,
): Promise<WorkspaceContext> => {
  const appointment =
    input.appointmentId != null
      ? ((await prisma.appointment.findFirst({
          where: {
            id: input.appointmentId,
            organisationId: input.organisationId,
          },
        })) as AppointmentRow | null)
      : null;

  const encounterAppointment =
    appointment == null && input.encounterId != null
      ? ((await prisma.appointment.findFirst({
          where: {
            encounterId: input.encounterId,
            organisationId: input.organisationId,
          },
        })) as AppointmentRow | null)
      : null;

  const resolvedAppointment = appointment ?? encounterAppointment;

  const encounterRow =
    input.encounterId != null
      ? ((await prisma.encounter.findFirst({
          where: {
            id: input.encounterId,
            organisationId: input.organisationId,
          },
        })) as EncounterRow | null)
      : appointment?.encounterId
        ? ((await prisma.encounter.findFirst({
            where: {
              id: appointment.encounterId,
              organisationId: input.organisationId,
            },
          })) as EncounterRow | null)
        : null;

  const encounter = encounterRow != null ? mapEncounterRow(encounterRow) : null;

  const caseId = encounter?.caseId ?? resolvedAppointment?.caseId ?? undefined;
  const caseRow = caseId
    ? ((await prisma.case.findFirst({
        where: {
          id: caseId,
          organisationId: input.organisationId,
        },
      })) as CaseRow | null)
    : null;
  const episodeOfCare = caseRow != null ? mapCaseRow(caseRow) : null;

  const companionId =
    encounter?.patientId ??
    getPatientIdFromAppointment(resolvedAppointment?.patient) ??
    undefined;

  const parentId =
    encounter?.parentId ??
    getParentIdFromAppointment(resolvedAppointment?.patient) ??
    episodeOfCare?.parentId ??
    undefined;

  const [companion, client] = await Promise.all([
    companionId
      ? (prisma.patient.findFirst({
          where: {
            id: companionId,
          },
        }) as Promise<PatientRow | null>)
      : Promise.resolve(null),
    parentId
      ? (prisma.parent.findFirst({
          where: { id: parentId },
        }) as Promise<ParentRow | null>)
      : Promise.resolve(null),
  ]);

  return {
    appointment: resolvedAppointment,
    encounter,
    episodeOfCare,
    companion,
    client,
  };
};

const loadForms = async (
  organisationId: string,
  appointmentId: string | undefined,
) => {
  if (!appointmentId) {
    return {
      appointmentId: undefined,
      items: [] as WorkspaceFormRow[],
    };
  }

  const items = await FormAssignmentService.listAppointmentFormSummaries(
    organisationId,
    appointmentId,
  );

  return {
    appointmentId,
    items,
  };
};

const loadClinicalArtifacts = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
}) => {
  const appointmentId = params.appointmentId ?? "";
  const encounterId = params.encounterId ?? "";

  const [soapNotes, prescriptions, dischargeSummaries, vitalRecords] =
    encounterId
      ? await Promise.all([
          ClinicalArtifactService.listSoapNotesForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listPrescriptionsForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listDischargeSummariesForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listVitalRecordsForEncounter(
            params.organisationId,
            encounterId,
          ),
        ])
      : await Promise.all([
          ClinicalArtifactService.listSoapNotesForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listPrescriptionsForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listDischargeSummariesForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listVitalRecordsForAppointment(
            params.organisationId,
            appointmentId,
          ),
        ]);

  return {
    soapNotes,
    prescriptions,
    dischargeSummaries,
    vitalRecords,
    clinicalArtifacts: [
      ...soapNotes,
      ...prescriptions,
      ...dischargeSummaries,
      ...vitalRecords,
    ],
  };
};

const loadTasks = async (params: {
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
}) =>
  prisma.task.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { dueAt: "asc" },
  });

const loadSchedules = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
}) =>
  prisma.taskSchedule.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.encounterId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.encounterId
                ? [{ encounterId: params.encounterId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

const loadTemplateInstances = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  caseId?: string;
}) =>
  prisma.templateInstance.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.encounterId || params.caseId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.encounterId
                ? [{ encounterId: params.encounterId }]
                : []),
              ...(params.caseId ? [{ caseId: params.caseId }] : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

const loadOrdersAndResults = async (params: {
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
}) => {
  const orders = await prisma.labOrder.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const results = await prisma.labResult.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.companionId || orders.some((order) => order.idexxOrderId)
        ? {
            OR: [
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
              ...orders
                .filter((order) => order.idexxOrderId)
                .map((order) => ({ orderId: order.idexxOrderId })),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return { orders, results };
};

const loadDocuments = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
}) => {
  const renderedDocumentConditions = [
    ...(params.appointmentId
      ? [
          {
            templateInstance: {
              is: { appointmentId: params.appointmentId },
            },
          },
          {
            clinicalArtifact: {
              is: { appointmentId: params.appointmentId },
            },
          },
        ]
      : []),
    ...(params.encounterId
      ? [
          {
            templateInstance: {
              is: { encounterId: params.encounterId },
            },
          },
          {
            clinicalArtifact: {
              is: { encounterId: params.encounterId },
            },
          },
        ]
      : []),
  ];

  const [documents, renderedDocuments] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(params.appointmentId
          ? { appointmentId: params.appointmentId }
          : {}),
        ...(params.companionId ? { patientId: params.companionId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.renderedDocument.findMany({
      where: {
        organisationId: params.organisationId,
        ...(renderedDocumentConditions.length
          ? { OR: renderedDocumentConditions }
          : {}),
      },
      include: {
        templateInstance: {
          select: {
            appointmentId: true,
            encounterId: true,
          },
        },
        clinicalArtifact: {
          select: {
            appointmentId: true,
            encounterId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }) as Promise<RenderedDocumentRow[]>,
  ]);

  const rows: WorkspaceDocumentRow[] = [
    ...documents.map((document) =>
      mapDocumentRow({
        documentId: document.id,
        sourceKind: "FORM_SUBMISSION",
        sourceId: document.id,
        appointmentId: document.appointmentId ?? null,
        encounterId: null,
        companionId: document.patientId ?? null,
        templateId: null,
        templateVersion: null,
        title: document.title,
        kind: document.category,
        status: document.pmsVisible ? "SIGNED" : "DRAFT",
        signingStatus: document.pmsVisible ? "SIGNED" : "NOT_STARTED",
        pdfUrl: null,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }),
    ),
    ...renderedDocuments.map(mapRenderedDocumentRow),
  ];

  return rows;
};

const buildBootstrapAggregate = async (
  input: WorkspaceBootstrapInput,
  permissions?: string[],
  options?: { requireAppointment?: boolean },
): Promise<WorkspaceBootstrapAggregate> => {
  const context = await buildContext(input);

  if (options?.requireAppointment && !context.appointment) {
    throw new WorkspaceServiceError("Appointment not found", 404);
  }

  const appointmentId = context.appointment?.id;
  const encounterId = context.encounter?.id;
  const companionId = context.companion?.id;
  const caseId = context.episodeOfCare?.id;

  const [
    forms,
    clinical,
    tasks,
    schedules,
    templateInstances,
    documents,
    ordersAndResults,
  ] = await Promise.all([
    loadForms(input.organisationId, appointmentId),
    loadClinicalArtifacts({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
    }),
    loadTasks({
      organisationId: input.organisationId,
      appointmentId,
      companionId,
    }),
    loadSchedules({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      companionId,
    }),
    loadTemplateInstances({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      caseId,
    }),
    loadDocuments({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      companionId,
    }),
    loadOrdersAndResults({
      organisationId: input.organisationId,
      appointmentId,
      companionId,
    }),
  ]);

  const labSummary = buildLabSummary(
    ordersAndResults.orders,
    ordersAndResults.results,
  );

  return {
    organisationId: input.organisationId,
    appointment: context.appointment
      ? buildWorkspaceSummaryItem({
          id: context.appointment.id,
          name: context.appointment.concern,
          status: context.appointment.status,
          kind: context.appointment.appointmentKind,
          createdAt: context.appointment.createdAt,
          updatedAt: context.appointment.updatedAt,
        })
      : null,
    encounter: context.encounter,
    episodeOfCare: context.episodeOfCare,
    companion: context.companion
      ? buildWorkspaceSummaryItem({
          id: context.companion.id,
          name: context.companion.name,
          status: context.companion.status,
          kind: context.companion.type,
          createdAt: context.companion.createdAt,
          updatedAt: context.companion.updatedAt,
        })
      : null,
    client: context.client
      ? buildWorkspaceSummaryItem({
          id: context.client.id,
          name: [context.client.firstName, context.client.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          status: null,
          kind: "CLIENT",
          createdAt: context.client.createdAt,
          updatedAt: context.client.updatedAt,
        })
      : null,
    templateInstances,
    clinicalArtifacts: clinical.clinicalArtifacts,
    vitals: clinical.vitalRecords,
    prescriptions: clinical.prescriptions,
    treatmentItems: buildTreatmentItems(clinical.prescriptions as never),
    diagnosticQueue: buildDiagnosticQueue(
      ordersAndResults.orders as never,
      ordersAndResults.results as never,
    ),
    labSummary,
    tasks,
    schedules,
    forms: forms.items,
    documents,
    locks: buildLocks(),
    permissions: buildPermissionSnapshot(permissions),
    primaryAction: buildPrimaryAction({
      forms: forms.items,
      tasks,
      clinicalArtifacts: clinical.clinicalArtifacts.map((artifact) => ({
        status:
          (artifact as { artifact?: { status?: string } }).artifact?.status ??
          (artifact as { status?: string }).status ??
          "DRAFT",
      })),
      labSummary,
    }),
  };
};

export const WorkspaceService = {
  async getAppointmentBootstrap(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceBootstrapAggregate> {
    return buildBootstrapAggregate(input, permissions, {
      requireAppointment: true,
    });
  },

  async getEncounterBootstrap(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceBootstrapAggregate> {
    const context = await buildContext({
      organisationId: input.organisationId,
      encounterId: input.encounterId,
    });

    if (!context.encounter) {
      throw new WorkspaceServiceError("Encounter not found", 404);
    }

    return buildBootstrapAggregate(
      {
        organisationId: input.organisationId,
        appointmentId: context.appointment?.id,
        encounterId: context.encounter.id,
      },
      permissions,
    );
  },
};
