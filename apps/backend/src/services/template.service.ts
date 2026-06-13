import {
  Prisma,
  TemplateInstanceStatus,
  TemplateKind,
  TemplateScope,
  TemplateStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";

export class TemplateServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "TemplateServiceError";
  }
}

const templateFieldSourceSchema = z.enum(["USER", "SYSTEM", "TASK", "FHIR"]);

const templateFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "select",
  "multiSelect",
  "boolean",
  "signature",
  "table",
  "repeater",
  "observation",
  "vitalRow",
  "medicationLine",
  "diagnosis",
  "procedure",
  "instructionBlock",
  "assessmentItem",
  "planItem",
  "richText",
]);

export const templateFieldDefinitionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: templateFieldTypeSchema,
  required: z.boolean().optional(),
  repeatable: z.boolean().optional(),
  section: z.string().trim().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  defaultValue: z.unknown().optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        value: z.string().trim().min(1),
      }),
    )
    .optional(),
  rules: z.record(z.unknown()).optional(),
  visibilityConditions: z.record(z.unknown()).optional(),
  source: templateFieldSourceSchema.optional(),
});

export const templateSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  fields: z.array(templateFieldDefinitionSchema).default([]),
});

export const templateSchemaSnapshotSchema = z.object({
  sections: z.array(templateSectionSchema).default([]),
});

export const templateConfigSchema = z.record(z.unknown()).default({});

export const createTemplateSchema = z.object({
  organisationId: z.string().trim().min(1),
  kind: z.nativeEnum(TemplateKind),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  scope: z.nativeEnum(TemplateScope).default("ORGANISATION"),
  rules: z.record(z.unknown()).optional(),
  schemaSnapshot: templateSchemaSnapshotSchema,
  renderConfigSnapshot: templateConfigSchema.optional(),
  validationSnapshot: templateConfigSchema.optional(),
  createdBy: z.string().trim().min(1),
  updatedBy: z.string().trim().min(1).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  scope: z.nativeEnum(TemplateScope).optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  rules: z.record(z.unknown()).nullable().optional(),
  schemaSnapshot: templateSchemaSnapshotSchema.optional(),
  renderConfigSnapshot: templateConfigSchema.optional(),
  validationSnapshot: templateConfigSchema.optional(),
  updatedBy: z.string().trim().min(1).optional(),
});

export const createTemplateInstanceSchema = z.object({
  organisationId: z.string().trim().min(1),
  appointmentId: z.string().trim().min(1).optional(),
  caseId: z.string().trim().min(1).optional(),
  encounterId: z.string().trim().min(1).optional(),
  authorId: z.string().trim().min(1).optional(),
  data: z.record(z.unknown()).default({}),
});

export const updateTemplateInstanceSchema = z.object({
  data: z.record(z.unknown()).optional(),
  status: z.nativeEnum(TemplateInstanceStatus).optional(),
  signedBy: z.string().trim().min(1).optional().nullable(),
  signedAt: z.coerce.date().optional().nullable(),
  generatedPdfUrl: z.string().trim().min(1).optional().nullable(),
  generatedPdf: z.record(z.unknown()).optional().nullable(),
});

type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
type CreateTemplateInstanceInput = z.infer<typeof createTemplateInstanceSchema>;
type UpdateTemplateInstanceInput = z.infer<typeof updateTemplateInstanceSchema>;

const ensureId = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TemplateServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

const mergeJsonObject = (
  base: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> => ({
  ...(typeof base === "object" && base && !Array.isArray(base)
    ? (base as Record<string, unknown>)
    : {}),
  ...(patch ?? {}),
});

const toJsonInput = (
  value: unknown,
  fallback: Record<string, unknown> = {},
): Prisma.InputJsonValue => {
  return (value ?? fallback) as Prisma.InputJsonValue;
};

const toNullableJsonInput = (
  value: unknown,
):
  | Prisma.InputJsonValue
  | Prisma.NullTypes.DbNull
  | Prisma.NullTypes.JsonNull
  | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
};

const resolveVersionPayload = (template: {
  latestVersion: number;
  publishedVersion: number | null;
}) => ({
  createNewVersion:
    template.publishedVersion != null &&
    template.publishedVersion === template.latestVersion,
  targetVersion: template.latestVersion,
});

const assertTemplateOrganisation = (
  template: { organisationId: string },
  organisationId?: string,
) => {
  if (organisationId && template.organisationId !== organisationId) {
    throw new TemplateServiceError(
      "Template does not belong to organisation",
      403,
    );
  }
};

const loadTemplateOrThrow = async (
  templateId: string,
  organisationId?: string,
) => {
  const template = await prisma.template.findUnique({
    where: { id: ensureId(templateId, "templateId") },
  });

  if (!template) {
    throw new TemplateServiceError("Template not found", 404);
  }

  assertTemplateOrganisation(template, organisationId);

  return template;
};

