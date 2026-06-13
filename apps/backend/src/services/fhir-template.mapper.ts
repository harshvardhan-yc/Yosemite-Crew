import {
  TemplateKind,
  TemplateOwnershipType,
  TemplateScope,
  TemplateStatus,
} from "@prisma/client";
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireResponse,
  PlanDefinition,
  PlanDefinitionAction,
  Bundle,
  Extension,
  CodeableConcept,
} from "@yosemite-crew/fhir";
import {
  FormField,
  FormSubmission,
  fromFHIRQuestionnaireResponse,
  toFHIRQuestionnaireResponse,
} from "@yosemite-crew/types";
import { z } from "zod";
import {
  templateFieldDefinitionSchema,
  templateSchemaSnapshotSchema,
} from "src/services/template.service";

const TEMPLATE_KIND_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-kind";
const TEMPLATE_OWNERSHIP_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-ownership";
const TEMPLATE_SCOPE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-scope";
const TEMPLATE_ORGANISATION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-organisation";
const TEMPLATE_OWNER_USER_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-owner-user";
const TEMPLATE_SCHEMA_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-schema-snapshot";
const TEMPLATE_RENDER_CONFIG_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-render-config-snapshot";
const TEMPLATE_VALIDATION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-validation-snapshot";
const TEMPLATE_LATEST_VERSION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-latest-version";
const TEMPLATE_PUBLISHED_VERSION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-published-version";
const TEMPLATE_VERSION_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-version";
const TEMPLATE_INSTANCE_STATUS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-status";
const TEMPLATE_INSTANCE_CASE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-case";
const TEMPLATE_INSTANCE_APPOINTMENT_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-appointment";
const TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-encounter";
const TEMPLATE_INSTANCE_GENERATED_PDF_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-generated-pdf-url";
const TEMPLATE_INSTANCE_GENERATED_PDF_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/template-instance-generated-pdf";

const FHIR_TEMPLATE_RESOURCE_KIND = new Set<TemplateKind>([
  "FORM",
  "SOAP_NOTE",
  "VITAL_RECORD",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
]);

const FHIR_PLAN_DEFINITION_RESOURCE_KIND = new Set<TemplateKind>([
  "TASK_TEMPLATE",
  "CARE_PATHWAY",
]);

type TemplateSchemaSnapshot = z.infer<typeof templateSchemaSnapshotSchema>;
type TemplateField = z.infer<typeof templateFieldDefinitionSchema>;
type TemplateVersionLike = {
  id: string;
  version: number;
  schemaSnapshot: unknown;
  renderConfigSnapshot: unknown;
  validationSnapshot: unknown;
  publishedAt?: Date | null;
  createdBy: string;
};

export type TemplateLike = {
  id: string;
  organisationId: string | null;
  ownerUserId: string | null;
  ownership: TemplateOwnershipType;
  kind: TemplateKind;
  name: string;
  description: string | null;
  status: TemplateStatus;
  scope: TemplateScope;
  rules: unknown;
  latestVersion: number;
  publishedVersion: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  versions?: TemplateVersionLike[];
};

