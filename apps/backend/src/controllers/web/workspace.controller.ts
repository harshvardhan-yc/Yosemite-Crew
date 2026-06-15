import { Request, Response } from "express";
import { z } from "zod";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import { WorkspaceDocumentPacketService } from "src/services/workspace-document-packet.service";
import logger from "src/utils/logger";
import { resolveUserIdFromRequest } from "src/utils/request";
import type { OrgRequest } from "src/middlewares/rbac";

const appointmentParamsSchema = z.object({
  organisationId: z.string().min(1),
  appointmentId: z.string().min(1),
});

const encounterParamsSchema = z.object({
  organisationId: z.string().min(1),
  encounterId: z.string().min(1),
});

const companionParamsSchema = z.object({
  organisationId: z.string().min(1),
  companionId: z.string().min(1),
});

const packetParamsSchema = z.object({
  organisationId: z.string().min(1),
  packetId: z.string().min(1),
});

const signPacketBodySchema = z.object({
  signerName: z.string().trim().min(1).optional(),
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

  async getAppointmentDocuments(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const data = await WorkspaceService.getAppointmentDocuments(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterDocuments(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterDocuments(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getCompanionDocuments(req: Request, res: Response) {
    try {
      const params = companionParamsSchema.parse(req.params);
      const data = await WorkspaceService.getCompanionDocuments(params);
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getCompanionMedicalRecords(req: Request, res: Response) {
    try {
      const params = companionParamsSchema.parse(req.params);
      const data = await WorkspaceService.getCompanionMedicalRecords(params);
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createDocumentPacket(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data =
        await WorkspaceDocumentPacketService.createForEncounter(params);
      return res.status(201).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getDocumentPacket(req: Request, res: Response) {
    try {
      const params = packetParamsSchema.parse(req.params);
      const data = await WorkspaceDocumentPacketService.getById(
        params.organisationId,
        params.packetId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async signDocumentPacket(req: Request, res: Response) {
    try {
      const params = packetParamsSchema.parse(req.params);
      const body = signPacketBodySchema.parse(req.body ?? {});
      const signerId = resolveUserIdFromRequest(req);

      if (!signerId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const data = await WorkspaceDocumentPacketService.sign({
        organisationId: params.organisationId,
        packetId: params.packetId,
        signerId,
        signerName: body.signerName,
      });
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
