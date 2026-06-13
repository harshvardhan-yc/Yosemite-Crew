import { TemplateKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  renderPdf,
  type PdfField,
  type PdfSection,
} from "src/services/formPDF.service";
import type { RenderedDocumentSource } from "src/services/rendered-document.service";

type RenderedDocumentPdfSource = {
  title: string;
  source: RenderedDocumentSource;
};

type TemplateInstanceDocumentSource = {
  id: string;
  organisationId: string;
  templateId: string;
  templateVersion: number;
  appointmentId: string | null;
  caseId: string | null;
  encounterId: string | null;
  authorId: string | null;
  status: string;
  data: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  template: {
    name: string;
    kind: TemplateKind;
  };
};

type ClinicalArtifactDocumentSource = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    kind: string;
    status: string;
    templateId: string | null;
    templateVersion: number | null;
    templateVersionId: string | null;
    authorId: string | null;
    signedBy: string | null;
    signedAt: Date | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  data: Record<string, unknown>;
};

const humanizeLabel = (value: string) =>
  value
    .split(/[\s._/-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }

  return "[unsupported]";
};

const flattenJson = (value: unknown, path: string[] = []): PdfField[] => {
  if (value === undefined) {
    return [];
  }

  if (value === null || typeof value !== "object" || value instanceof Date) {
    const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
    return [{ label, value: stringifyValue(value) }];
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
      return [{ label, value: "[]" }];
    }

    return value.flatMap((item, index) =>
      flattenJson(item, [...path, String(index + 1)]),
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
    return [{ label, value: "{}" }];
  }

  return entries.flatMap(([key, item]) => flattenJson(item, [...path, key]));
};

const buildDocumentDetailsSection = (
  title: string,
  source: RenderedDocumentSource,
  metadata: Record<string, unknown>,
): PdfSection => ({
  title: "Document Details",
  fields: [
    { label: "Title", value: title },
    { label: "Kind", value: source.templateKind },
    { label: "Source Kind", value: source.sourceKind },
    { label: "Source ID", value: source.sourceId },
    { label: "Organisation", value: source.organisationId },
    ...Object.entries(metadata).map(([label, value]) => ({
      label: humanizeLabel(label),
      value: stringifyValue(value),
    })),
  ],
});

const buildTemplateInstanceViewModel = (
  input: RenderedDocumentPdfSource,
  record: TemplateInstanceDocumentSource,
) => ({
  title: input.title,
  submittedAt: record.createdAt.toISOString(),
  sections: [
    buildDocumentDetailsSection(input.title, input.source, {
      templateName: record.template.name,
      templateVersion: record.templateVersion,
      templateId: record.templateId,
      templateKind: record.template.kind,
      appointmentId: record.appointmentId,
      caseId: record.caseId,
      encounterId: record.encounterId,
      authorId: record.authorId,
      status: record.status,
    }),
    {
      title: "Captured Data",
      fields: flattenJson(record.data),
    },
  ],
});

const buildClinicalArtifactViewModel = (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
) => ({
  title: input.title,
  submittedAt: record.artifact.createdAt.toISOString(),
  sections: [
    buildDocumentDetailsSection(input.title, input.source, {
      templateVersion: record.artifact.templateVersion,
      templateVersionId: record.artifact.templateVersionId,
      templateId: record.artifact.templateId,
      appointmentId: record.artifact.appointmentId,
      caseId: record.artifact.caseId,
      encounterId: record.artifact.encounterId,
      authorId: record.artifact.authorId,
      signedBy: record.artifact.signedBy,
      signedAt: record.artifact.signedAt?.toISOString() ?? "",
      summary: record.artifact.summary,
      status: record.artifact.status,
    }),
    {
      title: "Clinical Data",
      fields: flattenJson(record.data),
    },
  ],
});

const loadTemplateInstanceDocument = async (
  source: RenderedDocumentSource,
): Promise<TemplateInstanceDocumentSource> => {
  const record = await prisma.templateInstance.findUnique({
    where: { id: source.sourceId },
    include: {
      template: {
        select: {
          name: true,
          kind: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error("Template instance not found");
  }

  if (record.organisationId !== source.organisationId) {
    throw new Error("Template instance does not belong to organisation");
  }

  return record as unknown as TemplateInstanceDocumentSource;
};

const loadClinicalArtifactDocument = async (
  source: RenderedDocumentSource,
): Promise<ClinicalArtifactDocumentSource> => {
  switch (source.templateKind) {
    case "SOAP_NOTE": {
      const record = await prisma.soapNote.findUnique({
        where: { id: source.sourceId },
        include: { artifact: true },
      });

      if (!record) {
        throw new Error("SOAP note not found");
      }

      if (record.artifact.organisationId !== source.organisationId) {
        throw new Error("SOAP note does not belong to organisation");
      }

      return {
        artifact: record.artifact,
        data: {
          subjective: record.subjective,
          objective: record.objective,
          assessment: record.assessment,
          plan: record.plan,
          diagnoses: record.diagnoses,
          metadata: record.metadata,
        },
      };
    }
    case "PRESCRIPTION": {
      const record = await prisma.prescription.findUnique({
        where: { id: source.sourceId },
        include: { artifact: true },
      });

      if (!record) {
        throw new Error("Prescription not found");
      }

      if (record.artifact.organisationId !== source.organisationId) {
        throw new Error("Prescription does not belong to organisation");
      }

      return {
        artifact: record.artifact,
        data: {
          medications: record.medications,
          instructions: record.instructions,
          notes: record.notes,
          metadata: record.metadata,
        },
      };
    }
    case "DISCHARGE_SUMMARY": {
      const record = await prisma.dischargeSummary.findUnique({
        where: { id: source.sourceId },
        include: { artifact: true },
      });

      if (!record) {
        throw new Error("Discharge summary not found");
      }

      if (record.artifact.organisationId !== source.organisationId) {
        throw new Error("Discharge summary does not belong to organisation");
      }

      return {
        artifact: record.artifact,
        data: {
          summary: record.summary,
          diagnoses: record.diagnoses,
          medications: record.medications,
          followUp: record.followUp,
          instructions: record.instructions,
          metadata: record.metadata,
        },
      };
    }
    case "VITAL_RECORD": {
      const record = await prisma.vitalRecord.findUnique({
        where: { id: source.sourceId },
        include: { artifact: true },
      });

      if (!record) {
        throw new Error("Vital record not found");
      }

      if (record.artifact.organisationId !== source.organisationId) {
        throw new Error("Vital record does not belong to organisation");
      }

      return {
        artifact: record.artifact,
        data: {
          measuredAt: record.measuredAt,
          recordedBy: record.recordedBy,
          vitals: record.vitals,
          notes: record.notes,
          metadata: record.metadata,
        },
      };
    }
    default:
      throw new Error("Unsupported clinical document kind");
  }
};

export const renderRenderedDocumentPdf = async (
  input: RenderedDocumentPdfSource,
) => {
  switch (input.source.sourceKind) {
    case "TEMPLATE_INSTANCE": {
      const record = await loadTemplateInstanceDocument(input.source);
      return renderPdf(buildTemplateInstanceViewModel(input, record));
    }
    case "CLINICAL_ARTIFACT": {
      const record = await loadClinicalArtifactDocument(input.source);
      return renderPdf(buildClinicalArtifactViewModel(input, record));
    }
    default:
      throw new Error("Unsupported rendered document source kind");
  }
};
