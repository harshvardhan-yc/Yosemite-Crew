import { TemplateKind } from "@prisma/client";

type BlueprintFieldType =
  | "text"
  | "textarea"
  | "datetime"
  | "number"
  | "select"
  | "multiSelect"
  | "boolean"
  | "signature"
  | "table"
  | "repeater"
  | "medicationLine"
  | "diagnosis"
  | "procedure"
  | "instructionBlock"
  | "assessmentItem"
  | "planItem"
  | "richText"
  | "vitalRow";

type BlueprintField = {
  key: string;
  label: string;
  type: BlueprintFieldType;
  required?: boolean;
  repeatable?: boolean;
  section?: string;
  order?: number;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  rules?: Record<string, unknown>;
  visibilityConditions?: Record<string, unknown>;
  source?: "USER" | "SYSTEM" | "TASK" | "FHIR";
};

type BlueprintSection = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields: BlueprintField[];
};

export type ClinicalTemplateKind =
  | "SOAP_NOTE"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "VITAL_RECORD";

export type ClinicalTemplateSchemaSnapshot = {
  sections: BlueprintSection[];
};

const clinicalBlueprints: Record<
  ClinicalTemplateKind,
  ClinicalTemplateSchemaSnapshot
> = {
  SOAP_NOTE: {
    sections: [
      {
        id: "subjective",
        title: "Subjective",
        order: 1,
        fields: [
          {
            key: "chiefComplaint",
            label: "Chief complaint",
            type: "textarea",
            required: true,
            order: 1,
          },
          {
            key: "history",
            label: "History",
            type: "richText",
            order: 2,
          },
          {
            key: "ownerConcern",
            label: "Owner concern",
            type: "text",
            order: 3,
          },
        ],
      },
      {
        id: "objective",
        title: "Objective",
        order: 2,
        fields: [
          {
            key: "vitals",
            label: "Vitals",
            type: "vitalRow",
            repeatable: true,
            order: 1,
          },
          {
            key: "examFindings",
            label: "Exam findings",
            type: "richText",
            order: 2,
          },
          {
            key: "testResults",
            label: "Test results",
            type: "table",
            order: 3,
          },
        ],
      },
      {
        id: "assessment",
        title: "Assessment",
        order: 3,
        fields: [
          {
            key: "diagnoses",
            label: "Diagnoses",
            type: "diagnosis",
            repeatable: true,
            order: 1,
          },
          {
            key: "assessmentNotes",
            label: "Assessment notes",
            type: "richText",
            order: 2,
          },
          {
            key: "severity",
            label: "Severity",
            type: "select",
            order: 3,
            options: [
              { label: "Mild", value: "mild" },
              { label: "Moderate", value: "moderate" },
              { label: "Severe", value: "severe" },
            ],
          },
        ],
      },
      {
        id: "plan",
        title: "Plan",
        order: 4,
        fields: [
          {
            key: "medications",
            label: "Medications",
            type: "medicationLine",
            repeatable: true,
            order: 1,
          },
          {
            key: "procedures",
            label: "Procedures",
            type: "procedure",
            repeatable: true,
            order: 2,
          },
          {
            key: "instructions",
            label: "Instructions",
            type: "instructionBlock",
            order: 3,
          },
          {
            key: "followUp",
            label: "Follow up",
            type: "datetime",
            order: 4,
          },
        ],
      },
    ],
  },
  PRESCRIPTION: {
    sections: [
      {
        id: "medications",
        title: "Medications",
        order: 1,
        fields: [
          {
            key: "prescribedItems",
            label: "Prescribed items",
            type: "medicationLine",
            repeatable: true,
            order: 1,
          },
        ],
      },
      {
        id: "instructions",
        title: "Instructions",
        order: 2,
        fields: [
          {
            key: "usageInstructions",
            label: "Usage instructions",
            type: "instructionBlock",
            order: 1,
          },
        ],
      },
      {
        id: "notes",
        title: "Notes",
        order: 3,
        fields: [
          {
            key: "clinicalNotes",
            label: "Clinical notes",
            type: "richText",
            order: 1,
          },
        ],
      },
    ],
  },
  DISCHARGE_SUMMARY: {
    sections: [
      {
        id: "summary",
        title: "Summary",
        order: 1,
        fields: [
          {
            key: "summaryText",
            label: "Summary text",
            type: "richText",
            order: 1,
          },
        ],
      },
      {
        id: "diagnoses",
        title: "Diagnoses",
        order: 2,
        fields: [
          {
            key: "diagnosisItems",
            label: "Diagnosis items",
            type: "diagnosis",
            repeatable: true,
            order: 1,
          },
        ],
      },
      {
        id: "medications",
        title: "Medications",
        order: 3,
        fields: [
          {
            key: "medicationLines",
            label: "Medication lines",
            type: "medicationLine",
            repeatable: true,
            order: 1,
          },
        ],
      },
      {
        id: "follow_up",
        title: "Follow Up",
        order: 4,
        fields: [
          {
            key: "followUpDate",
            label: "Follow up date",
            type: "datetime",
            order: 1,
          },
        ],
      },
      {
        id: "instructions",
        title: "Instructions",
        order: 5,
        fields: [
          {
            key: "dischargeInstructions",
            label: "Discharge instructions",
            type: "instructionBlock",
            order: 1,
          },
        ],
      },
    ],
  },
  VITAL_RECORD: {
    sections: [
      {
        id: "measured_at",
        title: "Measured At",
        order: 1,
        fields: [
          {
            key: "measuredAt",
            label: "Measured at",
            type: "datetime",
            required: true,
            order: 1,
          },
        ],
      },
      {
        id: "vitals",
        title: "Vitals",
        order: 2,
        fields: [
          {
            key: "vitalRows",
            label: "Vital rows",
            type: "vitalRow",
            repeatable: true,
            order: 1,
          },
        ],
      },
      {
        id: "notes",
        title: "Notes",
        order: 3,
        fields: [
          {
            key: "recordNotes",
            label: "Record notes",
            type: "richText",
            order: 1,
          },
        ],
      },
      {
        id: "metadata",
        title: "Metadata",
        order: 4,
        fields: [
          {
            key: "recordedBy",
            label: "Recorded by",
            type: "text",
            order: 1,
          },
        ],
      },
    ],
  },
};