export type TemplateInstanceLike = {
  id: string;
  templateId: string;
  templateVersion: number;
  organisationId: string;
  appointmentId?: string | null;
  caseId?: string | null;
  encounterId?: string | null;
  status: string;
  data: unknown;
  authorId?: string | null;
  signedBy?: string | null;
  signedAt?: Date | null;
  generatedPdfUrl?: string | null;
  generatedPdf?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const clinicalTemplateVersionMap = new Set<TemplateKind>(
  FHIR_TEMPLATE_RESOURCE_KIND,
);

const toIsoDate = (value?: Date | null) => {
  if (!value) return undefined;
  const iso = value.toISOString();
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
};

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

const toQuestionnaireStatus = (
  status: TemplateStatus,
): Questionnaire["status"] => {
  switch (status) {
    case "PUBLISHED":
      return "active";
    case "ARCHIVED":
      return "retired";
    case "DRAFT":
    default:
      return "draft";
  }
};

const toPlanDefinitionStatus = (
  status: TemplateStatus,
): PlanDefinition["status"] => {
  switch (status) {
    case "PUBLISHED":
      return "active";
    case "ARCHIVED":
      return "retired";
    case "DRAFT":
    default:
      return "draft";
  }
};

const buildTemplateExtensions = (template: TemplateLike): Extension[] => {
  const extensions: Extension[] = [
    { url: TEMPLATE_KIND_EXTENSION_URL, valueString: template.kind },
    { url: TEMPLATE_OWNERSHIP_EXTENSION_URL, valueString: template.ownership },
    { url: TEMPLATE_SCOPE_EXTENSION_URL, valueString: template.scope },
    {
      url: TEMPLATE_LATEST_VERSION_EXTENSION_URL,
      valueInteger: template.latestVersion,
    },
  ];

  if (template.organisationId) {
    extensions.push({
      url: TEMPLATE_ORGANISATION_EXTENSION_URL,
      valueString: template.organisationId,
    });
  }

  if (template.ownerUserId) {
    extensions.push({
      url: TEMPLATE_OWNER_USER_EXTENSION_URL,
      valueString: template.ownerUserId,
    });
  }

  if (template.publishedVersion !== null) {
    extensions.push({
      url: TEMPLATE_PUBLISHED_VERSION_EXTENSION_URL,
      valueInteger: template.publishedVersion,
    });
  }

  const latestVersion = template.versions?.[0];
  if (latestVersion) {
    extensions.push({
      url: TEMPLATE_VERSION_EXTENSION_URL,
      valueInteger: latestVersion.version,
    });
    extensions.push({
      url: TEMPLATE_SCHEMA_EXTENSION_URL,
      valueString: JSON.stringify(latestVersion.schemaSnapshot ?? {}),
    });
    if (latestVersion.renderConfigSnapshot !== undefined) {
      extensions.push({
        url: TEMPLATE_RENDER_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(latestVersion.renderConfigSnapshot ?? {}),
      });
    }
    if (latestVersion.validationSnapshot !== undefined) {
      extensions.push({
        url: TEMPLATE_VALIDATION_EXTENSION_URL,
        valueString: JSON.stringify(latestVersion.validationSnapshot ?? {}),
      });
    }
  }

  return extensions;
};

const buildPlanDefinitionExtensions = (template: TemplateLike): Extension[] => {
  return buildTemplateExtensions(template);
};

const fieldTypeToQuestionnaireType = (
  field: TemplateField,
): QuestionnaireItem["type"] => {
  switch (field.type) {
    case "textarea":
    case "richText":
      return "text";
    case "number":
      return "decimal";
    case "date":
      return "date";
    case "datetime":
      return "dateTime";
    case "select":
    case "multiSelect":
      return "choice";
    case "boolean":
      return "boolean";
    case "signature":
      return "attachment";
    case "table":
    case "repeater":
      return "group";
    case "instructionBlock":
      return "display";
    case "observation":
    case "vitalRow":
    case "medicationLine":
    case "diagnosis":
    case "procedure":
    case "assessmentItem":
    case "planItem":
      return "string";
    case "text":
    default:
      return "string";
  }
};

const fieldTypeToFormFieldType = (field: TemplateField): FormField["type"] => {
  switch (field.type) {
    case "textarea":
    case "richText":
      return "textarea";
    case "number":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "input";
    case "select":
      return "dropdown";
    case "multiSelect":
      return "checkbox";
    case "boolean":
      return "boolean";
    case "signature":
      return "signature";
    case "table":
    case "repeater":
      return "group";
    case "instructionBlock":
    case "observation":
    case "vitalRow":
    case "medicationLine":
    case "diagnosis":
    case "procedure":
    case "assessmentItem":
    case "planItem":
    case "text":
    default:
      return "input";
  }
};

const questionnaireItemToTemplateField = (
  item: QuestionnaireItem,
  order: number,
): TemplateField => {
  const fieldType = (() => {
    switch (item.type) {
      case "text":
        return "textarea";
      case "dateTime":
        return "datetime";
      case "date":
        return "date";
      case "choice":
        return item.repeats ? "multiSelect" : "select";
      case "boolean":
        return "boolean";
      case "attachment":
        return "signature";
      case "group":
        return item.repeats ? "repeater" : "table";
      case "display":
        return "instructionBlock";
      case "decimal":
      case "integer":
        return "number";
      case "string":
      default:
        return "text";
    }
  })();

  return {
    key: item.linkId,
    label: item.text ?? item.linkId,
    type: fieldType,
    required: item.required,
    repeatable: item.repeats,
    order,
    options:
      item.answerOption?.map((option) => ({
        label:
          option.valueCoding?.display ??
          option.valueCoding?.code ??
          option.valueString ??
          "",
        value:
          option.valueCoding?.code ??
          option.valueCoding?.display ??
          option.valueString ??
          "",
      })) ?? undefined,
    rules: undefined,
    visibilityConditions: undefined,
    source: undefined,
  };
};

const templateSectionToQuestionnaireItems = (
  section: TemplateSchemaSnapshot["sections"][number],
): QuestionnaireItem[] =>
  section.fields.map((field, index) => {
    const item: QuestionnaireItem = {
      linkId: field.key,
      text: field.label,
      type: fieldTypeToQuestionnaireType(field),
      required: field.required,
      repeats: field.repeatable,
      answerOption:
        field.options?.map(
          (option) =>
            ({
              valueCoding: {
                code: option.value,
                display: option.label,
              },
            }) as unknown as QuestionnaireItemAnswerOption,
        ) ?? undefined,
      extension: undefined,
    };

    if (field.type === "table" || field.type === "repeater") {
      item.item = [];
    }

    if (field.order !== undefined) {
      item.extension = [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/template-field-order",
          valueInteger: field.order ?? index,
        },
      ];
    }

    return item;
  });

