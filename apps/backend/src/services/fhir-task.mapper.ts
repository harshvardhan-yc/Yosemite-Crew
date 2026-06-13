import { TaskStatus as PrismaTaskStatus } from "@prisma/client";
import {
  Bundle,
  CodeableConcept,
  Extension,
  Reference,
  Task,
} from "@yosemite-crew/fhir";
import {
  CreateCustomTaskInput,
  TaskUpdateInput,
  TaskAudience,
  TaskServiceError,
} from "src/services/task.service";

const TASK_AUDIENCE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-audience";
const TASK_SOURCE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-source";
const TASK_TEMPLATE_ID_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-template-id";
const TASK_LIBRARY_ID_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-library-id";
const TASK_ORGANISATION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-organisation";
const TASK_APPOINTMENT_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-appointment";
const TASK_COMPANION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-companion";
const TASK_CREATED_BY_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-created-by";
const TASK_ASSIGNED_BY_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-by";
const TASK_ASSIGNED_TO_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-to";
const TASK_CATEGORY_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-category";
const TASK_DUE_AT_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-due-at";
const TASK_TIMEZONE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-timezone";
const TASK_MEDICATION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-medication";
const TASK_OBSERVATION_TOOL_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-observation-tool";
const TASK_RECURRENCE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-recurrence";
const TASK_REMINDER_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-reminder";
const TASK_SYNC_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-sync-with-calendar";
const TASK_ATTACHMENTS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/task-attachments";

type TaskLike = {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  companionId: string | null;
  createdBy: string;
  assignedBy: string | null;
  assignedTo: string;
  audience: TaskAudience;
  source: string;
  libraryTaskId: string | null;
  templateId: string | null;
  category: string;
  name: string;
  description: string | null;
  additionalNotes: string | null;
  medication: unknown;
  observationToolId: string | null;
  dueAt: Date;
  timezone: string | null;
  recurrence: unknown;
  reminder: unknown;
  syncWithCalendar: boolean | null;
  calendarEventId: string | null;
  attachments: unknown;
  status: PrismaTaskStatus;
  completedAt: Date | null;
  completedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const toIsoDateTime = (value?: Date | null) =>
  value ? value.toISOString() : undefined;

const parseJson = <T>(value: unknown): T | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return undefined;
};

const getExtension = (extensions: Extension[] | undefined, url: string) =>
  extensions?.find((extension) => extension.url === url);

const getStringExtension = (extensions: Extension[] | undefined, url: string) =>
  getExtension(extensions, url)?.valueString;

const getBooleanExtension = (
  extensions: Extension[] | undefined,
  url: string,
) => getExtension(extensions, url)?.valueBoolean;

const normalizeReferenceId = (reference?: Reference | null) => {
  const ref = reference?.reference;
  if (!ref) return undefined;
  return ref.split("/").pop() ?? undefined;
};

const statusToFhir = (status: PrismaTaskStatus): Task["status"] => {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "IN_PROGRESS":
      return "accepted";
    case "PENDING":
    default:
      return "requested";
  }
};

const fhirToStatus = (status?: string): PrismaTaskStatus => {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "cancelled":
    case "entered-in-error":
    case "stopped":
      return "CANCELLED";
    case "accepted":
    case "in-progress":
      return "IN_PROGRESS";
    default:
      return "PENDING";
  }
};

const audienceFromExtension = (
  extensions: Extension[] | undefined,
): TaskAudience | undefined => {
  const value = getStringExtension(extensions, TASK_AUDIENCE_EXTENSION_URL);
  return value === "PARENT_TASK" || value === "EMPLOYEE_TASK"
    ? value
    : undefined;
};

const toCodeableConcept = (
  code: string,
  display?: string,
): CodeableConcept => ({
  coding: [
    {
      system: "https://yosemitecrew.com/fhir/CodeSystem/task-category",
      code,
      display: display ?? code,
    },
  ],
  text: display ?? code,
});