const loadTemplateVersionOrThrow = async (
  templateId: string,
  version: number,
) => {
  const templateVersion = await prisma.templateVersion.findUnique({
    where: { templateId_version: { templateId, version } },
  });

  if (!templateVersion) {
    throw new TemplateServiceError("Template version not found", 404);
  }

  return templateVersion;
};

export const TemplateService = {
  async create(input: CreateTemplateInput) {
    const parsed = createTemplateSchema.parse(input);
    const updatedBy = parsed.updatedBy ?? parsed.createdBy;

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          organisationId: parsed.organisationId,
          kind: parsed.kind,
          name: parsed.name,
          description: parsed.description ?? undefined,
          status: "DRAFT",
          scope: parsed.scope,
          rules: toNullableJsonInput(parsed.rules),
          latestVersion: 1,
          publishedVersion: null,
          createdBy: parsed.createdBy,
          updatedBy,
        },
      });

      await tx.templateVersion.create({
        data: {
          templateId: created.id,
          version: 1,
          schemaSnapshot: toJsonInput(parsed.schemaSnapshot),
          renderConfigSnapshot: toJsonInput(parsed.renderConfigSnapshot),
          validationSnapshot: toJsonInput(parsed.validationSnapshot),
          createdBy: parsed.createdBy,
        },
      });

      return created;
    });

    return TemplateService.getById(template.id);
  },

  async update(
    templateId: string,
    input: UpdateTemplateInput,
    organisationId?: string,
  ) {
    const parsed = updateTemplateSchema.parse(input);
    const template = await loadTemplateOrThrow(templateId, organisationId);
    const { createNewVersion, targetVersion } = resolveVersionPayload(template);

    const nextUpdatedBy = parsed.updatedBy ?? template.updatedBy;
    const nextName = parsed.name ?? template.name;
    const nextDescription =
      parsed.description === undefined
        ? template.description
        : (parsed.description ?? undefined);
    const nextScope = parsed.scope ?? template.scope;
    const nextStatus = parsed.status ?? template.status;
    const nextRules =
      parsed.rules === undefined ? template.rules : (parsed.rules ?? null);
    const hasVersionChanges =
      parsed.schemaSnapshot !== undefined ||
      parsed.renderConfigSnapshot !== undefined ||
      parsed.validationSnapshot !== undefined;
    const currentVersion = hasVersionChanges
      ? await loadTemplateVersionOrThrow(template.id, targetVersion)
      : null;

    if (createNewVersion && hasVersionChanges) {
      const nextVersion = template.latestVersion + 1;
      await prisma.$transaction(async (tx) => {
        await tx.template.update({
          where: { id: template.id },
          data: {
            name: nextName,
            description: nextDescription,
            scope: nextScope,
            status: nextStatus,
            rules: toNullableJsonInput(nextRules),
            latestVersion: nextVersion,
            updatedBy: nextUpdatedBy,
          },
        });

        await tx.templateVersion.create({
          data: {
            templateId: template.id,
            version: nextVersion,
            schemaSnapshot: toJsonInput(
              parsed.schemaSnapshot ?? currentVersion?.schemaSnapshot,
            ),
            renderConfigSnapshot: toJsonInput(
              parsed.renderConfigSnapshot ??
                currentVersion?.renderConfigSnapshot,
            ),
            validationSnapshot: toJsonInput(
              parsed.validationSnapshot ?? currentVersion?.validationSnapshot,
            ),
            createdBy: nextUpdatedBy,
          },
        });
      });

      return TemplateService.getById(template.id);
    }

    if (hasVersionChanges && currentVersion) {
      await prisma.templateVersion.update({
        where: { id: currentVersion.id },
        data: {
          schemaSnapshot: toJsonInput(
            parsed.schemaSnapshot === undefined
              ? currentVersion.schemaSnapshot
              : parsed.schemaSnapshot,
          ),
          renderConfigSnapshot: toJsonInput(
            parsed.renderConfigSnapshot === undefined
              ? currentVersion.renderConfigSnapshot
              : parsed.renderConfigSnapshot,
          ),
          validationSnapshot: toJsonInput(
            parsed.validationSnapshot === undefined
              ? currentVersion.validationSnapshot
              : parsed.validationSnapshot,
          ),
        },
      });
    }

    await prisma.template.update({
      where: { id: template.id },
      data: {
        name: nextName,
        description: nextDescription,
        scope: nextScope,
        status: nextStatus,
        rules: toNullableJsonInput(nextRules),
        updatedBy: nextUpdatedBy,
      },
    });

    return TemplateService.getById(template.id);
  },

  async publish(
    templateId: string,
    publishedBy: string,
    organisationId?: string,
  ) {
    const template = await loadTemplateOrThrow(templateId, organisationId);
    const latestVersion = await loadTemplateVersionOrThrow(
      template.id,
      template.latestVersion,
    );

    if (
      template.publishedVersion === template.latestVersion &&
      template.status === "PUBLISHED"
    ) {
      return TemplateService.getById(template.id);
    }

    await prisma.$transaction([
      prisma.template.update({
        where: { id: template.id },
        data: {
          status: "PUBLISHED",
          publishedVersion: template.latestVersion,
          updatedBy: ensureId(publishedBy, "publishedBy"),
        },
      }),
      prisma.templateVersion.update({
        where: { id: latestVersion.id },
        data: {
          publishedAt: new Date(),
        },
      }),
    ]);

    return TemplateService.getById(template.id);
  },

  async archive(
    templateId: string,
    archivedBy: string,
    organisationId?: string,
  ) {
    const template = await loadTemplateOrThrow(templateId, organisationId);

    await prisma.template.update({
      where: { id: template.id },
      data: {
        status: "ARCHIVED",
        updatedBy: ensureId(archivedBy, "archivedBy"),
      },
    });

    return TemplateService.getById(template.id);
  },

  async listForOrganisation(
    organisationId: string,
    filters?: {
      kind?: TemplateKind;
      status?: TemplateStatus;
      scope?: TemplateScope;
    },
  ) {
    const items = await prisma.template.findMany({
      where: {
        organisationId: ensureId(organisationId, "organisationId"),
        kind: filters?.kind,
        status: filters?.status,
        scope: filters?.scope,
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    return items;
  },

  async getById(templateId: string, organisationId?: string) {
    const template = await prisma.template.findUnique({
      where: { id: ensureId(templateId, "templateId") },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
      },
    });

    if (!template) {
      throw new TemplateServiceError("Template not found", 404);
    }

    assertTemplateOrganisation(template, organisationId);

    return template;
  },

  async createInstance(
    input: CreateTemplateInstanceInput & { templateId: string },
  ) {
    const parsed = createTemplateInstanceSchema.parse(input);
    const template = await loadTemplateOrThrow(
      input.templateId,
      parsed.organisationId,
    );
    const versionNumber = template.publishedVersion ?? template.latestVersion;
    const version = await loadTemplateVersionOrThrow(
      template.id,
      versionNumber,
    );

    return prisma.templateInstance.create({
      data: {
        templateId: template.id,
        templateVersion: version.version,
        organisationId: parsed.organisationId,
        appointmentId: parsed.appointmentId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        encounterId: parsed.encounterId ?? undefined,
        status: "DRAFT",
        data: parsed.data as Prisma.InputJsonValue,
        authorId: parsed.authorId ?? undefined,
      },
    });
  },

  async updateInstance(
    instanceId: string,
    input: UpdateTemplateInstanceInput,
    organisationId?: string,
  ) {
    const parsed = updateTemplateInstanceSchema.parse(input);
    const instance = await prisma.templateInstance.findUnique({
      where: { id: ensureId(instanceId, "instanceId") },
    });

    if (!instance) {
      throw new TemplateServiceError("Template instance not found", 404);
    }

    if (organisationId && instance.organisationId !== organisationId) {
      throw new TemplateServiceError(
        "Template instance does not belong to organisation",
        403,
      );
    }

    return prisma.templateInstance.update({
      where: { id: instance.id },
      data: {
        data:
          parsed.data === undefined
            ? toJsonInput(instance.data)
            : toJsonInput(mergeJsonObject(instance.data, parsed.data)),
        status: parsed.status ?? instance.status,
        signedBy:
          parsed.signedBy === undefined
            ? instance.signedBy
            : (parsed.signedBy ?? undefined),
        signedAt:
          parsed.signedAt === undefined
            ? instance.signedAt
            : (parsed.signedAt ?? undefined),
        generatedPdfUrl:
          parsed.generatedPdfUrl === undefined
            ? instance.generatedPdfUrl
            : (parsed.generatedPdfUrl ?? undefined),
        generatedPdf:
          parsed.generatedPdf === undefined
            ? toNullableJsonInput(instance.generatedPdf)
            : toNullableJsonInput(parsed.generatedPdf),
      },
    });
  },

  async submitInstance(instanceId: string, organisationId?: string) {
    const instance = await prisma.templateInstance.findUnique({
      where: { id: ensureId(instanceId, "instanceId") },
    });

    if (!instance) {
      throw new TemplateServiceError("Template instance not found", 404);
    }

    if (organisationId && instance.organisationId !== organisationId) {
      throw new TemplateServiceError(
        "Template instance does not belong to organisation",
        403,
      );
    }

    return prisma.templateInstance.update({
      where: { id: instance.id },
      data: {
        status: "COMPLETED",
      },
    });
  },
};
