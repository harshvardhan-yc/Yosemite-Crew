import { prisma } from "src/config/prisma";
import {
  TemplateService,
  TemplateServiceError,
} from "../../src/services/template.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    template: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    templateVersion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    templateInstance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("TemplateService", () => {
  const organisationId = "org-1";
  const templateId = "tmpl-1";
  const instanceId = "inst-1";

  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    template: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    templateVersion: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    templateInstance: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return undefined;
    });
  });

  it("creates a template with an initial version", async () => {
    mockedPrisma.template.create.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      latestVersion: 1,
      publishedVersion: null,
      status: "DRAFT",
    });
    mockedPrisma.template.findUnique.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      kind: "SOAP_NOTE",
      name: "SOAP note",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: null,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [{ version: 1 }],
    });

    const result = await TemplateService.create({
      organisationId,
      kind: "SOAP_NOTE",
      name: "SOAP note",
      scope: "ORGANISATION",
      schemaSnapshot: {
        sections: [
          {
            id: "subjective",
            title: "Subjective",
            fields: [
              {
                key: "chiefComplaint",
                label: "Chief complaint",
                type: "textarea",
              },
            ],
          },
        ],
      },
      createdBy: "creator-1",
    });

    expect(mockedPrisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId,
          kind: "SOAP_NOTE",
          latestVersion: 1,
          status: "DRAFT",
        }),
      }),
    );
    expect(mockedPrisma.templateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          version: 1,
        }),
      }),
    );
    expect(result.id).toBe(templateId);
  });

  it("creates a new version when updating a published template", async () => {
    mockedPrisma.template.findUnique
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "creator-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        kind: "SOAP_NOTE",
        name: "SOAP note updated",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "editor-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [{ version: 2 }],
      });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-1",
      templateId,
      version: 1,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "creator-1",
    });

    await TemplateService.update(
      templateId,
      {
        name: "SOAP note updated",
        schemaSnapshot: {
          sections: [
            {
              id: "subjective",
              title: "Subjective",
              fields: [],
            },
          ],
        },
        updatedBy: "editor-1",
      },
      organisationId,
    );

    expect(mockedPrisma.templateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          version: 2,
          createdBy: "editor-1",
        }),
      }),
    );
    expect(mockedPrisma.template.update).toHaveBeenCalled();
  });

  it("publishes the latest version", async () => {
    mockedPrisma.template.findUnique
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "DRAFT",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "creator-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 2,
        createdBy: "creator-1",
        updatedBy: "publisher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [{ version: 2 }],
      });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-2",
      templateId,
      version: 2,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: null,
      createdBy: "creator-1",
    });

    await TemplateService.publish(templateId, "publisher-1", organisationId);

    expect(mockedPrisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedVersion: 2,
          updatedBy: "publisher-1",
        }),
      }),
    );
    expect(mockedPrisma.templateVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ver-2" },
      }),
    );
  });

  it("creates an instance from the published version", async () => {
    mockedPrisma.template.findUnique.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      kind: "SOAP_NOTE",
      name: "SOAP note",
      description: null,
      status: "PUBLISHED",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 2,
      publishedVersion: 2,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-2",
      templateId,
      version: 2,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "creator-1",
    });
    mockedPrisma.templateInstance.create.mockResolvedValueOnce({
      id: instanceId,
      templateId,
      templateVersion: 2,
      organisationId,
      status: "DRAFT",
      data: {},
    });

    const result = await TemplateService.createInstance({
      templateId,
      organisationId,
      appointmentId: "appt-1",
      authorId: "user-1",
      data: {
        temperature: 38.4,
      },
    });

    expect(mockedPrisma.templateInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          templateVersion: 2,
          organisationId,
          appointmentId: "appt-1",
          authorId: "user-1",
        }),
      }),
    );
    expect(result.id).toBe(instanceId);
  });

  it("rejects instance updates when the organisation does not match", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: instanceId,
      organisationId: "other-org",
      templateId,
      templateVersion: 1,
      status: "DRAFT",
      data: {},
    });

    await expect(
      TemplateService.updateInstance(
        instanceId,
        { data: { temperature: 39 } },
        organisationId,
      ),
    ).rejects.toBeInstanceOf(TemplateServiceError);
  });

  it("throws when submitting a missing instance", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce(null);

    await expect(
      TemplateService.submitInstance(instanceId, organisationId),
    ).rejects.toThrow("Template instance not found");
  });
});
