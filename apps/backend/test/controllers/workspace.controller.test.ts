import { Request, Response } from "express";
import { WorkspaceController } from "../../src/controllers/web/workspace.controller";
import { WorkspaceService } from "src/services/workspace.prisma.service";
import { WorkspaceDocumentPacketService } from "src/services/workspace-document-packet.service";
import logger from "src/utils/logger";

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getAppointmentBootstrap: jest.fn(),
    getEncounterBootstrap: jest.fn(),
    getAppointmentDocuments: jest.fn(),
    getEncounterDocuments: jest.fn(),
    getCompanionDocuments: jest.fn(),
    getCompanionMedicalRecords: jest.fn(),
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

jest.mock("src/services/workspace-document-packet.service", () => ({
  WorkspaceDocumentPacketService: {
    createForEncounter: jest.fn(),
    getById: jest.fn(),
    sign: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("WorkspaceController", () => {
  let req: Partial<Request> & {
    userPermissions?: string[];
    userId?: string;
    body?: unknown;
  };
  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    req = { params: {}, userPermissions: [] };
    res = { status, json };
  });

  it("returns the appointment bootstrap payload", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-1",
    };
    (WorkspaceService.getAppointmentBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-1",
      appointment: null,
    });

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getAppointmentBootstrap).toHaveBeenCalledWith(
      {
        organisationId: "org-1",
        appointmentId: "appt-1",
      },
      [],
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      organisationId: "org-1",
      appointment: null,
    });
  });

  it("returns a validation error for missing params", async () => {
    req.params = { organisationId: "org-1" } as never;

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Invalid workspace request.",
      issues: expect.any(Array),
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns the encounter bootstrap payload", async () => {
    req.params = {
      organisationId: "org-2",
      encounterId: "enc-1",
    };
    (WorkspaceService.getEncounterBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-2",
      encounter: { id: "enc-1" },
    });

    await WorkspaceController.getEncounterBootstrap(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterBootstrap).toHaveBeenCalledWith(
      {
        organisationId: "org-2",
        encounterId: "enc-1",
      },
      [],
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns appointment documents", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-2",
    };
    (WorkspaceService.getAppointmentDocuments as jest.Mock).mockResolvedValue([
      { documentId: "doc-1" },
    ]);

    await WorkspaceController.getAppointmentDocuments(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getAppointmentDocuments).toHaveBeenCalledWith(
      {
        organisationId: "org-1",
        appointmentId: "appt-2",
      },
      [],
    );
    expect(json).toHaveBeenCalledWith([{ documentId: "doc-1" }]);
  });

  it("creates a document packet", async () => {
    req.params = {
      organisationId: "org-3",
      encounterId: "enc-3",
    };
    (
      WorkspaceDocumentPacketService.createForEncounter as jest.Mock
    ).mockResolvedValue({ packetId: "packet-1" });

    await WorkspaceController.createDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(
      WorkspaceDocumentPacketService.createForEncounter,
    ).toHaveBeenCalledWith({
      organisationId: "org-3",
      encounterId: "enc-3",
    });
    expect(status).toHaveBeenCalledWith(201);
  });

  it("signs a document packet when the request is authenticated", async () => {
    req.params = {
      organisationId: "org-4",
      packetId: "packet-2",
    };
    req.body = { signerName: "Dr. Jane" };
    req.userId = "user-1";
    (WorkspaceDocumentPacketService.sign as jest.Mock).mockResolvedValue({
      packetId: "packet-2",
      status: "FINAL",
    });

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(WorkspaceDocumentPacketService.sign).toHaveBeenCalledWith({
      organisationId: "org-4",
      packetId: "packet-2",
      signerId: "user-1",
      signerName: "Dr. Jane",
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects packet signing without an authenticated user", async () => {
    req.params = {
      organisationId: "org-4",
      packetId: "packet-2",
    };

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(WorkspaceDocumentPacketService.sign).not.toHaveBeenCalled();
  });
});
