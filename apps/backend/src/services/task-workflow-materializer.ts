import { TaskKind } from "@prisma/client";
import { TaskAudience } from "./task.service";

type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";

export type TaskWorkflowSeed = {
  source: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  templateId?: string;
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  audience: TaskAudience;
  libraryTaskId?: string;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
    notes?: string;
  };
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: RecurrenceType;
    isMaster: boolean;
    masterTaskId?: string;
    cronExpression?: string;
    endDate?: Date;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  };
  syncWithCalendar?: boolean;
  calendarEventId?: string;
  attachments?: Array<{ id: string; name: string }>;
};

export type TaskTemplateInstanceData = {
  taskKind: TaskKind;
  category: string;
  name: string;
  description?: string;
  defaultRole: TaskAudience;
  defaultMedication?: TaskWorkflowSeed["medication"];
  defaultObservationToolId?: string;
  defaultRecurrence?: {
    type: RecurrenceType;
    customCron?: string;
    defaultEndOffsetDays?: number;
  };
  defaultReminderOffsetMinutes?: number;
  syncWithCalendar?: boolean;
};

export type CarePathwayTaskBlock = {
  dayOffset: number;
  timeOfDay: string;
  taskKind: TaskKind;
  category: string;
  name: string;
  audience: TaskAudience;
  assignedRole?: TaskAudience;
  reminderOffsetMinutes?: number;
  additionalNotes?: string;
  medication?: TaskWorkflowSeed["medication"];
  observationToolId?: string;
  recurrence?: {
    type: RecurrenceType;
    customCron?: string;
    endAfterDays?: number;
  };
};

export type CarePathwayInstanceData = {
  admissionOffsetMinutes?: number;
  taskBlocks: CarePathwayTaskBlock[];
  dischargeOffsetMinutes?: number;
  followUpTaskName?: string;
  signOffRequired?: boolean;
};

export type TaskWorkflowContext = {
  organisationId: string;
  createdBy: string;
  assignedBy?: string;
  appointmentId?: string;
  companionId?: string;
  templateId?: string;
  source?: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  timezone?: string;
};

const ensureHourMinute = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Invalid timeOfDay");
  }
};

const parseTimeOfDay = (value: string) => {
  ensureHourMinute(value);
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return { hours, minutes };
};

const buildDueAt = (anchor: Date, dayOffset: number, timeOfDay: string) => {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const dueAt = new Date(anchor);
  dueAt.setUTCDate(dueAt.getUTCDate() + dayOffset);
  dueAt.setUTCHours(hours, minutes, 0, 0);
  return dueAt;
};

const buildRecurrence = (
  recurrence:
    | CarePathwayTaskBlock["recurrence"]
    | TaskTemplateInstanceData["defaultRecurrence"],
  endDate?: Date,
) => {
  if (!recurrence) return undefined;
  return {
    type: recurrence.type,
    isMaster: true,
    masterTaskId: undefined,
    cronExpression: recurrence.customCron ?? undefined,
    endDate,
  };
};

export const materializeTaskTemplateSeed = (
  data: TaskTemplateInstanceData,
  context: TaskWorkflowContext & {
    dueAt: Date;
    resolveAssignee: (audience: TaskAudience) => string;
  },
): TaskWorkflowSeed => ({
  source: context.source ?? "ORG_TEMPLATE",
  templateId: context.templateId,
  organisationId: context.organisationId,
  appointmentId: context.appointmentId,
  companionId: context.companionId,
  createdBy: context.createdBy,
  assignedBy: context.assignedBy,
  assignedTo: context.resolveAssignee(data.defaultRole),
  audience: data.defaultRole,
  category: data.category,
  name: data.name,
  description: data.description,
  medication: data.defaultMedication,
  observationToolId: data.defaultObservationToolId,
  dueAt: context.dueAt,
  timezone: context.timezone,
  recurrence: buildRecurrence(data.defaultRecurrence),
  reminder:
    data.defaultReminderOffsetMinutes === undefined
      ? undefined
      : {
          enabled: true,
          offsetMinutes: data.defaultReminderOffsetMinutes,
        },
  syncWithCalendar: data.syncWithCalendar,
});

export const materializeCarePathwaySeeds = (
  data: CarePathwayInstanceData,
  context: TaskWorkflowContext & {
    admissionAt: Date;
    resolveAssignee: (
      audience: TaskAudience,
      block: CarePathwayTaskBlock,
    ) => string;
  },
): TaskWorkflowSeed[] => {
  const admissionAnchor = new Date(
    context.admissionAt.getTime() +
      (data.admissionOffsetMinutes ?? 0) * 60 * 1000,
  );

  const seeds = data.taskBlocks.map((block) => {
    const dueAt = buildDueAt(admissionAnchor, block.dayOffset, block.timeOfDay);
    return {
      source: context.source ?? "ORG_TEMPLATE",
      templateId: context.templateId,
      organisationId: context.organisationId,
      appointmentId: context.appointmentId,
      companionId: context.companionId,
      createdBy: context.createdBy,
      assignedBy: context.assignedBy,
      assignedTo: context.resolveAssignee(block.audience, block),
      audience: block.audience,
      category: block.category,
      name: block.name,
      additionalNotes: block.additionalNotes,
      medication: block.medication,
      observationToolId: block.observationToolId,
      dueAt,
      timezone: context.timezone,
      recurrence: buildRecurrence(block.recurrence, undefined),
      reminder:
        block.reminderOffsetMinutes === undefined
          ? undefined
          : {
              enabled: true,
              offsetMinutes: block.reminderOffsetMinutes,
            },
    } satisfies TaskWorkflowSeed;
  });

  if (data.followUpTaskName) {
    seeds.push({
      source: context.source ?? "ORG_TEMPLATE",
      templateId: context.templateId,
      organisationId: context.organisationId,
      appointmentId: context.appointmentId,
      companionId: context.companionId,
      createdBy: context.createdBy,
      assignedBy: context.assignedBy,
      assignedTo: context.resolveAssignee("EMPLOYEE_TASK", {
        dayOffset: 0,
        timeOfDay: "09:00",
        taskKind: "CUSTOM",
        category: "Discharge",
        name: data.followUpTaskName,
        audience: "EMPLOYEE_TASK",
      }),
      audience: "EMPLOYEE_TASK",
      category: "Discharge",
      name: data.followUpTaskName,
      additionalNotes: undefined,
      medication: undefined,
      observationToolId: undefined,
      dueAt: new Date(
        context.admissionAt.getTime() +
          (data.dischargeOffsetMinutes ?? 0) * 60 * 1000,
      ),
      timezone: context.timezone,
      recurrence: undefined,
      reminder:
        data.signOffRequired === false
          ? undefined
          : { enabled: true, offsetMinutes: 0 },
    });
  }

  return seeds;
};