const questionnaireItemsToTemplateSections = (
  items: QuestionnaireItem[] | undefined,
): TemplateSchemaSnapshot["sections"] => {
  if (!items || items.length === 0) return [];

  const groups = items.filter(
    (item) => item.type === "group" && item.item?.length,
  );
  if (groups.length > 0) {
    return groups.map((group, index) => ({
      id: group.linkId,
      title: group.text ?? group.linkId,
      order: index,
      fields: (group.item ?? []).map((child, childIndex) =>
        questionnaireItemToTemplateField(child, childIndex),
      ),
    }));
  }

  return [
    {
      id: "main",
      title: "Main",
      order: 0,
      fields: items.map((item, index) =>
        questionnaireItemToTemplateField(item, index),
      ),
    },
  ];
};

const questionnaireResourceToSchemaSnapshot = (
  questionnaire: Questionnaire,
): TemplateSchemaSnapshot => {
  const snapshotFromExtension = parseJson<TemplateSchemaSnapshot>(
    getStringExtension(questionnaire.extension, TEMPLATE_SCHEMA_EXTENSION_URL),
  );

  if (snapshotFromExtension?.sections) {
    return templateSchemaSnapshotSchema.parse(snapshotFromExtension);
  }

  return {
    sections: questionnaireItemsToTemplateSections(questionnaire.item),
  };
};

const planDefinitionActionToTemplateSections = (
  actions: PlanDefinitionAction[] | undefined,
): TemplateSchemaSnapshot["sections"] => {
  if (!actions || actions.length === 0) return [];

  return actions.map((action, index) => ({
    id: action.id ?? `section-${index + 1}`,
    title:
      action.title ?? action.description ?? action.id ?? `Section ${index + 1}`,
    description: action.description,
    order: index,
    fields: (action.action ?? []).map((subAction, childIndex) => ({
      key: subAction.id ?? `field-${index + 1}-${childIndex + 1}`,
      label:
        subAction.title ??
        subAction.description ??
        subAction.id ??
        `Field ${childIndex + 1}`,
      type: "text",
      required: subAction.requiredBehavior === "must",
      repeatable: subAction.cardinalityBehavior === "multiple",
      order: childIndex,
      options: undefined,
      rules: subAction.extension
        ? { extensions: subAction.extension }
        : undefined,
      visibilityConditions: undefined,
      source: undefined,
    })),
  }));
};

