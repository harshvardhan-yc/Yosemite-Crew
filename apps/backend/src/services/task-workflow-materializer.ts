import { TemplateKind, TaskKind } from "@prisma/client";
import type { TaskAudience } from "./task.service";

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
  dueOffsetMinutes?: number;
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
  id?: string;
  dayOffset: number;
  timeOfDay: string;
  taskKind: TaskKind;
  category: string;
  name: string;
  audience: TaskAudience;
  assignedRole?: TaskAudience;
  dependsOn?: string[];
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
  anchorAt?: Date;
  dueAt?: Date;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSectionById = (snapshot: unknown, sectionId: string) => {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.sections))
    return undefined;
  return snapshot.sections.find(
    (section): section is Record<string, unknown> =>
      isRecord(section) && section.id === sectionId,
  );
};

const getSectionFieldValue = (
  section: Record<string, unknown> | undefined,
  key: string,
) => {
  if (!section) return undefined;

  if (isRecord(section.data) && key in section.data) {
    return section.data[key];
  }

  if (isRecord(section.values) && key in section.values) {
    return section.values[key];
  }

  if (Array.isArray(section.fields)) {
    const field = section.fields.find(
      (item): item is Record<string, unknown> =>
        isRecord(item) && item.key === key,
    );
    if (!field) return undefined;
    return field.value ?? field.answer ?? field.defaultValue;
  }

  return section[key];
};

const getWorkflowValue = (
  snapshot: unknown,
  key: string,
  sectionIds: string[] = [],
) => {
  if (isRecord(snapshot) && snapshot[key] !== undefined) {
    return snapshot[key];
  }

  for (const sectionId of sectionIds) {
    const value = getSectionFieldValue(
      getSectionById(snapshot, sectionId),
      key,
    );
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
};

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toTaskAudience = (value: unknown): TaskAudience | undefined =>
  value === "EMPLOYEE_TASK" || value === "PARENT_TASK"
    ? value
    : value === "EMPLOYEE"
      ? "EMPLOYEE_TASK"
      : value === "PARENT"
        ? "PARENT_TASK"
        : undefined;

const toTaskKind = (value: unknown): TaskKind | undefined =>
  value === "MEDICATION" ||
  value === "OBSERVATION_TOOL" ||
  value === "HYGIENE" ||
  value === "DIET" ||
  value === "CUSTOM"
    ? value
    : undefined;

const toDateFromOffset = (anchorAt: Date | undefined, offsetMinutes = 0) =>
  new Date((anchorAt ?? new Date()).getTime() + offsetMinutes * 60 * 1000);

const parseTaskTemplateInstanceData = (
  snapshot: unknown,
): TaskTemplateInstanceData => {
  const defaultRole = toTaskAudience(
    getWorkflowValue(snapshot, "defaultRole", ["assignment"]),
  );

  const taskKind = toTaskKind(
    getWorkflowValue(snapshot, "taskKind", ["definition"]),
  );

  if (!taskKind) {
    throw new Error("Invalid taskKind");
  }

  if (!defaultRole) {
    throw new Error("Invalid defaultRole");
  }

  return {
    taskKind,
    category: asTrimmedString(
      getWorkflowValue(snapshot, "category", ["definition"]),
    ),
    name: asTrimmedString(getWorkflowValue(snapshot, "name", ["definition"])),
    description:
      (getWorkflowValue(snapshot, "description", ["definition"]) as
        | string
        | undefined) ?? undefined,
    defaultRole,
    dueOffsetMinutes:
      typeof getWorkflowValue(snapshot, "dueOffsetMinutes", ["timing"]) ===
      "number"
        ? (getWorkflowValue(snapshot, "dueOffsetMinutes", ["timing"]) as number)
        : undefined,
    defaultMedication: getWorkflowValue(snapshot, "defaultMedication", [
      "definition",
    ]) as TaskWorkflowSeed["medication"] | undefined,
    defaultObservationToolId:
      (getWorkflowValue(snapshot, "defaultObservationToolId", [
        "assignment",
      ]) as string | undefined) ?? undefined,
    defaultRecurrence: getWorkflowValue(snapshot, "recurrence", ["timing"]) as
      | TaskTemplateInstanceData["defaultRecurrence"]
      | undefined,
    defaultReminderOffsetMinutes:
      typeof getWorkflowValue(snapshot, "defaultReminderOffsetMinutes", [
        "timing",
      ]) === "number"
        ? (getWorkflowValue(snapshot, "defaultReminderOffsetMinutes", [
            "timing",
          ]) as number)
        : undefined,
    syncWithCalendar:
      (getWorkflowValue(snapshot, "syncWithCalendar", ["assignment"]) as
        | boolean
        | undefined) ?? undefined,
  };
};

const parseCarePathwayInstanceData = (
  snapshot: unknown,
): CarePathwayInstanceData => {
  const taskBlocksValue = getWorkflowValue(snapshot, "taskBlocks", [
    "schedule",
  ]);
  const taskBlocks = Array.isArray(taskBlocksValue)
    ? taskBlocksValue.filter(isRecord).map((block) => ({
        id: asTrimmedString(block.id),
        dayOffset: Number(block.dayOffset ?? 0),
        timeOfDay: asTrimmedString(block.timeOfDay),
        taskKind: toTaskKind(block.taskKind) ?? "CUSTOM",
        category: asTrimmedString(block.category),
        name: asTrimmedString(block.name),
        audience: toTaskAudience(block.audience) ?? "EMPLOYEE_TASK",
        assignedRole: toTaskAudience(block.assignedRole),
        dependsOn: Array.isArray(block.dependsOn)
          ? block.dependsOn
              .map((dep) => asTrimmedString(dep))
              .filter((dep): dep is string => Boolean(dep))
          : undefined,
        reminderOffsetMinutes:
          typeof block.reminderOffsetMinutes === "number"
            ? block.reminderOffsetMinutes
            : undefined,
        additionalNotes:
          (block.additionalNotes as string | undefined) ?? undefined,
        medication: block.medication as
          | TaskWorkflowSeed["medication"]
          | undefined,
        observationToolId:
          (block.observationToolId as string | undefined) ?? undefined,
        recurrence: isRecord(block.recurrence)
          ? {
              type:
                (block.recurrence.type as RecurrenceType | undefined) ?? "ONCE",
              customCron:
                (block.recurrence.customCron as string | undefined) ??
                undefined,
              endAfterDays:
                (block.recurrence.endAfterDays as number | undefined) ??
                undefined,
            }
          : undefined,
      }))
    : [];

  return {
    admissionOffsetMinutes:
      typeof getWorkflowValue(snapshot, "admissionOffsetMinutes", [
        "admission",
      ]) === "number"
        ? (getWorkflowValue(snapshot, "admissionOffsetMinutes", [
            "admission",
          ]) as number)
        : undefined,
    taskBlocks,
    dischargeOffsetMinutes:
      typeof getWorkflowValue(snapshot, "dischargeOffsetMinutes", [
        "discharge",
      ]) === "number"
        ? (getWorkflowValue(snapshot, "dischargeOffsetMinutes", [
            "discharge",
          ]) as number)
        : undefined,
    followUpTaskName:
      (getWorkflowValue(snapshot, "followUpTaskName", ["discharge"]) as
        | string
        | undefined) ?? undefined,
    signOffRequired:
      (getWorkflowValue(snapshot, "signOffRequired", ["discharge"]) as
        | boolean
        | undefined) ?? undefined,
  };
};

type OrderedCarePathwayBlock = CarePathwayTaskBlock & { _index: number };

const sortCarePathwayBlocks = (blocks: CarePathwayTaskBlock[]) => {
  const hasExplicitIds = blocks.some((block) => block.id);
  if (!hasExplicitIds) {
    return blocks.map((block, index) => ({ ...block, _index: index }));
  }

  const nodes = blocks.map((block, index) => ({
    ...block,
    _index: index,
  })) as OrderedCarePathwayBlock[];

  const byId = new Map<string, OrderedCarePathwayBlock>();
  for (const node of nodes) {
    if (node.id) {
      byId.set(node.id, node);
    }
  }

  for (const node of nodes) {
    for (const dependencyId of node.dependsOn ?? []) {
      if (!byId.has(dependencyId)) {
        throw new Error(`Unknown task dependency: ${dependencyId}`);
      }
    }
  }

  const sorted: OrderedCarePathwayBlock[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: OrderedCarePathwayBlock) => {
    if (!node.id) {
      sorted.push(node);
      return;
    }

    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      throw new Error(`Circular task dependency detected: ${node.id}`);
    }

    visiting.add(node.id);
    for (const dependencyId of node.dependsOn ?? []) {
      const dependency = byId.get(dependencyId);
      if (dependency) {
        visit(dependency);
      }
    }
    visiting.delete(node.id);
    visited.add(node.id);
    sorted.push(node);
  };

  const orderedByInput = [...nodes].sort((a, b) => a._index - b._index);
  for (const node of orderedByInput) {
    visit(node);
  }

  return sorted;
};

