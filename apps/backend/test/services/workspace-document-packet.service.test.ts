import { prisma } from "src/config/prisma";
import { WorkspaceService } from "src/services/workspace.prisma.service";
import { DocumensoService } from "../../src/services/documenso.service";
import { buildMergedClinicalPacketPdf } from "../../src/services/clinical-packet-pdf.service";
import { WorkspaceDocumentPacketService } from "../../src/services/workspace-document-packet.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    workspaceDocumentPacket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    renderedDocument: { update: jest.fn() },
    documentSignature: { upsert: jest.fn() },
  },
}));

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getEncounterBootstrap: jest.fn(),
  },
  WorkspaceServiceError: class WorkspaceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
    }
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/clinical-packet-pdf.service", () => ({
  buildMergedClinicalPacketPdf: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  workspaceDocumentPacket: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: { findFirst: jest.Mock };
  renderedDocument: { update: jest.Mock };
  documentSignature: { upsert: jest.Mock };
};
const mockedWorkspaceService = WorkspaceService as unknown as {
  getEncounterBootstrap: jest.Mock;
};
const mockedDocumenso = DocumensoService as unknown as {
  resolveOrganisationApiKey: jest.Mock;
  createDocument: jest.Mock;
  distributeDocument: jest.Mock;
  downloadSignedDocument: jest.Mock;
};
const mockedBuildPacketPdf =
  buildMergedClinicalPacketPdf as unknown as jest.Mock;

const docRow = (id: string, kind = "SOAP_NOTE") => ({
  documentId: id,
  sourceKind: "CLINICAL_ARTIFACT",
  sourceId: `src-${id}`,
  appointmentId: null,
  encounterId: "enc-1",
  companionId: null,
  templateId: null,
  templateVersion: null,
  title: `Doc ${id}`,
  kind,
  status: "DRAFT",
  signingStatus: "NOT_STARTED",
  pdfUrl: null,
  createdAt: new Date("2026-01-01").toISOString(),
  updatedAt: new Date("2026-01-01").toISOString(),
});

const basePacket = (overrides: Record<string, unknown> = {}) => ({
  id: "pkt-1",
  organisationId: "org-1",
  appointmentId: null,
  encounterId: "enc-1",
  companionId: null,
  status: "DRAFT",
  documents: [docRow("d1"), docRow("d2")],
  signing: null,
  signedBy: null,
  signedByName: null,
  signedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DOCUMENSO_URL = "https://sign.example";
});

describe("WorkspaceDocumentPacketService.createForEncounter / getById", () => {
  it("creates a packet snapshot for an encounter", async () => {
    mockedWorkspaceService.getEncounterBootstrap.mockResolvedValue({
      appointment: { id: "appt-1" },
      encounter: { id: "enc-1" },
      companion: { id: "comp-1" },
      documents: [
        {
          ...docRow("doc-1", "FORM"),
          createdAt: new Date("2026-06-15T10:00:00.000Z"),
          updatedAt: new Date("2026-06-15T10:00:00.000Z"),
        },
      ],
    });
    mockedPrisma.workspaceDocumentPacket.create.mockResolvedValue(
      basePacket({ id: "packet-1", appointmentId: "appt-1" }),
    );

    const packet = await WorkspaceDocumentPacketService.createForEncounter({
      organisationId: "org-1",
      encounterId: "enc-1",
    });

    expect(packet.packetId).toBe("packet-1");
    expect(mockedPrisma.workspaceDocumentPacket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: "enc-1",
          documents: expect.any(Array),
        }),
      }),
    );
  });

  it("loads a packet by id", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket({ id: "packet-1", documents: [] }),
    );

    const packet = await WorkspaceDocumentPacketService.getById(
      "org-1",
      "packet-1",
    );

    expect(packet.packetId).toBe("packet-1");
    expect(packet.signing).toBeNull();
  });
});

