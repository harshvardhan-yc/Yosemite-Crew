import {
  materializeCarePathwaySeeds,
  materializeTaskTemplateSeed,
  materializeTaskWorkflowSeeds,
} from "../../src/services/task-workflow-materializer";

describe("task workflow materializer", () => {
  it("materializes a task template seed", () => {
    const seed = materializeTaskTemplateSeed(
      {
        taskKind: "MEDICATION",
        category: "Medication",
        name: "Give antibiotics",
        defaultRole: "EMPLOYEE_TASK",
        defaultReminderOffsetMinutes: 30,
        syncWithCalendar: true,
      },
      {
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-1",
        dueAt: new Date("2026-01-01T10:00:00.000Z"),
        resolveAssignee: () => "user-1",
      },
    );

    expect(seed.templateId).toBe("tmpl-1");
    expect(seed.assignedTo).toBe("user-1");
    expect(seed.reminder?.offsetMinutes).toBe(30);
    expect(seed.syncWithCalendar).toBe(true);
  });

  it("materializes inpatient care pathway seeds from schedule blocks", () => {
    const seeds = materializeCarePathwaySeeds(
      {
        admissionOffsetMinutes: 0,
        taskBlocks: [
          {
            dayOffset: 0,
            timeOfDay: "08:30",
            taskKind: "MEDICATION",
            category: "Medication",
            name: "Morning medicine",
            audience: "EMPLOYEE_TASK",
            reminderOffsetMinutes: 15,
          },
          {
            dayOffset: 1,
            timeOfDay: "09:00",
            taskKind: "DIET",
            category: "Diet",
            name: "Check feeding",
            audience: "PARENT_TASK",
          },
        ],
        dischargeOffsetMinutes: 60,
        followUpTaskName: "Discharge review",
        signOffRequired: true,
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-2",
        resolveAssignee: (audience) =>
          audience === "EMPLOYEE_TASK" ? "employee-1" : "parent-1",
      },
    );

    expect(seeds).toHaveLength(3);
    expect(seeds[0].assignedTo).toBe("employee-1");
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T08:30:00.000Z");
    expect(seeds[2].name).toBe("Discharge review");
    expect(seeds[2].assignedTo).toBe("employee-1");
  });

  it("orders care pathway blocks by dependency graph", () => {
    const seeds = materializeCarePathwaySeeds(
      {
        taskBlocks: [
          {
            id: "followup",
            dayOffset: 0,
            timeOfDay: "10:00",
            taskKind: "CUSTOM",
            category: "Follow-up",
            name: "Review results",
            audience: "EMPLOYEE_TASK",
            dependsOn: ["labs"],
          },
          {
            id: "labs",
            dayOffset: 0,
            timeOfDay: "08:00",
            taskKind: "OBSERVATION_TOOL",
            category: "Vitals",
            name: "Collect samples",
            audience: "EMPLOYEE_TASK",
          },
        ],
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-3",
        resolveAssignee: () => "employee-1",
      },
    );

    expect(seeds[0].name).toBe("Collect samples");
    expect(seeds[1].name).toBe("Review results");
  });

  it("materializes a task workflow seed from a template instance snapshot", () => {
    const seeds = materializeTaskWorkflowSeeds(
      "TASK_TEMPLATE",
      {
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
      {
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-3",
        anchorAt: new Date("2026-01-01T09:00:00.000Z"),
        resolveAssignee: () => "employee-2",
      },
    );

    expect(seeds).toHaveLength(1);
    expect(seeds[0].assignedTo).toBe("employee-2");
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T09:30:00.000Z");
  });
});
