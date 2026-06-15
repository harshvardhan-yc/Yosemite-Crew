import { Request, Response } from "express";
import { z } from "zod";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import logger from "src/utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";

const appointmentParamsSchema = z.object({
  organisationId: z.string().min(1),
  appointmentId: z.string().min(1),
});

const encounterParamsSchema = z.object({
  organisationId: z.string().min(1),
  encounterId: z.string().min(1),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid workspace request.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof WorkspaceServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error("Unexpected workspace bootstrap error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolvePermissions = (req: Request) => {
  const typedReq = req as OrgRequest;
  return typedReq.userPermissions ?? [];
};

export const WorkspaceController = {
  async getAppointmentBootstrap(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const data = await WorkspaceService.getAppointmentBootstrap(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterBootstrap(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterBootstrap(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
