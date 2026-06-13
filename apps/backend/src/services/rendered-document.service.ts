import { randomUUID } from "node:crypto";
import {
  ClinicalArtifactKind,
  Prisma,
  RenderedDocumentSourceKind as PrismaRenderedDocumentSourceKind,
  TemplateKind,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { DocumensoService } from "src/services/documenso.service";
import { renderRenderedDocumentPdf } from "src/services/rendered-document-renderer.service";

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
  | "CLINICAL_ARTIFACT"
  | "FORM_SUBMISSION";

export type RenderedDocumentStatus = "DRAFT" | "SIGNED";

export type DocumentSignatureSignerType = "PMS_USER" | "PARENT" | "SYSTEM";

export type RenderedDocumentSigningStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SIGNED";

export type RenderedDocumentSigningProvider = "DOCUMENSO";

export type RenderedDocumentSigning = {
  required: boolean;
  provider: RenderedDocumentSigningProvider;
  status: RenderedDocumentSigningStatus;
  documentId?: string | null;
  signerId?: string | null;
  signerType?: DocumentSignatureSignerType | null;
  signerEmail?: string | null;
  signerName?: string | null;
  signingUrl?: string | null;
  pdf?: {
    url?: string | null;
  } | null;
};

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
  pdf?: RenderedDocumentPdfSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date | null;
  signedBy?: string | null;
  signing?: RenderedDocumentSigning | null;
  signature?: RenderedDocumentSignature | null;
};