const planDefinitionResourceToSchemaSnapshot = (
  planDefinition: PlanDefinition,
): TemplateSchemaSnapshot => {
  const snapshotFromExtension = parseJson<TemplateSchemaSnapshot>(
    getStringExtension(planDefinition.extension, TEMPLATE_SCHEMA_EXTENSION_URL),
  );

  if (snapshotFromExtension?.sections) {
    return templateSchemaSnapshotSchema.parse(snapshotFromExtension);
  }

  return {
    sections: planDefinitionActionToTemplateSections(planDefinition.action),
  };
};

const templateSchemaToQuestionnaireItems = (
  snapshot: TemplateSchemaSnapshot,
): QuestionnaireItem[] =>
  snapshot.sections.map((section) => ({
    linkId: section.id,
    text: section.title,
    type: "group",
    required: false,
    item: templateSectionToQuestionnaireItems({
      ...section,
      fields: section.fields ?? [],
    }),
  }));

const templateSchemaToPlanDefinitionActions = (
  snapshot: TemplateSchemaSnapshot,
): PlanDefinitionAction[] =>
  snapshot.sections.map((section, index) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    prefix:
      typeof section.order === "number"
        ? String(section.order + 1)
        : String(index + 1),
    action: (section.fields ?? []).map((field, fieldIndex) => ({
      id: field.key,
      title: field.label,
      description: field.label,
      prefix:
        typeof field.order === "number"
          ? String(field.order + 1)
          : String(fieldIndex + 1),
      type: {
        coding: [
          {
            code: field.type,
            display: field.label,
          },
        ],
      } as CodeableConcept,
      groupingBehavior:
        field.type === "repeater" ? "logical-group" : "visual-group",
      selectionBehavior: field.repeatable ? "multiple" : "one-or-more",
      requiredBehavior: field.required ? "must" : undefined,
      cardinalityBehavior: field.repeatable ? "multiple" : "single",
    })),
  }));

const templateVersionsToLatestSchema = (template: TemplateLike) => {
  const version = template.versions?.[0];
  if (!version) {
    return templateSchemaSnapshotSchema.parse({ sections: [] });
  }

  return templateSchemaSnapshotSchema.parse(
    version.schemaSnapshot ?? { sections: [] },
  );
};

const mapTemplateToQuestionnaire = (template: TemplateLike): Questionnaire => {
  const latestSchema = templateVersionsToLatestSchema(template);
  return {
    resourceType: "Questionnaire",
    id: template.id,
    status: toQuestionnaireStatus(template.status),
    title: template.name,
    description: template.description ?? undefined,
    identifier: template.organisationId
      ? [
          {
            system:
              "https://yosemitecrew.com/fhir/NamingSystem/template-organisation",
            value: template.organisationId,
          },
        ]
      : undefined,
    code: [
      {
        system: "https://yosemitecrew.com/fhir/CodeSystem/template-kind",
        code: template.kind,
        display: template.kind,
      },
    ],
    extension: [
      ...buildTemplateExtensions(template),
      {
        url: TEMPLATE_SCHEMA_EXTENSION_URL,
        valueString: JSON.stringify(latestSchema),
      },
    ],
    meta: {
      lastUpdated: toIsoDate(template.updatedAt),
    },
    item: templateSchemaToQuestionnaireItems(latestSchema),
  };
};