const kindToRequiredSectionIds: Record<ClinicalTemplateKind, string[]> = {
  SOAP_NOTE: ["subjective", "objective", "assessment", "plan"],
  PRESCRIPTION: ["medications", "instructions", "notes"],
  DISCHARGE_SUMMARY: [
    "summary",
    "diagnoses",
    "medications",
    "follow_up",
    "instructions",
  ],
  VITAL_RECORD: ["measured_at", "vitals", "notes", "metadata"],
};

const isClinicalTemplateKind = (
  kind: TemplateKind,
): kind is ClinicalTemplateKind =>
  kind === "SOAP_NOTE" ||
  kind === "PRESCRIPTION" ||
  kind === "DISCHARGE_SUMMARY" ||
  kind === "VITAL_RECORD";

export const getClinicalTemplateBlueprint = (
  kind: ClinicalTemplateKind,
): ClinicalTemplateSchemaSnapshot => clinicalBlueprints[kind];

export const buildClinicalTemplateSchemaSnapshot = (
  kind: ClinicalTemplateKind,
): ClinicalTemplateSchemaSnapshot => ({
  sections: clinicalBlueprints[kind].sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field })),
  })),
});

export const validateClinicalTemplateBlueprint = (
  kind: TemplateKind,
  snapshot: unknown,
) => {
  if (!isClinicalTemplateKind(kind)) {
    return { requiredSectionIds: [], missingSectionIds: [] as string[] };
  }

  const sections =
    snapshot && typeof snapshot === "object" && "sections" in snapshot
      ? (snapshot as { sections?: Array<{ id?: string }> }).sections
      : undefined;

  const sectionIds = new Set(
    (sections ?? [])
      .map((section) => section?.id?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  const requiredSectionIds = kindToRequiredSectionIds[kind];
  const missingSectionIds = requiredSectionIds.filter(
    (sectionId) => !sectionIds.has(sectionId),
  );

  return { requiredSectionIds, missingSectionIds };
};

export const getClinicalTemplateKinds = () =>
  Object.keys(clinicalBlueprints) as ClinicalTemplateKind[];
