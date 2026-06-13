import {
  Bundle,
  CodeableConcept,
  Composition,
  Extension,
  MedicationRequest,
  Observation,
  Reference,
} from "@yosemite-crew/fhir";
import type {
  DischargeSummaryRecord,
  DischargeSummaryInput,
  PrescriptionRecord,
  PrescriptionInput,
  SoapNoteRecord,
  SoapNoteInput,
  VitalRecordRecord,
  VitalRecordInput,
} from "./clinical-artifact.service";

const SOAP_SUBJECTIVE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-subjective";
const SOAP_OBJECTIVE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-objective";
const SOAP_ASSESSMENT_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-assessment";
const SOAP_PLAN_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-plan";
const SOAP_DIAGNOSES_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-diagnoses";
const SOAP_METADATA_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/soap-note-metadata";

const PRESCRIPTION_MEDICATIONS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/prescription-medications";
const PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/prescription-instructions";
const PRESCRIPTION_NOTES_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/prescription-notes";
const PRESCRIPTION_METADATA_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/prescription-metadata";

const DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-content";
const DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-diagnoses";
const DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-medications";
const DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-follow-up";
const DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-instructions";
const DISCHARGE_SUMMARY_METADATA_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-metadata";

const VITALS_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/vital-record-vitals";
const VITALS_NOTES_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/vital-record-notes";
const VITALS_METADATA_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/vital-record-metadata";

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const toReference = (reference?: string | null): Reference | undefined => {
  if (!reference) return undefined;
  return {
    reference,
  };
};

const clinicalContextReference = (artifact: {
  encounterId: string | null;
  appointmentId: string | null;
}) => {
  if (artifact.encounterId) {
    return `Encounter/${artifact.encounterId}`;
  }
  if (artifact.appointmentId) {
    return `Appointment/${artifact.appointmentId}`;
  }
  return undefined;
};

const toCodeableConcept = (code: string, display: string): CodeableConcept => ({
  coding: [
    {
      system: "https://yosemitecrew.com/fhir/CodeSystem/clinical-artifact-kind",
      code,
      display,
    },
  ],
  text: display,
});

const toStatus = (status: string): string => {
  switch (status) {
    case "SIGNED":
      return "final";
    case "IN_PROGRESS":
      return "preliminary";
    case "CANCELLED":
      return "entered-in-error";
    default:
      return "preliminary";
  }
};

const toTaskStatus = (status: string): string => {
  switch (status) {
    case "SIGNED":
      return "active";
    case "IN_PROGRESS":
      return "accepted";
    case "CANCELLED":
      return "cancelled";
    case "ARCHIVED":
      return "completed";
    default:
      return "draft";
  }
};

const stringifyMaybe = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "[object]";
  }
};

const parseFlexibleJson = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const getExtensionValue = (
  extensions: Extension[] | undefined,
  url: string,
): unknown => {
  const extension = extensions?.find((item) => item.url === url);
  if (!extension) return undefined;
  return (
    extension.valueString ??
    extension.valueBoolean ??
    extension.valueInteger ??
    extension.valueDecimal ??
    extension.valueDateTime ??
    extension.valueDate ??
    extension.valueCode ??
    extension.valueUri ??
    extension.valueUrl ??
    extension.valueInstant ??
    extension.valueId ??
    extension.valueMarkdown ??
    extension.valueUuid ??
    extension.valueCanonical ??
    extension.valueReference ??
    undefined
  );
};

const buildJsonExtension = (url: string, value: unknown): Extension | null => {
  if (value === undefined) return null;
  return {
    url,
    valueString: stringifyMaybe(value),
  };
};

const buildCompositionExtensions = (
  record: SoapNoteRecord | DischargeSummaryRecord,
  fields: Record<string, unknown>,
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id",
        valueString: record.artifact.id,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind",
        valueString: record.artifact.kind,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status",
        valueString: record.artifact.status,
      },
    ]);

const buildPrescriptionExtensions = (
  record: PrescriptionRecord,
  fields: Record<string, unknown>,
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id",
        valueString: record.artifact.id,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind",
        valueString: record.artifact.kind,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status",
        valueString: record.artifact.status,
      },
    ]);

const buildObservationExtensions = (
  record: VitalRecordRecord,
  fields: Record<string, unknown>,
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id",
        valueString: record.artifact.id,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind",
        valueString: record.artifact.kind,
      },
      {
        url: "https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status",
        valueString: record.artifact.status,
      },
    ]);

const recordBundle = <T extends { artifact: { id: string } }>(
  records: T[],
  toResource: (record: T) => unknown,
): Bundle => ({
  resourceType: "Bundle",
  type: "searchset",
  total: records.length,
  entry: records.map((record) => ({
    fullUrl: `urn:uuid:${record.artifact.id}`,
    resource: toResource(record) as never,
  })),
});