const mapTemplateToPlanDefinition = (
  template: TemplateLike,
): PlanDefinition => {
  const latestSchema = templateVersionsToLatestSchema(template);
  return {
    resourceType: "PlanDefinition",
    id: template.id,
    status: toPlanDefinitionStatus(template.status),
    title: template.name,
    description: template.description ?? undefined,
    identifier: template.organisationId
      ? [
          {
            system:
              "https://yosemitecrew.com/fhir/NamingSystem/template-organisation",
            value: template.organisationId,
          },
        ]
      : undefined,
    type: {
      coding: [
        {
          system: "https://yosemitecrew.com/fhir/CodeSystem/template-kind",
          code: template.kind,
          display: template.kind,
        },
      ],
    } as CodeableConcept,
    extension: [
      ...buildPlanDefinitionExtensions(template),
      {
        url: TEMPLATE_SCHEMA_EXTENSION_URL,
        valueString: JSON.stringify(latestSchema),
      },
    ],
    meta: {
      lastUpdated: toIsoDate(template.updatedAt),
    },
    action: templateSchemaToPlanDefinitionActions(latestSchema),
  };
};

const templateInstanceStatusToQuestionnaireStatus = (
  status: TemplateInstanceLike["status"],
): QuestionnaireResponse["status"] => {
  switch (status) {
    case "COMPLETED":
    case "SIGNED":
      return "completed";
    case "VOID":
      return "stopped";
    case "IN_PROGRESS":
    case "DRAFT":
    default:
      return "in-progress";
  }
};

const instanceToSubmission = (
  instance: TemplateInstanceLike,
): FormSubmission => ({
  _id: instance.id,
  formId: instance.templateId,
  formVersion: instance.templateVersion,
  appointmentId: instance.appointmentId ?? undefined,
  companionId: undefined,
  parentId: undefined,
  submittedBy: instance.authorId ?? undefined,
  answers:
    typeof instance.data === "object" &&
    instance.data &&
    !Array.isArray(instance.data)
      ? (instance.data as Record<string, unknown>)
      : {},
  submittedAt: instance.updatedAt ?? instance.createdAt,
  signing:
    instance.signedBy || instance.signedAt
      ? {
          required: true,
          status: instance.signedAt ? "SIGNED" : "IN_PROGRESS",
          provider: "DOCUMENSO",
          signer: instance.signedBy
            ? {
                userId: instance.signedBy,
                role: "VET",
              }
            : undefined,
          signedAt: instance.signedAt ?? undefined,
        }
      : undefined,
});

const templateSchemaToFormFields = (
  snapshot: TemplateSchemaSnapshot,
): FormField[] =>
  snapshot.sections.map((section) => ({
    id: section.id,
    type: "group",
    label: section.title,
    fields: (section.fields ?? []).map((field) => ({
      id: field.key,
      type: fieldTypeToFormFieldType(field),
      label: field.label,
      required: field.required,
      order: field.order,
      options: field.options,
    })),
  })) as FormField[];

const questionnaireResponseToInstanceStatus = (
  status: QuestionnaireResponse["status"],
) => {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "stopped":
    case "entered-in-error":
      return "VOID";
    case "amended":
      return "IN_PROGRESS";
    default:
      return "IN_PROGRESS";
  }
};