export type RenderedDocumentPdfSnapshot = {
  version: 1;
  renderer: "rendered-document-renderer.service";
  renderedAt: string;
  title: string;
  mimeType: "application/pdf";
  documentKind: RenderedDocumentKind;
  source: RenderedDocumentSource;
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
    organisationId?: string;
    signerEmail: string;
    signerName: string;
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

export const buildRenderedDocumentPdfSnapshot = (
  document: Pick<RenderedDocument, "kind" | "source" | "title">,
  renderedAt = new Date(),
): RenderedDocumentPdfSnapshot => ({
  version: 1,
  renderer: "rendered-document-renderer.service",
  renderedAt: renderedAt.toISOString(),
  title: document.title,
  mimeType: "application/pdf",
  documentKind: document.kind,
  source: document.source,
});

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
    pdf: null,
    createdAt: now,
    updatedAt: now,
    signedAt: null,
    signedBy: null,
    signing: null,
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
  sourceKind: draft.source
    .sourceKind as unknown as PrismaRenderedDocumentSourceKind,
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
    input.pdf === undefined
      ? (buildRenderedDocumentPdfSnapshot(
          draft,
        ) as unknown as Prisma.InputJsonValue)
      : (input.pdf as Prisma.InputJsonValue),
  signedBy: draft.signedBy ?? undefined,
  signedAt: draft.signedAt ?? undefined,
  signing: draft.signing ?? undefined,
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

export const getPersistedRenderedDocument = async (
  renderedDocumentId: string,
  organisationId?: string,
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

  if (
    organisationId !== undefined &&
    document.organisationId !==
      normalizeRequiredString(organisationId, "organisationId")
  ) {
    throw new RenderedDocumentServiceError(
      "Rendered document does not belong to organisation",
      403,
    );
  }

  return document;
};

export const signPersistedRenderedDocument = async (
  input: PersistRenderedDocumentSignatureInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const existing = await getPersistedRenderedDocument(
    input.renderedDocumentId,
    input.organisationId,
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

  if (
    existing.signing &&
    typeof existing.signing === "object" &&
    !Array.isArray(existing.signing) &&
    (existing.signing as RenderedDocumentSigning).status === "IN_PROGRESS"
  ) {
    throw new RenderedDocumentServiceError(
      "Document signing is already in progress",
      409,
    );
  }

  const apiKey = await DocumensoService.resolveOrganisationApiKey(
    existing.organisationId,
  );

  if (!apiKey) {
    throw new RenderedDocumentServiceError(
      "Documenso API key not configured for organisation",
      400,
    );
  }

  const pdf = await renderRenderedDocumentPdf({
    title: existing.title,
    source: {
      sourceKind: existing.sourceKind,
      sourceId: existing.sourceId,
      organisationId: existing.organisationId,
      templateKind: existing.kind as TemplateKind | ClinicalArtifactKind,
      templateId: existing.templateId,
      templateVersion: existing.templateVersion,
      templateVersionId: existing.templateVersionId,
    },
  });
  const renderedPdfSnapshot = buildRenderedDocumentPdfSnapshot({
    title: existing.title,
    kind,
    source: {
      sourceKind: existing.sourceKind,
      sourceId: existing.sourceId,
      organisationId: existing.organisationId,
      templateKind: existing.kind as TemplateKind | ClinicalArtifactKind,
      templateId: existing.templateId,
      templateVersion: existing.templateVersion,
      templateVersionId: existing.templateVersionId,
    },
  });

  const doc = await DocumensoService.createDocument({
    pdf,
    signerEmail: input.signerEmail,
    signerName: input.signerName,
    apiKey,
  });

  if (!doc || typeof doc.id !== "number") {
    throw new RenderedDocumentServiceError(
      "Unable to create Documenso document",
      502,
    );
  }

  const documensoPublicBaseUrl =
    process.env.DOCUMENSO_URL ??
    process.env.DOCUMENSO_HOST_URL ??
    process.env.DOCUMENSO_BASE_URL ??
    "";
  const signingUrl =
    documensoPublicBaseUrl && doc.recipients?.[0]?.token
      ? `${documensoPublicBaseUrl}/sign/${doc.recipients[0].token}`
      : null;

  await DocumensoService.distributeDocument({
    documentId: doc.id,
    apiKey,
  });

  return client.renderedDocument.update({
    where: { id: existing.id },
    data: {
      pdf: renderedPdfSnapshot as unknown as Prisma.InputJsonValue,
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "IN_PROGRESS",
        documentId: doc.id.toString(),
        signerId: input.signerId,
        signerType: input.signerType,
        signerEmail: input.signerEmail,
        signerName: input.signerName,
        signingUrl,
      } as unknown as Prisma.InputJsonValue,
    },
    include: { signature: true },
  });
};

export const completePersistedRenderedDocumentSigning = async (
  renderedDocumentId: string,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const existing = await getPersistedRenderedDocument(
    renderedDocumentId,
    undefined,
    client,
  );

  if (!existing.signing) {
    throw new RenderedDocumentServiceError("Document signing not started", 409);
  }

  if (existing.status === "SIGNED") {
    return existing;
  }

  const signing = existing.signing as RenderedDocumentSigning;
  if (signing.status === "SIGNED") {
    return existing;
  }

  const documentId = signing.documentId;
  if (!documentId) {
    throw new RenderedDocumentServiceError(
      "Documenso document id missing",
      400,
    );
  }

  const apiKey = await DocumensoService.resolveOrganisationApiKey(
    existing.organisationId,
  );

  if (!apiKey) {
    throw new RenderedDocumentServiceError(
      "Documenso API key not configured for organisation",
      400,
    );
  }

  const signedPdf = await DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(documentId, 10),
    apiKey,
  });

  if (!signedPdf) {
    throw new RenderedDocumentServiceError(
      "Unable to download signed document",
      502,
    );
  }

  await client.documentSignature.create({
    data: {
      renderedDocumentId: existing.id,
      signerId:
        signing.signerId ?? signing.signerEmail ?? existing.signedBy ?? "",
      signerType: signing.signerType ?? "PMS_USER",
      signedAt: new Date(),
    },
  });

  return client.renderedDocument.update({
    where: { id: existing.id },
    data: {
      status: "SIGNED",
      signedBy: signing.signerId ?? existing.signedBy ?? undefined,
      signedAt: new Date(),
      pdfUrl: signedPdf.downloadUrl ?? existing.pdfUrl ?? undefined,
      signing: {
        ...signing,
        status: "SIGNED",
        pdf: {
          url: signedPdf.downloadUrl ?? null,
        },
      } as unknown as Prisma.InputJsonValue,
    },
    include: { signature: true },
  });
};