const soapNoteToComposition = (record: SoapNoteRecord): Composition => ({
  resourceType: "Composition",
  id: record.artifact.id,
  status: toStatus(record.artifact.status),
  type: toCodeableConcept("SOAP_NOTE", "SOAP note"),
  title: record.artifact.summary ?? "SOAP note",
  date: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  author: [
    record.artifact.authorId
      ? { reference: `Practitioner/${record.artifact.authorId}` }
      : { display: "System" },
  ],
  encounter: toReference(clinicalContextReference(record.artifact)),
  extension: buildCompositionExtensions(record, {
    [SOAP_SUBJECTIVE_EXTENSION_URL]: record.soapNote.subjective,
    [SOAP_OBJECTIVE_EXTENSION_URL]: record.soapNote.objective,
    [SOAP_ASSESSMENT_EXTENSION_URL]: record.soapNote.assessment,
    [SOAP_PLAN_EXTENSION_URL]: record.soapNote.plan,
    [SOAP_DIAGNOSES_EXTENSION_URL]: record.soapNote.diagnoses,
    [SOAP_METADATA_EXTENSION_URL]: record.soapNote.metadata,
  }),
});

const compositionToSoapNoteInput = (
  resource: Composition,
  defaults: {
    organisationId: string;
    appointmentId?: string;
    caseId?: string;
    encounterId?: string;
    authorId?: string;
    templateId?: string;
    templateVersion?: number;
    templateVersionId?: string;
  },
): SoapNoteInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  summary: resource.title,
  subjective: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_SUBJECTIVE_EXTENSION_URL),
  ),
  objective: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_OBJECTIVE_EXTENSION_URL),
  ),
  assessment: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_ASSESSMENT_EXTENSION_URL),
  ),
  plan: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_PLAN_EXTENSION_URL),
  ),
  diagnoses: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_DIAGNOSES_EXTENSION_URL),
  ),
  metadata: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_METADATA_EXTENSION_URL),
  ),
});

const prescriptionToMedicationRequest = (
  record: PrescriptionRecord,
): MedicationRequest => ({
  resourceType: "MedicationRequest",
  id: record.artifact.id,
  status: toTaskStatus(record.artifact.status),
  intent: "order",
  medicationCodeableConcept: toCodeableConcept("PRESCRIPTION", "Prescription"),
  medicationReference: {
    reference: `MedicationRequest/${record.artifact.id}`,
  },
  subject: {
    reference:
      clinicalContextReference(record.artifact) ?? `Task/${record.artifact.id}`,
  },
  encounter: toReference(clinicalContextReference(record.artifact)),
  authoredOn: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  requester: record.artifact.authorId
    ? { reference: `Practitioner/${record.artifact.authorId}` }
    : undefined,
  note:
    typeof record.prescription.notes === "string"
      ? [{ text: record.prescription.notes }]
      : undefined,
  dosageInstruction:
    typeof record.prescription.instructions === "string"
      ? [{ text: record.prescription.instructions }]
      : undefined,
  extension: buildPrescriptionExtensions(record, {
    [PRESCRIPTION_MEDICATIONS_EXTENSION_URL]: record.prescription.medications,
    [PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL]: record.prescription.instructions,
    [PRESCRIPTION_NOTES_EXTENSION_URL]: record.prescription.notes,
    [PRESCRIPTION_METADATA_EXTENSION_URL]: record.prescription.metadata,
  }),
});

const medicationRequestToPrescriptionInput = (
  resource: MedicationRequest,
  defaults: {
    organisationId: string;
    appointmentId?: string;
    caseId?: string;
    encounterId?: string;
    authorId?: string;
    templateId?: string;
    templateVersion?: number;
    templateVersionId?: string;
  },
): PrescriptionInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  summary: resource.medicationCodeableConcept?.text,
  medications: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      PRESCRIPTION_MEDICATIONS_EXTENSION_URL,
    ),
  ),
  instructions: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL,
    ),
  ),
  notes: parseFlexibleJson(
    getExtensionValue(resource.extension, PRESCRIPTION_NOTES_EXTENSION_URL),
  ),
  metadata: parseFlexibleJson(
    getExtensionValue(resource.extension, PRESCRIPTION_METADATA_EXTENSION_URL),
  ),
});

const dischargeSummaryToComposition = (
  record: DischargeSummaryRecord,
): Composition => ({
  resourceType: "Composition",
  id: record.artifact.id,
  status: toStatus(record.artifact.status),
  type: toCodeableConcept("DISCHARGE_SUMMARY", "Discharge summary"),
  title: record.artifact.summary ?? "Discharge summary",
  date: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  author: [
    record.artifact.authorId
      ? { reference: `Practitioner/${record.artifact.authorId}` }
      : { display: "System" },
  ],
  encounter: toReference(clinicalContextReference(record.artifact)),
  extension: buildCompositionExtensions(record, {
    [DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL]: record.dischargeSummary.summary,
    [DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL]:
      record.dischargeSummary.diagnoses,
    [DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL]:
      record.dischargeSummary.medications,
    [DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL]:
      record.dischargeSummary.followUp,
    [DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL]:
      record.dischargeSummary.instructions,
    [DISCHARGE_SUMMARY_METADATA_EXTENSION_URL]:
      record.dischargeSummary.metadata,
  }),
});