describe("WorkspaceDocumentPacketService.sign", () => {
  const arrange = () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket(),
    );
    mockedPrisma.user.findFirst.mockResolvedValue({ email: "vet@example.com" });
    mockedDocumenso.resolveOrganisationApiKey.mockResolvedValue("api-key");
    mockedBuildPacketPdf.mockResolvedValue({
      pdf: Buffer.from("merged-pdf"),
      pageCount: 3,
      signaturePlacement: {
        pageNumber: 3,
        pageX: 80,
        pageY: 690,
        width: 240,
        height: 96,
      },
    });
    mockedDocumenso.createDocument.mockResolvedValue({
      id: 123,
      recipients: [{ token: "tok-1" }],
    });
    mockedDocumenso.distributeDocument.mockResolvedValue({});
    mockedPrisma.workspaceDocumentPacket.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        basePacket({ signing: data.signing }),
    );
  };

  it("builds a merged packet, sends it to Documenso, and stores IN_PROGRESS signing", async () => {
    arrange();

    const result = await WorkspaceDocumentPacketService.sign({
      organisationId: "org-1",
      packetId: "pkt-1",
      signerId: "user-1",
      signerName: "Dr Jane",
    });

    expect(mockedBuildPacketPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        documents: [
          expect.objectContaining({ documentId: "d1" }),
          expect.objectContaining({ documentId: "d2" }),
        ],
      }),
    );
    expect(mockedDocumenso.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        pdf: expect.any(Buffer),
        signerEmail: "vet@example.com",
        apiKey: "api-key",
        signaturePlacement: expect.objectContaining({ pageNumber: 3 }),
      }),
    );
    expect(mockedDocumenso.distributeDocument).toHaveBeenCalledWith({
      documentId: 123,
      apiKey: "api-key",
    });

    const updateArg =
      mockedPrisma.workspaceDocumentPacket.update.mock.calls[0][0];
    expect(updateArg.data.signing).toEqual(
      expect.objectContaining({
        status: "IN_PROGRESS",
        documentId: "123",
        signerEmail: "vet@example.com",
        signingUrl: "https://sign.example/sign/tok-1",
        documentIds: ["d1", "d2"],
      }),
    );
    expect(result.signing?.status).toBe("IN_PROGRESS");
  });

  it("uses an explicit signer email when provided", async () => {
    arrange();
    mockedPrisma.user.findFirst.mockResolvedValue(null);

    await WorkspaceDocumentPacketService.sign({
      organisationId: "org-1",
      packetId: "pkt-1",
      signerId: "user-1",
      signerEmail: "override@example.com",
    });

    expect(mockedDocumenso.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ signerEmail: "override@example.com" }),
    );
  });

  it("rejects when the packet is already FINAL", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket({ status: "FINAL" }),
    );

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when signing is already in progress", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket({ signing: { status: "IN_PROGRESS" } }),
    );

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when the packet has no documents", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket({ documents: [] }),
    );

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when the signer email cannot be resolved", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket(),
    );
    mockedPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when the organisation has no Documenso API key", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(
      basePacket(),
    );
    mockedPrisma.user.findFirst.mockResolvedValue({ email: "vet@example.com" });
    mockedDocumenso.resolveOrganisationApiKey.mockResolvedValue(null);

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when Documenso fails to create the document", async () => {
    arrange();
    mockedDocumenso.createDocument.mockResolvedValue(undefined);

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "pkt-1",
        signerId: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("WorkspaceDocumentPacketService.completeSigning", () => {
  it("downloads the signed packet, finalises it, and marks child documents signed", async () => {
    mockedPrisma.workspaceDocumentPacket.findUnique.mockResolvedValue(
      basePacket({
        signing: {
          status: "IN_PROGRESS",
          documentId: "123",
          signerId: "user-1",
          signerName: "Dr Jane",
          documentIds: ["d1", "d2"],
        },
      }),
    );
    mockedDocumenso.resolveOrganisationApiKey.mockResolvedValue("api-key");
    mockedDocumenso.downloadSignedDocument.mockResolvedValue({
      downloadUrl: "https://signed.example/packet.pdf",
    });
    mockedPrisma.workspaceDocumentPacket.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        basePacket({ status: data.status, signing: data.signing }),
    );
    mockedPrisma.renderedDocument.update.mockResolvedValue({});
    mockedPrisma.documentSignature.upsert.mockResolvedValue({});

    const result =
      await WorkspaceDocumentPacketService.completeSigning("pkt-1");

    expect(mockedDocumenso.downloadSignedDocument).toHaveBeenCalledWith({
      documentId: 123,
      apiKey: "api-key",
    });
    const updateArg =
      mockedPrisma.workspaceDocumentPacket.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe("FINAL");
    expect(updateArg.data.signing).toEqual(
      expect.objectContaining({
        status: "SIGNED",
        pdf: { url: "https://signed.example/packet.pdf" },
      }),
    );
    expect(mockedPrisma.renderedDocument.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.documentSignature.upsert).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe("FINAL");
  });

  it("returns null when the packet is missing", async () => {
    mockedPrisma.workspaceDocumentPacket.findUnique.mockResolvedValue(null);

    const result =
      await WorkspaceDocumentPacketService.completeSigning("pkt-x");

    expect(result).toBeNull();
    expect(mockedDocumenso.downloadSignedDocument).not.toHaveBeenCalled();
  });

  it("is idempotent when the packet is already signed", async () => {
    mockedPrisma.workspaceDocumentPacket.findUnique.mockResolvedValue(
      basePacket({
        status: "FINAL",
        signing: { status: "SIGNED", documentId: "123", documentIds: [] },
      }),
    );

    await WorkspaceDocumentPacketService.completeSigning("pkt-1");

    expect(mockedDocumenso.downloadSignedDocument).not.toHaveBeenCalled();
    expect(mockedPrisma.workspaceDocumentPacket.update).not.toHaveBeenCalled();
  });
});

