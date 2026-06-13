import { randomUUID } from "node:crypto";
import { ClinicalArtifactKind, Prisma, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";

export class RenderedDocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "RenderedDocumentServiceError";
  }
}

export type RenderedDocumentKind =
  | "FORM"
  | "SOAP_NOTE"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "VITAL_RECORD"
  | "TASK_TEMPLATE"
  | "CARE_PATHWAY";

export type RenderedDocumentSourceKind =
  | "TEMPLATE_INSTANCE"
  | "CLINICAL_ARTIFACT";

export type RenderedDocumentStatus = "DRAFT" | "SIGNED";

export type DocumentSignatureSignerType = "PMS_USER" | "PARENT" | "SYSTEM";

export type RenderedDocumentSource = {
  sourceKind: RenderedDocumentSourceKind;
  sourceId: string;
  organisationId: string;
  templateKind: TemplateKind | ClinicalArtifactKind;
  templateId?: string | null;
  templateVersion?: number | null;
  templateVersionId?: string | null;
};

export type RenderedDocumentSignature = {
  documentId: string;
  signerId: string;
  signerType: DocumentSignatureSignerType;
  signedAt: Date;
  signatureText?: string | null;
};

export type RenderedDocument = {
  id: string;
  version: number;
  kind: RenderedDocumentKind;
  status: RenderedDocumentStatus;
  title: string;
  organisationId: string;
  mimeType: "application/pdf";
  signable: boolean;
  source: RenderedDocumentSource;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date | null;
  signedBy?: string | null;
  signature?: RenderedDocumentSignature | null;
};

export type BuildRenderedDocumentInput = {
  title: string;
  source: RenderedDocumentSource;
  version?: number;
};

export type SignRenderedDocumentInput = {
  signerId: string;
  signerType: DocumentSignatureSignerType;
  signatureText?: string | null;
  signedAt?: Date;
};

export type PersistRenderedDocumentInput = BuildRenderedDocumentInput & {
  templateInstanceId?: string;
  clinicalArtifactId?: string;
  pdfUrl?: string | null;
  pdf?: unknown;
};

export type PersistRenderedDocumentSignatureInput =
  SignRenderedDocumentInput & {
    renderedDocumentId: string;
  };

type RenderedDocumentWriteClient = Pick<
  Prisma.TransactionClient,
  "renderedDocument" | "documentSignature"
>;

type PersistedRenderedDocument = Prisma.RenderedDocumentGetPayload<{
  include: { signature: true };
}>;

const renderedDocumentClient = prisma as unknown as RenderedDocumentWriteClient;

const SIGNABLE_RENDERED_DOCUMENT_KINDS = new Set<RenderedDocumentKind>([
  "FORM",
  "SOAP_NOTE",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "VITAL_RECORD",
]);

const normalizeRequiredString = (value: string, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new RenderedDocumentServiceError(`Invalid ${fieldName}`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RenderedDocumentServiceError(`Invalid ${fieldName}`);
  }

  return normalized;
};

const toRenderedDocumentKind = (
  kind: TemplateKind | ClinicalArtifactKind,
): RenderedDocumentKind => {
  switch (kind) {
    case TemplateKind.FORM:
      return "FORM";
    case TemplateKind.SOAP_NOTE:
      return "SOAP_NOTE";
    case TemplateKind.PRESCRIPTION:
      return "PRESCRIPTION";
    case TemplateKind.DISCHARGE_SUMMARY:
      return "DISCHARGE_SUMMARY";
    case TemplateKind.VITAL_RECORD:
      return "VITAL_RECORD";
    case TemplateKind.TASK_TEMPLATE:
      return "TASK_TEMPLATE";
    case TemplateKind.CARE_PATHWAY:
      return "CARE_PATHWAY";
    default:
      throw new RenderedDocumentServiceError(
        "Unsupported rendered document kind",
      );
  }
};

const normalizeSignatureText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RenderedDocumentServiceError("Invalid signatureText");
  }

  return normalized;
};

export const isSignableRenderedDocumentKind = (
  kind: RenderedDocumentKind,
): boolean => SIGNABLE_RENDERED_DOCUMENT_KINDS.has(kind);

