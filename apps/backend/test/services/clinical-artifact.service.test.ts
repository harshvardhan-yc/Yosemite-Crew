import { prisma } from "src/config/prisma";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "../../src/services/clinical-artifact.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    clinicalArtifact: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    soapNote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("ClinicalArtifactService", () => {
  const organisationId = "org-1";
  const artifactId = "artifact-1";
  const soapNoteId = "soap-1";

  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    clinicalArtifact: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    soapNote: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
  });

  it("creates a SOAP note artifact with structured payload", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Follow-up",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.create.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Vomiting" },
      objective: { temperature: 39.2 },
      assessment: { diagnosis: "Gastritis" },
      plan: { instructions: "Supportive care" },
      diagnoses: [{ code: "A1", text: "Gastritis" }],
      metadata: { confidence: "high" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await ClinicalArtifactService.createSoapNote({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      authorId: "author-1",
      summary: "Follow-up",
      subjective: { chiefComplaint: "Vomiting" },
      objective: { temperature: 39.2 },
      assessment: { diagnosis: "Gastritis" },
      plan: { instructions: "Supportive care" },
      diagnoses: [{ code: "A1", text: "Gastritis" }],
      metadata: { confidence: "high" },
    });

    expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId,
          kind: "SOAP_NOTE",
          appointmentId: "appt-1",
          encounterId: "enc-1",
          templateId: "tmpl-1",
          templateVersion: 3,
        }),
      }),
    );
    expect(mockedPrisma.soapNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactId,
        }),
      }),
    );
    expect(result.artifact.id).toBe(artifactId);
    expect(result.soapNote.id).toBe(soapNoteId);
  });

  it("returns a SOAP note by id", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const result = await ClinicalArtifactService.getSoapNote(soapNoteId);

    expect(result.artifact.id).toBe(artifactId);
    expect(result.soapNote.id).toBe(soapNoteId);
  });

  it("updates a SOAP note and the shared artifact", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "IN_PROGRESS",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: null,
      signedBy: null,
      signedAt: null,
      summary: "Updated summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.update.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Updated subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Updated plan" },
      diagnoses: [{ code: "B2" }],
      metadata: { source: "manual" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      {
        status: "IN_PROGRESS",
        summary: "Updated summary",
        subjective: { chiefComplaint: "Updated subjective" },
        plan: { instructions: "Updated plan" },
        diagnoses: [{ code: "B2" }],
        metadata: { source: "manual" },
      },
      organisationId,
    );

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: artifactId },
      }),
    );
    expect(mockedPrisma.soapNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: soapNoteId },
      }),
    );
    expect(result.artifact.status).toBe("IN_PROGRESS");
    expect(result.soapNote.subjective).toEqual({
      chiefComplaint: "Updated subjective",
    });
  });

  it("rejects updates for the wrong organisation", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId: "other-org",
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await expect(
      ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        { summary: "Nope" },
        organisationId,
      ),
    ).rejects.toBeInstanceOf(ClinicalArtifactServiceError);
  });
});
