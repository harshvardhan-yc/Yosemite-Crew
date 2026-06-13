import { Prisma, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  materializeTaskWorkflowSeeds,
  type TaskWorkflowSeed,
} from "./task-workflow-materializer";
import { TaskService, type TaskAudience } from "./task.service";

export class TaskWorkflowServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "TaskWorkflowServiceError";
  }
}

type TaskScheduleRow = Prisma.TaskScheduleGetPayload<Record<string, never>>;
type TaskScheduleLike = TaskScheduleRow & { _id: string };

type TemplateInstanceWorkflowPayload = Prisma.TemplateInstanceGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        kind: true;
        ownership: true;
      };
    };
    taskSchedule: true;
  };
}>;

type LaunchTaskWorkflowOptions = {
  client?: Prisma.TransactionClient;
  notify?: boolean;
};

type AppointmentContext = {
  companionId?: string;
  parentId?: string;
  leadId?: string;
  supportStaffIds: string[];
  anchorAt: Date;
  admissionAt: Date;
};

const toTaskScheduleLike = (row: TaskScheduleRow): TaskScheduleLike => ({
  ...row,
  _id: row.id,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getStringId = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getAppointmentLeadId = (lead: unknown): string | undefined =>
  isRecord(lead) ? getStringId(lead.id) : undefined;

const getAppointmentCompanionId = (companion: unknown): string | undefined =>
  isRecord(companion) ? getStringId(companion.id) : undefined;

const getAppointmentParentId = (companion: unknown): string | undefined =>
  isRecord(companion) && isRecord(companion.parent)
    ? getStringId(companion.parent.id)
    : undefined;

const getSupportStaffIds = (supportStaff: unknown): string[] =>
  Array.isArray(supportStaff)
    ? supportStaff
        .map((member) =>
          isRecord(member) ? getStringId(member.id) : undefined,
        )
        .filter((id): id is string => Boolean(id))
    : [];

const resolveSource = (
  ownership: "YC_LIBRARY" | "ORG_TEMPLATE" | "USER_TEMPLATE",
) => (ownership === "YC_LIBRARY" ? "YC_LIBRARY" : "ORG_TEMPLATE");

const toJsonSeed = (seed: TaskWorkflowSeed) => ({
  ...seed,
  dueAt: seed.dueAt.toISOString(),
  recurrence: seed.recurrence
    ? {
        ...seed.recurrence,
        endDate: seed.recurrence.endDate?.toISOString(),
      }
    : undefined,
});

const loadAppointmentContext = async (
  client: Prisma.TransactionClient,
  templateInstance: {
    appointmentId?: string | null;
    encounterId?: string | null;
    signedAt?: Date | null;
    createdAt: Date;
  },
): Promise<AppointmentContext> => {
  const appointment = templateInstance.appointmentId
    ? await client.appointment.findFirst({
        where: { id: templateInstance.appointmentId },
        select: {
          companion: true,
          lead: true,
          supportStaff: true,
          startTime: true,
          encounterId: true,
        },
      })
    : null;

  const encounterId =
    templateInstance.encounterId ?? appointment?.encounterId ?? undefined;
  const admission = encounterId
    ? await client.admission.findUnique({
        where: { encounterId },
        select: { admittedAt: true },
      })
    : null;

  const anchorAt =
    appointment?.startTime ??
    templateInstance.signedAt ??
    templateInstance.createdAt;
  const admissionAt = admission?.admittedAt ?? anchorAt;

  return {
    companionId: getAppointmentCompanionId(appointment?.companion),
    parentId: getAppointmentParentId(appointment?.companion),
    leadId: getAppointmentLeadId(appointment?.lead),
    supportStaffIds: getSupportStaffIds(appointment?.supportStaff),
    anchorAt,
    admissionAt,
  };
};

const resolveAssignee = (
  audience: TaskAudience,
  context: AppointmentContext,
  createdBy: string,
) => {
  if (audience === "PARENT_TASK") {
    return context.parentId ?? createdBy;
  }

  return context.leadId ?? context.supportStaffIds[0] ?? createdBy;
};

const hasGeneratedTasks = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === "string" && item.trim().length > 0);

const normalizeTemplateInstance = (
  instance: TemplateInstanceWorkflowPayload | null,
) => {
  if (!instance) {
    throw new TaskWorkflowServiceError("Template instance not found", 404);
  }
  return instance;
};

export const TaskWorkflowService = {
  async launchFromTemplateInstance(
    instanceId: string,
    organisationId?: string,
    submittedBy?: string,
    options?: LaunchTaskWorkflowOptions,
  ) {
    const client = options?.client ?? prisma;

    const instance = normalizeTemplateInstance(
      await client.templateInstance.findUnique({
        where: { id: instanceId.trim() },
        include: {
          template: {
            select: {
              id: true,
              kind: true,
              ownership: true,
            },
          },
          taskSchedule: true,
        },
      }),
    );

    if (organisationId && instance.organisationId !== organisationId) {
      throw new TaskWorkflowServiceError(
        "Template instance does not belong to organisation",
        403,
      );
    }

    if (
      instance.taskSchedule?.generatedTaskIds &&
      hasGeneratedTasks(instance.taskSchedule.generatedTaskIds)
    ) {
      return {
        schedule: toTaskScheduleLike(instance.taskSchedule),
        taskIds: instance.taskSchedule.generatedTaskIds,
        seedCount: Array.isArray(instance.taskSchedule.materializedSeeds)
          ? instance.taskSchedule.materializedSeeds.length
          : 0,
      };
    }

    if (
      instance.template.kind !== TemplateKind.TASK_TEMPLATE &&
      instance.template.kind !== TemplateKind.CARE_PATHWAY
    ) {
      throw new TaskWorkflowServiceError(
        "Template kind does not support task workflow generation",
        400,
      );
    }

    const createdBy = (
      submittedBy ??
      instance.authorId ??
      instance.signedBy ??
      ""
    ).trim();
    if (!createdBy) {
      throw new TaskWorkflowServiceError("submittedBy is required", 400);
    }

    const context = await loadAppointmentContext(client, instance);
    const source = resolveSource(instance.template.ownership);

    const seeds = materializeTaskWorkflowSeeds(
      instance.template.kind,
      instance.data,
      {
        organisationId: instance.organisationId,
        createdBy,
        assignedBy: createdBy,
        appointmentId: instance.appointmentId ?? undefined,
        companionId: context.companionId,
        templateId: instance.templateId,
        source,
        anchorAt: context.anchorAt,
        admissionAt: context.admissionAt,
        resolveAssignee: (audience) =>
          resolveAssignee(audience, context, createdBy),
      },
    );

    const schedule = instance.taskSchedule
      ? await client.taskSchedule.update({
          where: { templateInstanceId: instance.id },
          data: {
            templateId: instance.templateId,
            templateVersion: instance.templateVersion,
            templateKind: instance.template.kind,
            organisationId: instance.organisationId,
            appointmentId: instance.appointmentId ?? undefined,
            caseId: instance.caseId ?? undefined,
            encounterId: instance.encounterId ?? undefined,
            companionId: context.companionId,
            createdBy,
            activatedBy: submittedBy ?? createdBy,
            activatedAt: new Date(),
            status:
              instance.template.kind === TemplateKind.TASK_TEMPLATE
                ? "COMPLETED"
                : "ACTIVE",
            scheduleInput: instance.data as Prisma.InputJsonValue,
            materializedSeeds: seeds.map(toJsonSeed) as Prisma.InputJsonValue,
            lastMaterializedAt: new Date(),
            metadata: {
              templateKind: instance.template.kind,
              ownership: instance.template.ownership,
            } as Prisma.InputJsonValue,
          },
        })
      : await client.taskSchedule.create({
          data: {
            templateInstanceId: instance.id,
            templateId: instance.templateId,
            templateVersion: instance.templateVersion,
            templateKind: instance.template.kind,
            organisationId: instance.organisationId,
            appointmentId: instance.appointmentId ?? undefined,
            caseId: instance.caseId ?? undefined,
            encounterId: instance.encounterId ?? undefined,
            companionId: context.companionId,
            createdBy,
            activatedBy: submittedBy ?? createdBy,
            activatedAt: new Date(),
            status:
              instance.template.kind === TemplateKind.TASK_TEMPLATE
                ? "COMPLETED"
                : "ACTIVE",
            scheduleInput: instance.data as Prisma.InputJsonValue,
            materializedSeeds: seeds.map(toJsonSeed) as Prisma.InputJsonValue,
            lastMaterializedAt: new Date(),
            metadata: {
              templateKind: instance.template.kind,
              ownership: instance.template.ownership,
            } as Prisma.InputJsonValue,
          },
        });

    const generatedTaskIds: string[] = [];

    for (const seed of seeds) {
      const task = await TaskService.createFromWorkflowSeed(seed, {
        client,
        notify: options?.notify,
      });
      generatedTaskIds.push(task.id);
    }

    const updatedSchedule = await client.taskSchedule.update({
      where: { id: schedule.id },
      data: {
        generatedTaskIds: generatedTaskIds as Prisma.InputJsonValue,
        completedAt:
          instance.template.kind === TemplateKind.TASK_TEMPLATE
            ? new Date()
            : undefined,
      },
    });

    return {
      schedule: toTaskScheduleLike(updatedSchedule),
      taskIds: generatedTaskIds,
      seedCount: seeds.length,
    };
  },
};
