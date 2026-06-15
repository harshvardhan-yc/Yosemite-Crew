import { Request, Response } from "express";
import { WorkspaceController } from "../../src/controllers/web/workspace.controller";
import { WorkspaceService } from "src/services/workspace.prisma.service";
import logger from "src/utils/logger";

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getAppointmentBootstrap: jest.fn(),
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

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("WorkspaceController", () => {
  let req: Partial<Request> & { userPermissions?: string[] };
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
});
