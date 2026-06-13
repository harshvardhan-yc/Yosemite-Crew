import { ClinicalArtifactKind, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  buildDocumentSignature,
  buildRenderedDocumentDraft,
  createRenderedDocumentRecord,
  isSignableRenderedDocumentKind,
  RenderedDocumentServiceError,
  signPersistedRenderedDocument,
  signRenderedDocument,
} from "../../src/services/rendered-document.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    renderedDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    documentSignature: {
      create: jest.fn(),
    },
  },
}));

describe("rendered-document service", () => {
  const mockedPrisma = prisma as unknown as {
    renderedDocument: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    documentSignature: {
      create: jest.Mock;
    };
  };

  const buildTemplateSource = (overrides = {}) => ({
    sourceKind: "TEMPLATE_INSTANCE" as const,
    sourceId: "instance-123",
    organisationId: "org-123",
    templateKind: TemplateKind.FORM,
    templateId: "template-123",
    templateVersion: 3,
    ...overrides,
  });

  it("marks clinical and form document kinds as signable and task kinds as non-signable", () => {
    expect(isSignableRenderedDocumentKind("FORM")).toBe(true);
    expect(isSignableRenderedDocumentKind("SOAP_NOTE")).toBe(true);
    expect(isSignableRenderedDocumentKind("PRESCRIPTION")).toBe(true);
    expect(isSignableRenderedDocumentKind("DISCHARGE_SUMMARY")).toBe(true);
    expect(isSignableRenderedDocumentKind("VITAL_RECORD")).toBe(true);
    expect(isSignableRenderedDocumentKind("TASK_TEMPLATE")).toBe(false);
    expect(isSignableRenderedDocumentKind("CARE_PATHWAY")).toBe(false);
  });

  it("builds a rendered document draft from a template source", () => {
    const draft = buildRenderedDocumentDraft({
      title: "  Intake Consent  ",
      source: buildTemplateSource(),
    });

    expect(draft.title).toBe("Intake Consent");
    expect(draft.kind).toBe("FORM");
    expect(draft.signable).toBe(true);
    expect(draft.status).toBe("DRAFT");
    expect(draft.mimeType).toBe("application/pdf");
    expect(draft.source.organisationId).toBe("org-123");
    expect(draft.source.sourceId).toBe("instance-123");
    expect(draft.source.templateKind).toBe(TemplateKind.FORM);
    expect(draft.version).toBe(1);
    expect(draft.signature).toBeNull();
  });

  it("preserves non-signable task kinds in the draft contract", () => {
    const draft = buildRenderedDocumentDraft({
      title: "Task bundle",
      source: buildTemplateSource({
        templateKind: TemplateKind.TASK_TEMPLATE,
      }),
    });

    expect(draft.kind).toBe("TASK_TEMPLATE");
    expect(draft.signable).toBe(false);
  });

  it("builds a signature payload with normalization", () => {
    const signature = buildDocumentSignature("  doc-1  ", {
      signerId: "  user-1 ",
      signerType: "PMS_USER",
      signatureText: "  Dr. Jane Doe  ",
      signedAt: new Date("2026-06-13T00:00:00.000Z"),
    });

    expect(signature.documentId).toBe("doc-1");
    expect(signature.signerId).toBe("user-1");
    expect(signature.signatureText).toBe("Dr. Jane Doe");
    expect(signature.signedAt.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });

  it("treats missing signature text as null", () => {
    const signature = buildDocumentSignature("doc-1", {
      signerId: "user-1",
      signerType: "PARENT",
    });

    expect(signature.signatureText).toBeNull();
  });

  it("rejects blank title, organisation, source and signature text values", () => {
    expect(() =>
      buildRenderedDocumentDraft({
        title: "   ",
        source: buildTemplateSource(),
      }),
    ).toThrow(RenderedDocumentServiceError);

    expect(() =>
      buildRenderedDocumentDraft({
        title: "Draft",
        source: buildTemplateSource({ organisationId: "   " }),
      }),
    ).toThrow("Invalid organisationId");

    expect(() =>
      buildRenderedDocumentDraft({
        title: "Draft",
        source: buildTemplateSource({ sourceId: "   " }),
      }),
    ).toThrow("Invalid sourceId");

    expect(() =>
      buildDocumentSignature("doc-1", {
        signerId: "user-1",
        signerType: "SYSTEM",
        signatureText: "   ",
      }),
    ).toThrow("Invalid signatureText");
  });

  it("signs a draft document and carries the signature metadata", () => {
    const draft = buildRenderedDocumentDraft({
      title: "SOAP note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-1",
        organisationId: "org-1",
        templateKind: ClinicalArtifactKind.SOAP_NOTE,
        templateVersionId: "template-version-1",
      },
    });

    const signed = signRenderedDocument(draft, {
      signerId: "vet-1",
      signerType: "PMS_USER",
      signedAt: new Date("2026-06-13T10:00:00.000Z"),
      signatureText: "Approved",
    });

    expect(signed.status).toBe("SIGNED");
    expect(signed.signedBy).toBe("vet-1");
    expect(signed.signedAt?.toISOString()).toBe("2026-06-13T10:00:00.000Z");
    expect(signed.signature?.signerId).toBe("vet-1");
    expect(signed.signature?.documentId).toBe(draft.id);
  });

  it("rejects signing unsupported or already signed documents", () => {
    const nonSignable = buildRenderedDocumentDraft({
      title: "Care pathway",
      source: buildTemplateSource({
        templateKind: TemplateKind.CARE_PATHWAY,
      }),
    });

    expect(() =>
      signRenderedDocument(nonSignable, {
        signerId: "user-1",
        signerType: "SYSTEM",
      }),
    ).toThrow("Document kind is not signable");

    const signed = signRenderedDocument(
      buildRenderedDocumentDraft({
        title: "SOAP note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-2",
          organisationId: "org-1",
          templateKind: ClinicalArtifactKind.SOAP_NOTE,
        },
      }),
      {
        signerId: "user-1",
        signerType: "SYSTEM",
      },
    );

    expect(() =>
      signRenderedDocument(signed, {
        signerId: "user-2",
        signerType: "SYSTEM",
      }),
    ).toThrow("Document is already signed");
  });

  it("persists a rendered document draft", async () => {
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await createRenderedDocumentRecord({
      title: "Intake Consent",
      source: buildTemplateSource(),
      templateInstanceId: "instance-123",
    });

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "instance-123",
          templateInstanceId: "instance-123",
          title: "Intake Consent",
          kind: "FORM",
          signable: true,
        }),
        include: { signature: true },
      }),
    );
    expect(result.id).toBe("doc-1");
  });

  it("persists a rendered document signature and updates the document", async () => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "SIGNED",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: "user-1",
      signedAt: new Date("2026-06-13T11:00:00.000Z"),
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T11:00:00.000Z"),
      signature: {
        id: "sig-1",
        renderedDocumentId: "doc-1",
        signerId: "user-1",
        signerType: "PMS_USER",
        signatureText: "Signed",
        signedAt: new Date("2026-06-13T11:00:00.000Z"),
        createdAt: new Date("2026-06-13T11:00:00.000Z"),
        updatedAt: new Date("2026-06-13T11:00:00.000Z"),
      },
    });

    const result = await signPersistedRenderedDocument({
      renderedDocumentId: "doc-1",
      signerId: "user-1",
      signerType: "PMS_USER",
      signatureText: "Signed",
      signedAt: new Date("2026-06-13T11:00:00.000Z"),
    });

    expect(mockedPrisma.documentSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          renderedDocumentId: "doc-1",
          signerId: "user-1",
          signerType: "PMS_USER",
          signatureText: "Signed",
        }),
      }),
    );
    expect(mockedPrisma.renderedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({
          status: "SIGNED",
          signedBy: "user-1",
        }),
      }),
    );
    expect(result.status).toBe("SIGNED");
  });

  it("throws when signing a missing persisted rendered document", async () => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce(null);

    await expect(
      signPersistedRenderedDocument({
        renderedDocumentId: "missing-doc",
        signerId: "user-1",
        signerType: "SYSTEM",
      }),
    ).rejects.toThrow("Rendered document not found");
  });
});