export const materializeTaskTemplateSeed = (
  data: TaskTemplateInstanceData,
  context: TaskWorkflowContext & {
    anchorAt?: Date;
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
  dueAt:
    context.dueAt ?? toDateFromOffset(context.anchorAt, data.dueOffsetMinutes),
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

  const seeds = sortCarePathwayBlocks(data.taskBlocks).map((block) => {
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

export const materializeTaskWorkflowSeeds = (
  templateKind: TemplateKind,
  snapshot: unknown,
  context: TaskWorkflowContext & {
    anchorAt?: Date;
    admissionAt?: Date;
    resolveAssignee: (
      audience: TaskAudience,
      block?: CarePathwayTaskBlock,
    ) => string;
  },
): TaskWorkflowSeed[] => {
  if (templateKind === "TASK_TEMPLATE") {
    const parsed = parseTaskTemplateInstanceData(snapshot);
    return [
      materializeTaskTemplateSeed(parsed, {
        ...context,
        anchorAt: context.anchorAt,
        resolveAssignee: (audience) => context.resolveAssignee(audience),
      }),
    ];
  }

  if (templateKind === "CARE_PATHWAY") {
    const parsed = parseCarePathwayInstanceData(snapshot);
    if (!context.admissionAt) {
      throw new Error(
        "admissionAt is required for CARE_PATHWAY materialization",
      );
    }
    return materializeCarePathwaySeeds(parsed, {
      ...context,
      admissionAt: context.admissionAt,
    });
  }

  return [];
};