export const buildRenderedDocumentDraft = (
  input: BuildRenderedDocumentInput,
): RenderedDocument => {
  const title = normalizeRequiredString(input.title, "title");
  const organisationId = normalizeRequiredString(
    input.source.organisationId,
    "organisationId",
  );
  const sourceId = normalizeRequiredString(input.source.sourceId, "sourceId");
  const kind = toRenderedDocumentKind(input.source.templateKind);
  const now = new Date();

  return {
    id: randomUUID(),
    version: input.version ?? 1,
    kind,
    status: "DRAFT",
    title,
    organisationId,
    mimeType: "application/pdf",
    signable: isSignableRenderedDocumentKind(kind),
    source: {
      ...input.source,
      organisationId,
      sourceId,
    },
    createdAt: now,
    updatedAt: now,
    signedAt: null,
    signedBy: null,
    signature: null,
  };
};

export const buildDocumentSignature = (
  documentId: string,
  input: SignRenderedDocumentInput,
): RenderedDocumentSignature => ({
  documentId: normalizeRequiredString(documentId, "documentId"),
  signerId: normalizeRequiredString(input.signerId, "signerId"),
  signerType: input.signerType,
  signedAt: input.signedAt ?? new Date(),
  signatureText: normalizeSignatureText(input.signatureText),
});

export const signRenderedDocument = (
  document: RenderedDocument,
  input: SignRenderedDocumentInput,
): RenderedDocument => {
  if (!document.signable) {
    throw new RenderedDocumentServiceError(
      "Document kind is not signable",
      409,
    );
  }

  if (document.status === "SIGNED") {
    throw new RenderedDocumentServiceError("Document is already signed", 409);
  }

  const signature = buildDocumentSignature(document.id, input);

  return {
    ...document,
    status: "SIGNED",
    signedAt: signature.signedAt,
    signedBy: signature.signerId,
    signature,
    updatedAt: signature.signedAt,
  };
};

const toRenderedDocumentCreateData = (
  input: PersistRenderedDocumentInput,
  draft: RenderedDocument,
): Prisma.RenderedDocumentUncheckedCreateInput => ({
  id: draft.id,
  organisationId: draft.organisationId,
  sourceKind: draft.source.sourceKind,
  sourceId: draft.source.sourceId,
  templateInstanceId: input.templateInstanceId ?? undefined,
  clinicalArtifactId: input.clinicalArtifactId ?? undefined,
  templateId: draft.source.templateId ?? undefined,
  templateVersion: draft.source.templateVersion ?? undefined,
  templateVersionId: draft.source.templateVersionId ?? undefined,
  kind: draft.kind,
  version: draft.version,
  title: draft.title,
  mimeType: draft.mimeType,
  status: draft.status,
  signable: draft.signable,
  pdfUrl: input.pdfUrl ?? undefined,
  pdf:
    input.pdf === undefined ? undefined : (input.pdf as Prisma.InputJsonValue),
  signedBy: draft.signedBy ?? undefined,
  signedAt: draft.signedAt ?? undefined,
});

export const createRenderedDocumentRecord = async (
  input: PersistRenderedDocumentInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const draft = buildRenderedDocumentDraft(input);

  return client.renderedDocument.create({
    data: toRenderedDocumentCreateData(input, draft),
    include: { signature: true },
  });
};

const loadPersistedRenderedDocumentOrThrow = async (
  renderedDocumentId: string,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const document = await client.renderedDocument.findUnique({
    where: {
      id: normalizeRequiredString(renderedDocumentId, "renderedDocumentId"),
    },
    include: { signature: true },
  });

  if (!document) {
    throw new RenderedDocumentServiceError("Rendered document not found", 404);
  }

  return document;
};

export const signPersistedRenderedDocument = async (
  input: PersistRenderedDocumentSignatureInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const existing = await loadPersistedRenderedDocumentOrThrow(
    input.renderedDocumentId,
    client,
  );
  const kind = toRenderedDocumentKind(existing.kind);

  if (!isSignableRenderedDocumentKind(kind)) {
    throw new RenderedDocumentServiceError(
      "Document kind is not signable",
      409,
    );
  }

  if (existing.status === "SIGNED") {
    throw new RenderedDocumentServiceError("Document is already signed", 409);
  }

  const signature = buildDocumentSignature(existing.id, input);

  await client.documentSignature.create({
    data: {
      renderedDocumentId: existing.id,
      signerId: signature.signerId,
      signerType: signature.signerType,
      signatureText: signature.signatureText ?? undefined,
      signedAt: signature.signedAt,
    },
  });

  return client.renderedDocument.update({
    where: { id: existing.id },
    data: {
      status: "SIGNED",
      signedBy: signature.signerId,
      signedAt: signature.signedAt,
    },
    include: { signature: true },
  });
};
