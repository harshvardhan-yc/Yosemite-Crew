import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import { DocumensoService } from "src/services/documenso.service";
import { buildMergedClinicalPacketPdf } from "src/services/clinical-packet-pdf.service";
import logger from "src/utils/logger";
import type {
  WorkspaceDocumentPacketRow,
  WorkspaceDocumentPacketSigning,
  WorkspaceDocumentRow,
} from "@yosemite-crew/types";

type CreatePacketInput = {
  organisationId: string;
  encounterId: string;
};

type SignPacketInput = {
  organisationId: string;
  packetId: string;
  signerId: string;
  signerName?: string;
  /** Optional explicit signer email; resolved from the user record otherwise. */
  signerEmail?: string;
};

type PacketRecord = {
  id: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  companionId: string | null;
  status: "DRAFT" | "FINAL";
  documents: unknown;
  signing: unknown;
  signedBy: string | null;
  signedByName: string | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SerializedWorkspaceDocumentRow = Omit<
  WorkspaceDocumentRow,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

const isSerializedWorkspaceDocumentRow = (
  value: unknown,
): value is SerializedWorkspaceDocumentRow =>
  typeof value === "object" &&
  value !== null &&
  "documentId" in value &&
  "title" in value;

const serializeDocumentRow = (
  row: WorkspaceDocumentRow,
): SerializedWorkspaceDocumentRow => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const deserializeDocumentRow = (
  row: SerializedWorkspaceDocumentRow,
): WorkspaceDocumentRow => ({
  ...row,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

const parseSigning = (
  value: unknown,
): WorkspaceDocumentPacketSigning | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.status !== "string") {
    return null;
  }
  return value as WorkspaceDocumentPacketSigning;
};

const mapPacket = (row: PacketRecord): WorkspaceDocumentPacketRow => ({
  packetId: row.id,
  organisationId: row.organisationId,
  appointmentId: row.appointmentId,
  encounterId: row.encounterId,
  companionId: row.companionId,
  documents: Array.isArray(row.documents)
    ? row.documents
        .filter(isSerializedWorkspaceDocumentRow)
        .map(deserializeDocumentRow)
    : [],
  status: row.status,
  signing: parseSigning(row.signing),
  signedBy: row.signedBy,
  signedByName: row.signedByName,
  signedAt: row.signedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensurePacket = async (
  organisationId: string,
  packetId: string,
): Promise<PacketRecord> => {
  const packet = (await prisma.workspaceDocumentPacket.findFirst({
    where: {
      id: packetId,
      organisationId,
    },
  })) as PacketRecord | null;

  if (!packet) {
    throw new WorkspaceServiceError("Document packet not found", 404);
  }

  return packet;
};

const resolveSignerEmail = async (
  signerId: string,
  explicit?: string,
): Promise<string | null> => {
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }
  const user = await prisma.user.findFirst({
    where: { userId: signerId },
    select: { email: true },
  });
  return user?.email ?? null;
};

const deserializePacketDocuments = (
  documents: unknown,
): WorkspaceDocumentRow[] =>
  Array.isArray(documents)
    ? documents
        .filter(isSerializedWorkspaceDocumentRow)
        .map(deserializeDocumentRow)
    : [];

export const WorkspaceDocumentPacketService = {
  async createForEncounter(
    input: CreatePacketInput,
  ): Promise<WorkspaceDocumentPacketRow> {
    const bootstrap = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: input.organisationId,
        encounterId: input.encounterId,
      },
      [],
    );

    const packet = (await prisma.workspaceDocumentPacket.create({
      data: {
        organisationId: input.organisationId,
        appointmentId: bootstrap.appointment?.id ?? null,
        encounterId: input.encounterId,
        companionId: bootstrap.companion?.id ?? null,
        status: "DRAFT",
        documents: bootstrap.documents.map(serializeDocumentRow),
      },
    })) as PacketRecord;

    return mapPacket(packet);
  },

  async getById(
    organisationId: string,
    packetId: string,
  ): Promise<WorkspaceDocumentPacketRow> {
    return mapPacket(await ensurePacket(organisationId, packetId));
  },

  /**
   * Initiate signing of the packet as a single merged PDF via Documenso.
   * The packet stays DRAFT until the Documenso webhook confirms completion
   * (clinical-safety: a packet is only FINAL once it is actually signed).
   */
  async sign(input: SignPacketInput): Promise<WorkspaceDocumentPacketRow> {
    const packet = await ensurePacket(input.organisationId, input.packetId);

    if (packet.status === "FINAL") {
      throw new WorkspaceServiceError("Document packet already signed", 409);
    }

    const existingSigning = parseSigning(packet.signing);
    if (existingSigning?.status === "IN_PROGRESS") {
      throw new WorkspaceServiceError(
        "Document packet signing already in progress",
        409,
      );
    }

    const documents = deserializePacketDocuments(packet.documents);
    if (!documents.length) {
      throw new WorkspaceServiceError(
        "Document packet has no documents to sign",
        409,
      );
    }

    const signerEmail = await resolveSignerEmail(
      input.signerId,
      input.signerEmail,
    );
    if (!signerEmail) {
      throw new WorkspaceServiceError(
        "Unable to resolve signer email for packet signing",
        400,
      );
    }

    const apiKey = await DocumensoService.resolveOrganisationApiKey(
      packet.organisationId,
    );
    if (!apiKey) {
      throw new WorkspaceServiceError(
        "Documenso API key not configured for organisation",
        400,
      );
    }

    const title = `Clinical Packet ${packet.encounterId}`;

    const merged = await buildMergedClinicalPacketPdf({
      organisationId: packet.organisationId,
      title,
      signerName: input.signerName ?? null,
      documents: documents.map((doc) => ({
        documentId: doc.documentId,
        title: doc.title,
        kind: doc.kind,
      })),
    });

    const doc = await DocumensoService.createDocument({
      pdf: merged.pdf,
      signerEmail,
      signerName: input.signerName,
      apiKey,
      signaturePlacement: merged.signaturePlacement,
      title,
    });

    if (!doc || typeof doc.id !== "number") {
      throw new WorkspaceServiceError(
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

    await DocumensoService.distributeDocument({ documentId: doc.id, apiKey });

    const signing: WorkspaceDocumentPacketSigning = {
      required: true,
      provider: "DOCUMENSO",
      status: "IN_PROGRESS",
      documentId: doc.id.toString(),
      signerId: input.signerId,
      signerEmail,
      signerName: input.signerName ?? null,
      signingUrl,
      documentIds: documents.map((d) => d.documentId),
    };

    const updated = (await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: { signing: signing as unknown as Prisma.InputJsonValue },
    })) as PacketRecord;

    return mapPacket(updated);
  },

  /**
   * Complete packet signing once Documenso reports the document signed.
   * Downloads the signed packet, marks the packet FINAL, and marks every
   * bundled document SIGNED against the single signed packet PDF.
   */
  async completeSigning(
    packetId: string,
  ): Promise<WorkspaceDocumentPacketRow | null> {
    const packet = (await prisma.workspaceDocumentPacket.findUnique({
      where: { id: packetId },
    })) as PacketRecord | null;

    if (!packet) {
      return null;
    }

    const signing = parseSigning(packet.signing);
    if (!signing) {
      return mapPacket(packet);
    }
    if (packet.status === "FINAL" || signing.status === "SIGNED") {
      return mapPacket(packet);
    }
    if (!signing.documentId) {
      throw new WorkspaceServiceError("Documenso document id missing", 400);
    }

    const apiKey = await DocumensoService.resolveOrganisationApiKey(
      packet.organisationId,
    );
    if (!apiKey) {
      throw new WorkspaceServiceError(
        "Documenso API key not configured for organisation",
        400,
      );
    }

    const signedPdf = await DocumensoService.downloadSignedDocument({
      documentId: Number.parseInt(signing.documentId, 10),
      apiKey,
    });
    if (!signedPdf) {
      throw new WorkspaceServiceError("Unable to download signed packet", 502);
    }

    const signedAt = new Date();
    const signedUrl = signedPdf.downloadUrl ?? null;

    const updated = (await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: {
        status: "FINAL",
        signedBy: signing.signerId,
        signedByName: signing.signerName ?? null,
        signedAt,
        signing: {
          ...signing,
          status: "SIGNED",
          pdf: { url: signedUrl },
        } as unknown as Prisma.InputJsonValue,
      },
    })) as PacketRecord;

    await Promise.all(
      signing.documentIds.map(async (documentId) => {
        try {
          await prisma.renderedDocument.update({
            where: { id: documentId },
            data: {
              status: "SIGNED",
              signedBy: signing.signerId,
              signedAt,
              pdfUrl: signedUrl ?? undefined,
              signing: {
                required: true,
                provider: "DOCUMENSO",
                status: "SIGNED",
                viaPacketId: packet.id,
                pdf: { url: signedUrl },
              } as unknown as Prisma.InputJsonValue,
            },
          });
          await prisma.documentSignature.upsert({
            where: { renderedDocumentId: documentId },
            update: { signedAt },
            create: {
              renderedDocumentId: documentId,
              signerId: signing.signerId,
              signerType: "PMS_USER",
              signedAt,
            },
          });
        } catch (error) {
          logger.warn("[Packet] Failed to mark child document signed", {
            documentId,
            error,
          });
        }
      }),
    );

    return mapPacket(updated);
  },

  /**
   * Reset signing if Documenso reports the packet document was deleted before
   * completion. Already-signed packets are left untouched.
   */
  async resetSigning(packetId: string): Promise<void> {
    const packet = (await prisma.workspaceDocumentPacket.findUnique({
      where: { id: packetId },
    })) as PacketRecord | null;

    if (!packet) {
      return;
    }

    const signing = parseSigning(packet.signing);
    if (!signing || signing.status === "SIGNED") {
      return;
    }

    await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: {
        signing: {
          ...signing,
          status: "NOT_STARTED",
        } as unknown as Prisma.InputJsonValue,
      },
    });
  },
};