export const templateMapper = {
  isQuestionnaireResourceKind(kind: TemplateKind) {
    return clinicalTemplateVersionMap.has(kind);
  },

  isPlanDefinitionResourceKind(kind: TemplateKind) {
    return FHIR_PLAN_DEFINITION_RESOURCE_KIND.has(kind);
  },

  listBundle<T>(
    resources: T[],
    resourceBuilder: (resource: T) => Questionnaire | PlanDefinition,
  ) {
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: resources.length,
      entry: resources.map((resource) => ({
        resource: resourceBuilder(resource),
      })),
    } satisfies Bundle;
  },

  templateToQuestionnaire: mapTemplateToQuestionnaire,
  templateToPlanDefinition: mapTemplateToPlanDefinition,

  questionnaireToTemplateSchemaSnapshot(
    questionnaire: Questionnaire,
  ): TemplateSchemaSnapshot {
    return questionnaireResourceToSchemaSnapshot(questionnaire);
  },

  planDefinitionToTemplateSchemaSnapshot(
    planDefinition: PlanDefinition,
  ): TemplateSchemaSnapshot {
    return planDefinitionResourceToSchemaSnapshot(planDefinition);
  },

  questionnaireToTemplateInput(
    questionnaire: Questionnaire,
    defaults?: {
      createdBy: string;
      updatedBy?: string;
      organisationId?: string;
      ownerUserId?: string;
      ownership?: TemplateOwnershipType;
      scope?: TemplateScope;
      kind?: TemplateKind;
    },
  ) {
    const kind = (() => {
      const extensionKind = getStringExtension(
        questionnaire.extension,
        TEMPLATE_KIND_EXTENSION_URL,
      );
      if (
        extensionKind &&
        templateMapper.isQuestionnaireResourceKind(
          extensionKind as TemplateKind,
        )
      ) {
        return extensionKind as TemplateKind;
      }

      const code = questionnaire.code?.[0]?.code;
      if (
        code &&
        templateMapper.isQuestionnaireResourceKind(code as TemplateKind)
      ) {
        return code as TemplateKind;
      }

      return defaults?.kind ?? "FORM";
    })();

    return {
      organisationId:
        getStringExtension(
          questionnaire.extension,
          TEMPLATE_ORGANISATION_EXTENSION_URL,
        ) ?? defaults?.organisationId,
      ownerUserId:
        getStringExtension(
          questionnaire.extension,
          TEMPLATE_OWNER_USER_EXTENSION_URL,
        ) ?? defaults?.ownerUserId,
      ownership:
        (getStringExtension(
          questionnaire.extension,
          TEMPLATE_OWNERSHIP_EXTENSION_URL,
        ) as TemplateOwnershipType | undefined) ??
        defaults?.ownership ??
        "ORG_TEMPLATE",
      kind,
      name: questionnaire.title ?? questionnaire.name ?? "Untitled template",
      description: questionnaire.description ?? undefined,
      scope:
        (getStringExtension(
          questionnaire.extension,
          TEMPLATE_SCOPE_EXTENSION_URL,
        ) as TemplateScope | undefined) ??
        defaults?.scope ??
        "ORGANISATION",
      rules: undefined,
      schemaSnapshot: questionnaireResourceToSchemaSnapshot(questionnaire),
      renderConfigSnapshot: parseJson(
        questionnaire.extension?.find(
          (extension) => extension.url === TEMPLATE_RENDER_CONFIG_EXTENSION_URL,
        )?.valueString,
      ),
      validationSnapshot: parseJson(
        questionnaire.extension?.find(
          (extension) => extension.url === TEMPLATE_VALIDATION_EXTENSION_URL,
        )?.valueString,
      ),
      createdBy: defaults?.createdBy,
      updatedBy: defaults?.updatedBy ?? defaults?.createdBy,
    };
  },

  planDefinitionToTemplateInput(
    planDefinition: PlanDefinition,
    defaults?: {
      createdBy: string;
      updatedBy?: string;
      organisationId?: string;
      ownerUserId?: string;
      ownership?: TemplateOwnershipType;
      scope?: TemplateScope;
      kind?: TemplateKind;
    },
  ) {
    const kind = (() => {
      const extensionKind = getStringExtension(
        planDefinition.extension,
        TEMPLATE_KIND_EXTENSION_URL,
      );
      if (
        extensionKind &&
        templateMapper.isPlanDefinitionResourceKind(
          extensionKind as TemplateKind,
        )
      ) {
        return extensionKind as TemplateKind;
      }

      const code = planDefinition.type?.coding?.[0]?.code;
      if (
        code &&
        templateMapper.isPlanDefinitionResourceKind(code as TemplateKind)
      ) {
        return code as TemplateKind;
      }

      return defaults?.kind ?? "TASK_TEMPLATE";
    })();

    return {
      organisationId:
        getStringExtension(
          planDefinition.extension,
          TEMPLATE_ORGANISATION_EXTENSION_URL,
        ) ?? defaults?.organisationId,
      ownerUserId:
        getStringExtension(
          planDefinition.extension,
          TEMPLATE_OWNER_USER_EXTENSION_URL,
        ) ?? defaults?.ownerUserId,
      ownership:
        (getStringExtension(
          planDefinition.extension,
          TEMPLATE_OWNERSHIP_EXTENSION_URL,
        ) as TemplateOwnershipType | undefined) ??
        defaults?.ownership ??
        "ORG_TEMPLATE",
      kind,
      name:
        planDefinition.title ??
        planDefinition.name ??
        "Untitled workflow template",
      description: planDefinition.description ?? undefined,
      scope:
        (getStringExtension(
          planDefinition.extension,
          TEMPLATE_SCOPE_EXTENSION_URL,
        ) as TemplateScope | undefined) ??
        defaults?.scope ??
        "ORGANISATION",
      rules: undefined,
      schemaSnapshot: planDefinitionResourceToSchemaSnapshot(planDefinition),
      renderConfigSnapshot: parseJson(
        planDefinition.extension?.find(
          (extension) => extension.url === TEMPLATE_RENDER_CONFIG_EXTENSION_URL,
        )?.valueString,
      ),
      validationSnapshot: parseJson(
        planDefinition.extension?.find(
          (extension) => extension.url === TEMPLATE_VALIDATION_EXTENSION_URL,
        )?.valueString,
      ),
      createdBy: defaults?.createdBy,
      updatedBy: defaults?.updatedBy ?? defaults?.createdBy,
    };
  },

  templateInstanceToQuestionnaireResponse(
    instance: TemplateInstanceLike,
    template: TemplateLike,
  ): QuestionnaireResponse {
    const latestSchema = templateVersionsToLatestSchema(template);
    const formFields = templateSchemaToFormFields(latestSchema);
    const submission = instanceToSubmission(instance);
    const questionnaireResponse = toFHIRQuestionnaireResponse(
      submission,
      formFields,
    );

    return {
      ...questionnaireResponse,
      status: templateInstanceStatusToQuestionnaireStatus(instance.status),
      extension: [
        ...(questionnaireResponse.extension ?? []),
        {
          url: TEMPLATE_VERSION_EXTENSION_URL,
          valueInteger: instance.templateVersion,
        },
        {
          url: TEMPLATE_INSTANCE_STATUS_EXTENSION_URL,
          valueString: instance.status,
        },
        instance.caseId
          ? {
              url: TEMPLATE_INSTANCE_CASE_EXTENSION_URL,
              valueString: instance.caseId,
            }
          : undefined,
        instance.encounterId
          ? {
              url: TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL,
              valueString: instance.encounterId,
            }
          : undefined,
        instance.generatedPdfUrl
          ? {
              url: TEMPLATE_INSTANCE_GENERATED_PDF_URL,
              valueString: instance.generatedPdfUrl,
            }
          : undefined,
        instance.generatedPdf
          ? {
              url: TEMPLATE_INSTANCE_GENERATED_PDF_EXTENSION_URL,
              valueString: JSON.stringify(instance.generatedPdf),
            }
          : undefined,
      ].filter(Boolean) as Extension[],
    };
  },

  questionnaireResponseToTemplateInstance(
    response: QuestionnaireResponse,
    template: TemplateLike,
  ) {
    const latestSchema = templateVersionsToLatestSchema(template);
    const formFields = templateSchemaToFormFields(latestSchema);
    const submission = fromFHIRQuestionnaireResponse(response, formFields);

    return {
      organisationId:
        getStringExtension(
          response.extension,
          TEMPLATE_ORGANISATION_EXTENSION_URL,
        ) ??
        template.organisationId ??
        undefined,
      appointmentId: getStringExtension(
        response.extension,
        TEMPLATE_INSTANCE_APPOINTMENT_EXTENSION_URL,
      ),
      caseId: getStringExtension(
        response.extension,
        TEMPLATE_INSTANCE_CASE_EXTENSION_URL,
      ),
      encounterId: getStringExtension(
        response.extension,
        TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL,
      ),
      authorId: submission.submittedBy || undefined,
      data: submission.answers,
      status: questionnaireResponseToInstanceStatus(response.status),
    };
  },
};