const taskExtensions = (task: TaskLike): Extension[] => {
  const extensions: Extension[] = [
    { url: TASK_AUDIENCE_EXTENSION_URL, valueString: task.audience },
    { url: TASK_SOURCE_EXTENSION_URL, valueString: task.source },
    { url: TASK_CREATED_BY_EXTENSION_URL, valueString: task.createdBy },
    {
      url: TASK_ASSIGNED_BY_EXTENSION_URL,
      valueString: task.assignedBy ?? undefined,
    },
    { url: TASK_ASSIGNED_TO_EXTENSION_URL, valueString: task.assignedTo },
    { url: TASK_CATEGORY_EXTENSION_URL, valueString: task.category },
    { url: TASK_DUE_AT_EXTENSION_URL, valueDateTime: task.dueAt.toISOString() },
  ];

  if (task.organisationId) {
    extensions.push({
      url: TASK_ORGANISATION_EXTENSION_URL,
      valueString: task.organisationId,
    });
  }

  if (task.appointmentId) {
    extensions.push({
      url: TASK_APPOINTMENT_EXTENSION_URL,
      valueString: task.appointmentId,
    });
  }

  if (task.companionId) {
    extensions.push({
      url: TASK_COMPANION_EXTENSION_URL,
      valueString: task.companionId,
    });
  }

  if (task.templateId) {
    extensions.push({
      url: TASK_TEMPLATE_ID_EXTENSION_URL,
      valueString: task.templateId,
    });
  }

  if (task.libraryTaskId) {
    extensions.push({
      url: TASK_LIBRARY_ID_EXTENSION_URL,
      valueString: task.libraryTaskId,
    });
  }

  if (task.timezone) {
    extensions.push({
      url: TASK_TIMEZONE_EXTENSION_URL,
      valueString: task.timezone,
    });
  }

  if (task.medication) {
    extensions.push({
      url: TASK_MEDICATION_EXTENSION_URL,
      valueString: JSON.stringify(task.medication),
    });
  }

  if (task.observationToolId) {
    extensions.push({
      url: TASK_OBSERVATION_TOOL_EXTENSION_URL,
      valueString: task.observationToolId,
    });
  }

  if (task.recurrence) {
    extensions.push({
      url: TASK_RECURRENCE_EXTENSION_URL,
      valueString: JSON.stringify(task.recurrence),
    });
  }

  if (task.reminder) {
    extensions.push({
      url: TASK_REMINDER_EXTENSION_URL,
      valueString: JSON.stringify(task.reminder),
    });
  }

  if (task.syncWithCalendar !== null && task.syncWithCalendar !== undefined) {
    extensions.push({
      url: TASK_SYNC_EXTENSION_URL,
      valueBoolean: task.syncWithCalendar,
    });
  }

  if (task.attachments) {
    extensions.push({
      url: TASK_ATTACHMENTS_EXTENSION_URL,
      valueString: JSON.stringify(task.attachments),
    });
  }

  return extensions;
};

const parseTaskPayload = (
  task: Task,
  defaults?: {
    organisationId?: string;
    createdBy?: string;
    assignedBy?: string;
  },
) => {
  const extensions = task.extension;
  const audience =
    audienceFromExtension(extensions) ??
    (task.for?.reference?.includes("RelatedPerson")
      ? "PARENT_TASK"
      : "EMPLOYEE_TASK");

  const assignedTo =
    normalizeReferenceId(task.owner) ??
    getStringExtension(extensions, TASK_ASSIGNED_TO_EXTENSION_URL) ??
    "";
  const createdBy =
    getStringExtension(extensions, TASK_CREATED_BY_EXTENSION_URL) ??
    defaults?.createdBy ??
    assignedTo;

  const additionalNotes =
    task.note
      ?.map((note) => note.text)
      .filter(Boolean)
      .join("\n") ?? undefined;

  const dueAt =
    task.executionPeriod?.end ??
    getStringExtension(extensions, TASK_DUE_AT_EXTENSION_URL) ??
    new Date().toISOString();

  const input: CreateCustomTaskInput = {
    organisationId:
      getStringExtension(extensions, TASK_ORGANISATION_EXTENSION_URL) ??
      defaults?.organisationId,
    appointmentId: getStringExtension(
      extensions,
      TASK_APPOINTMENT_EXTENSION_URL,
    ),
    companionId: getStringExtension(extensions, TASK_COMPANION_EXTENSION_URL),
    createdBy,
    assignedBy:
      getStringExtension(extensions, TASK_ASSIGNED_BY_EXTENSION_URL) ??
      createdBy,
    assignedTo,
    audience,
    category:
      getStringExtension(extensions, TASK_CATEGORY_EXTENSION_URL) ??
      task.code?.text ??
      task.code?.coding?.[0]?.code ??
      task.description ??
      "General",
    name: task.description ?? task.code?.text ?? "Task",
    description: task.description ?? undefined,
    additionalNotes,
    dueAt: new Date(dueAt),
    timezone:
      getStringExtension(extensions, TASK_TIMEZONE_EXTENSION_URL) ?? undefined,
    medication: parseJson(
      task.extension?.find(
        (extension) => extension.url === TASK_MEDICATION_EXTENSION_URL,
      )?.valueString,
    ),
    observationToolId:
      getStringExtension(extensions, TASK_OBSERVATION_TOOL_EXTENSION_URL) ??
      undefined,
    recurrence: parseJson(
      task.extension?.find(
        (extension) => extension.url === TASK_RECURRENCE_EXTENSION_URL,
      )?.valueString,
    ),
    reminder: parseJson(
      task.extension?.find(
        (extension) => extension.url === TASK_REMINDER_EXTENSION_URL,
      )?.valueString,
    ),
    syncWithCalendar:
      getBooleanExtension(extensions, TASK_SYNC_EXTENSION_URL) ?? false,
    attachments: parseJson(
      task.extension?.find(
        (extension) => extension.url === TASK_ATTACHMENTS_EXTENSION_URL,
      )?.valueString,
    ),
  };

  return input;
};