describe("WorkspaceDocumentPacketService.resetSigning", () => {
  it("resets in-progress signing to NOT_STARTED", async () => {
    mockedPrisma.workspaceDocumentPacket.findUnique.mockResolvedValue(
      basePacket({ signing: { status: "IN_PROGRESS", documentId: "123" } }),
    );
    mockedPrisma.workspaceDocumentPacket.update.mockResolvedValue(basePacket());

    await WorkspaceDocumentPacketService.resetSigning("pkt-1");

    const updateArg =
      mockedPrisma.workspaceDocumentPacket.update.mock.calls[0][0];
    expect(updateArg.data.signing).toEqual(
      expect.objectContaining({ status: "NOT_STARTED" }),
    );
  });

  it("leaves an already-signed packet untouched", async () => {
    mockedPrisma.workspaceDocumentPacket.findUnique.mockResolvedValue(
      basePacket({ status: "FINAL", signing: { status: "SIGNED" } }),
    );

    await WorkspaceDocumentPacketService.resetSigning("pkt-1");

    expect(mockedPrisma.workspaceDocumentPacket.update).not.toHaveBeenCalled();
  });
});

describe("WorkspaceDocumentPacketService.buildEncounterPacketPdf", () => {
  it("merges the encounter documents into a single PDF for print", async () => {
    mockedWorkspaceService.getEncounterBootstrap.mockResolvedValue({
      appointment: null,
      encounter: { id: "enc-1" },
      companion: null,
      documents: [docRow("d1"), docRow("d2")],
    });
    mockedBuildPacketPdf.mockResolvedValue({
      pdf: Buffer.from("merged-print"),
      pageCount: 3,
      signaturePlacement: {
        pageNumber: 3,
        pageX: 80,
        pageY: 690,
        width: 240,
        height: 96,
      },
    });

    const pdf = await WorkspaceDocumentPacketService.buildEncounterPacketPdf(
      "org-1",
      "enc-1",
    );

    expect(pdf).toBeInstanceOf(Buffer);
    expect(mockedBuildPacketPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        documents: [
          expect.objectContaining({ documentId: "d1" }),
          expect.objectContaining({ documentId: "d2" }),
        ],
      }),
    );
  });

  it("rejects when the encounter has no documents", async () => {
    mockedWorkspaceService.getEncounterBootstrap.mockResolvedValue({
      appointment: null,
      encounter: { id: "enc-1" },
      companion: null,
      documents: [],
    });

    await expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdf("org-1", "enc-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