const compositionToDischargeSummaryInput = (
  resource: Composition,
  defaults: {
    organisationId: string;
    appointmentId?: string;
    caseId?: string;
    encounterId?: string;
    authorId?: string;
    templateId?: string;
    templateVersion?: number;
    templateVersionId?: string;
  },
): DischargeSummaryInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  summary: resource.title,
  summaryContent: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL,
    ),
  ),
  diagnoses: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL,
    ),
  ),
  medications: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL,
    ),
  ),
  followUp: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL,
    ),
  ),
  instructions: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL,
    ),
  ),
  metadata: parseFlexibleJson(
    getExtensionValue(
      resource.extension,
      DISCHARGE_SUMMARY_METADATA_EXTENSION_URL,
    ),
  ),
});

const vitalRecordToObservation = (record: VitalRecordRecord): Observation => {
  const vitalsValue = record.vitalRecord.vitals;
  const component =
    vitalsValue &&
    typeof vitalsValue === "object" &&
    !Array.isArray(vitalsValue)
      ? Object.entries(vitalsValue as Record<string, unknown>).map(
          ([key, value]) => ({
            code: toCodeableConcept(key, key),
            ...(typeof value === "number"
              ? { valueDecimal: value }
              : typeof value === "boolean"
                ? { valueBoolean: value }
                : typeof value === "string"
                  ? { valueString: value }
                  : { valueString: stringifyMaybe(value) ?? "" }),
          }),
        )
      : undefined;

  return {
    resourceType: "Observation",
    id: record.artifact.id,
    status: toStatus(record.artifact.status),
    code: toCodeableConcept("VITAL_RECORD", "Vital record"),
    subject: toReference(clinicalContextReference(record.artifact)),
    encounter: toReference(clinicalContextReference(record.artifact)),
    effectiveDateTime: toIso(record.vitalRecord.measuredAt),
    performer: record.vitalRecord.recordedBy
      ? [{ reference: `Practitioner/${record.vitalRecord.recordedBy}` }]
      : undefined,
    note:
      typeof record.vitalRecord.notes === "string"
        ? [{ text: record.vitalRecord.notes }]
        : undefined,
    component,
    extension: buildObservationExtensions(record, {
      [VITALS_EXTENSION_URL]: record.vitalRecord.vitals,
      [VITALS_NOTES_EXTENSION_URL]: record.vitalRecord.notes,
      [VITALS_METADATA_EXTENSION_URL]: record.vitalRecord.metadata,
    }),
  };
};

const observationToVitalRecordInput = (
  resource: Observation,
  defaults: {
    organisationId: string;
    appointmentId?: string;
    caseId?: string;
    encounterId?: string;
    authorId?: string;
    recordedBy?: string | null;
    templateId?: string;
    templateVersion?: number;
    templateVersionId?: string;
  },
): VitalRecordInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  recordedBy: defaults.recordedBy,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  summary: resource.code?.text,
  measuredAt: resource.effectiveDateTime ?? new Date().toISOString(),
  vitals: parseFlexibleJson(
    getExtensionValue(resource.extension, VITALS_EXTENSION_URL),
  ),
  notes: parseFlexibleJson(
    getExtensionValue(resource.extension, VITALS_NOTES_EXTENSION_URL),
  ),
  metadata: parseFlexibleJson(
    getExtensionValue(resource.extension, VITALS_METADATA_EXTENSION_URL),
  ),
});

const toClinicalArtifactBundle = {
  soapNotes: (records: SoapNoteRecord[]) =>
    recordBundle(records, soapNoteToComposition),
  prescriptions: (records: PrescriptionRecord[]) =>
    recordBundle(records, prescriptionToMedicationRequest),
  dischargeSummaries: (records: DischargeSummaryRecord[]) =>
    recordBundle(records, dischargeSummaryToComposition),
  vitalRecords: (records: VitalRecordRecord[]) =>
    recordBundle(records, vitalRecordToObservation),
};

export const clinicalArtifactFhirMapper = {
  soapNoteToComposition,
  compositionToSoapNoteInput,
  prescriptionToMedicationRequest,
  medicationRequestToPrescriptionInput,
  dischargeSummaryToComposition,
  compositionToDischargeSummaryInput,
  vitalRecordToObservation,
  observationToVitalRecordInput,
  bundles: toClinicalArtifactBundle,
};

export type ClinicalArtifactRecordLike =
  | SoapNoteRecord
  | PrescriptionRecord
  | DischargeSummaryRecord
  | VitalRecordRecord;
