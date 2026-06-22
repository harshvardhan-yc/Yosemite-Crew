import {
  buildClinicalTemplateSchemaSnapshot,
  buildDefaultSoapNoteSchemaSnapshot,
} from "src/services/clinical-template-blueprints";

export type DefaultLibraryTemplateSeed = {
  id: string;
  kind: "SOAP_NOTE" | "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "VITAL_RECORD";
  name: string;
  description: string;
  schemaSnapshot: ReturnType<typeof buildClinicalTemplateSchemaSnapshot>;
};

const defaultSeedRules = {
  appliesTo: {
    defaultForKind: true,
  },
} as const;

export const DEFAULT_LIBRARY_TEMPLATE_SEEDS: Array<
  DefaultLibraryTemplateSeed & {
    ownership: "YC_LIBRARY";
    scope: "ORGANISATION";
    rules: typeof defaultSeedRules;
  }
> = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    ownership: "YC_LIBRARY",
    kind: "SOAP_NOTE",
    name: "Default SOAP note",
    description: "Fallback SOAP note template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildDefaultSoapNoteSchemaSnapshot(),
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    ownership: "YC_LIBRARY",
    kind: "PRESCRIPTION",
    name: "Default prescription",
    description: "Fallback prescription template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot("PRESCRIPTION"),
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    ownership: "YC_LIBRARY",
    kind: "DISCHARGE_SUMMARY",
    name: "Default discharge summary",
    description:
      "Fallback discharge summary template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot("DISCHARGE_SUMMARY"),
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    ownership: "YC_LIBRARY",
    kind: "VITAL_RECORD",
    name: "Default vital record",
    description: "Fallback vital record template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot("VITAL_RECORD"),
  },
];
