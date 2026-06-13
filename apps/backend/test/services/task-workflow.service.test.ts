import { prisma } from "src/config/prisma";
import { TaskService } from "../../src/services/task.service";
import { TaskWorkflowService } from "../../src/services/task-workflow.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    templateInstance: {
      findUnique: jest.fn(),
    },
    taskSchedule: {
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createFromWorkflowSeed: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  templateInstance: {
    findUnique: jest.Mock;
  };
  taskSchedule: {
    create: jest.Mock;
    update: jest.Mock;
  };
  appointment: {
    findFirst: jest.Mock;
  };
  admission: {
    findUnique: jest.Mock;
  };
};

const mockedTaskService = TaskService as unknown as {
  createFromWorkflowSeed: jest.Mock;
};

describe("TaskWorkflowService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("launches a task template instance into a persisted schedule", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      templateId: "template-1",
      templateVersion: 3,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Evening medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 30,
            },
          },
        ],
      },
      template: {
        id: "template-1",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-1",
    });
    mockedPrisma.taskSchedule.create.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: null,
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: ["task-1"],
    });

    const result = await TaskWorkflowService.launchFromTemplateInstance(
      "instance-1",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.taskSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateInstanceId: "instance-1",
          templateId: "template-1",
          templateVersion: 3,
          templateKind: "TASK_TEMPLATE",
          status: "COMPLETED",
        }),
      }),
    );
    expect(mockedPrisma.taskSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1" },
        data: expect.objectContaining({
          generatedTaskIds: ["task-1"],
        }),
      }),
    );
    expect(result.taskIds).toEqual(["task-1"]);
  });

  it("returns an existing generated schedule without duplicating tasks", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-2",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-2",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-2",
        kind: "CARE_PATHWAY",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-2",
        templateInstanceId: "instance-2",
        templateId: "template-2",
        templateVersion: 1,
        templateKind: "CARE_PATHWAY",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "ACTIVE",
        generatedTaskIds: ["task-1", "task-2"],
        materializedSeeds: [{ id: "seed-1" }],
      },
    });

    const result = await TaskWorkflowService.launchFromTemplateInstance(
      "instance-2",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.createFromWorkflowSeed).not.toHaveBeenCalled();
    expect(mockedPrisma.taskSchedule.update).not.toHaveBeenCalled();
    expect(result.taskIds).toEqual(["task-1", "task-2"]);
  });

  it("rejects unsupported template kinds", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-3",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-3",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-3",
        kind: "SOAP_NOTE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });

    await expect(
      TaskWorkflowService.launchFromTemplateInstance(
        "instance-3",
        "org-1",
        "creator-1",
        { client: prisma, notify: false },
      ),
    ).rejects.toThrow(
      "Template kind does not support task workflow generation",
    );
  });
});