export const taskFhirMapper = {
  toFhirTask(task: TaskLike): Task {
    return {
      resourceType: "Task",
      id: task.id,
      status: statusToFhir(task.status),
      intent: "order",
      description: task.name,
      code: toCodeableConcept(task.category, task.category),
      focus: task.companionId
        ? {
            reference: `Patient/${task.companionId}`,
          }
        : undefined,
      encounter: task.appointmentId
        ? {
            reference: `Encounter/${task.appointmentId}`,
          }
        : undefined,
      authoredOn: toIsoDateTime(task.createdAt),
      lastModified: toIsoDateTime(task.updatedAt),
      requester: {
        reference: `Practitioner/${task.createdBy}`,
      },
      owner: {
        reference: `Practitioner/${task.assignedTo}`,
      },
      note: task.additionalNotes
        ? [
            {
              text: task.additionalNotes,
            },
          ]
        : undefined,
      executionPeriod:
        task.dueAt || task.completedAt
          ? {
              start: task.completedAt
                ? task.createdAt.toISOString()
                : undefined,
              end: task.dueAt.toISOString(),
            }
          : undefined,
      extension: taskExtensions(task),
    };
  },

  listBundle(tasks: TaskLike[]) {
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: tasks.length,
      entry: tasks.map((task) => ({
        resource: taskFhirMapper.toFhirTask(task),
      })),
    } satisfies Bundle;
  },

  fromFhirTask(
    task: Task,
    defaults?: {
      organisationId?: string;
      createdBy?: string;
      assignedBy?: string;
    },
  ): CreateCustomTaskInput {
    if (!task || task.resourceType !== "Task") {
      throw new TaskServiceError(
        "Invalid payload. Expected FHIR Task resource.",
        400,
      );
    }

    const input = parseTaskPayload(task, defaults);

    if (!input.assignedTo) {
      input.assignedTo = defaults?.assignedBy ?? defaults?.createdBy ?? "";
    }

    if (!input.createdBy) {
      input.createdBy = defaults?.createdBy ?? input.assignedTo;
    }

    if (!input.assignedBy) {
      input.assignedBy = defaults?.assignedBy ?? input.createdBy;
    }

    return input;
  },

  toTaskUpdateInput(task: Task): TaskUpdateInput {
    if (!task || task.resourceType !== "Task") {
      throw new TaskServiceError(
        "Invalid payload. Expected FHIR Task resource.",
        400,
      );
    }

    return {
      name: task.description ?? undefined,
      description: task.description ?? undefined,
      additionalNotes:
        task.note
          ?.map((note) => note.text)
          .filter(Boolean)
          .join("\n") ?? undefined,
      dueAt: task.executionPeriod?.end
        ? new Date(task.executionPeriod.end)
        : undefined,
      timezone:
        getStringExtension(task.extension, TASK_TIMEZONE_EXTENSION_URL) ??
        undefined,
      assignedTo: normalizeReferenceId(task.owner),
      medication:
        parseJson(
          task.extension?.find(
            (extension) => extension.url === TASK_MEDICATION_EXTENSION_URL,
          )?.valueString,
        ) ?? undefined,
      observationToolId:
        getStringExtension(
          task.extension,
          TASK_OBSERVATION_TOOL_EXTENSION_URL,
        ) ?? undefined,
      reminder:
        parseJson(
          task.extension?.find(
            (extension) => extension.url === TASK_REMINDER_EXTENSION_URL,
          )?.valueString,
        ) ?? undefined,
      syncWithCalendar:
        getBooleanExtension(task.extension, TASK_SYNC_EXTENSION_URL) ??
        undefined,
      attachments:
        parseJson(
          task.extension?.find(
            (extension) => extension.url === TASK_ATTACHMENTS_EXTENSION_URL,
          )?.valueString,
        ) ?? undefined,
      recurrence:
        parseJson(
          task.extension?.find(
            (extension) => extension.url === TASK_RECURRENCE_EXTENSION_URL,
          )?.valueString,
        ) ?? undefined,
    };
  },

  toTaskStatus(status: Task["status"]) {
    return fhirToStatus(status);
  },

  fromTaskStatus(status: string | undefined) {
    return fhirToStatus(status);
  },
};
