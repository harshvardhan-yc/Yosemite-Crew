import {
  Prisma,
  ClinicalArtifactKind,
  ClinicalArtifactStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class ClinicalArtifactServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "ClinicalArtifactServiceError";
  }
}

export type SoapNoteInput = {
  organisationId: string;
  appointmentId?: string;
  caseId?: string;
  encounterId?: string;
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  authorId?: string;
  status?: ClinicalArtifactStatus;
  summary?: string | null;
  subjective?: unknown;
  objective?: unknown;
  assessment?: unknown;
  plan?: unknown;
  diagnoses?: unknown;
  metadata?: unknown;
};

export type SoapNoteUpdateInput = Partial<
  Pick<
    SoapNoteInput,
    | "status"
    | "summary"
    | "subjective"
    | "objective"
    | "assessment"
    | "plan"
    | "diagnoses"
    | "metadata"
  >
>;

export type SoapNoteRecord = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    kind: ClinicalArtifactKind;
    status: ClinicalArtifactStatus;
    templateId: string | null;
    templateVersion: number | null;
    authorId: string | null;
    signedBy: string | null;
    signedAt: Date | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  soapNote: {
    id: string;
    artifactId: string;
    subjective: Prisma.JsonValue | null;
    objective: Prisma.JsonValue | null;
    assessment: Prisma.JsonValue | null;
    plan: Prisma.JsonValue | null;
    diagnoses: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

const ensureId = (value: string | undefined, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ClinicalArtifactServiceError(`Invalid ${field}`, 400);
  }
  return value.trim();
};

const toNullableJsonInput = (
  value: unknown,
):
  | Prisma.InputJsonValue
  | Prisma.NullTypes.DbNull
  | Prisma.NullTypes.JsonNull
  | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
};

const toNullableString = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return value === null ? null : value.trim();
};

const assertSoapNoteArtifact = (
  artifact: { kind: ClinicalArtifactKind; organisationId: string },
  organisationId?: string,
) => {
  if (artifact.kind !== "SOAP_NOTE") {
    throw new ClinicalArtifactServiceError("Artifact is not a SOAP note", 409);
  }

  if (organisationId && artifact.organisationId !== organisationId) {
    throw new ClinicalArtifactServiceError(
      "Artifact does not belong to organisation",
      403,
    );
  }
};

const loadSoapNoteOrThrow = async (soapNoteId: string) => {
  const note = await prisma.soapNote.findUnique({
    where: { id: ensureId(soapNoteId, "soapNoteId") },
    include: { artifact: true },
  });

  if (!note) {
    throw new ClinicalArtifactServiceError("SOAP note not found", 404);
  }

  assertSoapNoteArtifact(note.artifact);

  return note;
};

export const ClinicalArtifactService = {
  async createSoapNote(input: SoapNoteInput): Promise<SoapNoteRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const createdArtifact = await tx.clinicalArtifact.create({
        data: {
          organisationId,
          appointmentId: input.appointmentId ?? undefined,
          caseId: input.caseId ?? undefined,
          encounterId: input.encounterId ?? undefined,
          kind: "SOAP_NOTE",
          status: input.status ?? "DRAFT",
          templateId: input.templateId ?? undefined,
          templateVersion: input.templateVersion ?? undefined,
          templateVersionId: input.templateVersionId ?? undefined,
          authorId: input.authorId ?? undefined,
          summary: toNullableString(input.summary),
        },
      });

      const createdSoapNote = await tx.soapNote.create({
        data: {
          artifactId: createdArtifact.id,
          subjective: toNullableJsonInput(input.subjective),
          objective: toNullableJsonInput(input.objective),
          assessment: toNullableJsonInput(input.assessment),
          plan: toNullableJsonInput(input.plan),
          diagnoses: toNullableJsonInput(input.diagnoses),
          metadata: toNullableJsonInput(input.metadata),
        },
      });

      return {
        artifact: createdArtifact,
        soapNote: createdSoapNote,
      };
    });

    return artifact;
  },

  async updateSoapNote(
    soapNoteId: string,
    input: SoapNoteUpdateInput,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await loadSoapNoteOrThrow(soapNoteId);
    assertSoapNoteArtifact(note.artifact, organisationId);

    const updated = await prisma.$transaction(async (tx) => {
      const artifact = await tx.clinicalArtifact.update({
        where: { id: note.artifact.id },
        data: {
          status: input.status ?? note.artifact.status,
          summary:
            input.summary === undefined
              ? note.artifact.summary
              : toNullableString(input.summary),
        },
      });

      const soapNote = await tx.soapNote.update({
        where: { id: note.id },
        data: {
          subjective:
            input.subjective === undefined
              ? toNullableJsonInput(note.subjective)
              : toNullableJsonInput(input.subjective),
          objective:
            input.objective === undefined
              ? toNullableJsonInput(note.objective)
              : toNullableJsonInput(input.objective),
          assessment:
            input.assessment === undefined
              ? toNullableJsonInput(note.assessment)
              : toNullableJsonInput(input.assessment),
          plan:
            input.plan === undefined
              ? toNullableJsonInput(note.plan)
              : toNullableJsonInput(input.plan),
          diagnoses:
            input.diagnoses === undefined
              ? toNullableJsonInput(note.diagnoses)
              : toNullableJsonInput(input.diagnoses),
          metadata:
            input.metadata === undefined
              ? toNullableJsonInput(note.metadata)
              : toNullableJsonInput(input.metadata),
        },
      });

      return { artifact, soapNote };
    });

    return updated;
  },

  async getSoapNote(
    soapNoteId: string,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await loadSoapNoteOrThrow(soapNoteId);
    assertSoapNoteArtifact(note.artifact, organisationId);

    return {
      artifact: note.artifact,
      soapNote: note,
    };
  },

  async listSoapNotesForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<SoapNoteRecord[]> {
    const records = await prisma.soapNote.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "SOAP_NOTE",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => ({
      artifact: record.artifact,
      soapNote: record,
    }));
  },

  async listSoapNotesForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<SoapNoteRecord[]> {
    const records = await prisma.soapNote.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "SOAP_NOTE",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => ({
      artifact: record.artifact,
      soapNote: record,
    }));
  },
};
