import { Request, Response } from "express";
import logger from "src/utils/logger";
import {
  fromRoomUnitRequestDTO,
  toRoomUnitResponseDTO,
  type RoomUnitRequestDTO,
} from "@yosemite-crew/types";
import {
  RoomUnitService,
  RoomUnitServiceError,
} from "src/services/room-unit.service";
import { OrgRequest } from "src/middlewares/rbac";

const requireParam = (
  res: Response,
  value: string | undefined,
  message: string,
): value is string => {
  if (!value) {
    res.status(400).json({ message });
    return false;
  }

  return true;
};

const getOrganisationId = (
  req: Request,
  fallback?: string,
): string | undefined => (req as OrgRequest).organisationId ?? fallback;

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof RoomUnitServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

const isRoomUnitPayload = (value: unknown): value is RoomUnitRequestDTO =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as { resourceType?: string }).resourceType === "Location",
  );

export const RoomUnitController = {
  create: async (req: Request, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      if (!isRoomUnitPayload(rawBody)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }
      const payload = fromRoomUnitRequestDTO(rawBody);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const created = await RoomUnitService.create({
        ...payload,
        organisationId,
      });

      return res.status(201).json(toRoomUnitResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Failed to create room unit.");
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      if (!isRoomUnitPayload(rawBody)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }
      const payload = fromRoomUnitRequestDTO(rawBody);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!requireParam(res, req.params.id, "Unit identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const updated = await RoomUnitService.update(req.params.id, {
        ...payload,
        organisationId,
      });

      return res.status(200).json(toRoomUnitResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Failed to update room unit.");
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const values = await RoomUnitService.list({
        organisationId:
          typeof req.query.organizationId === "string"
            ? req.query.organizationId
            : undefined,
        roomId:
          typeof req.query.roomId === "string" ? req.query.roomId : undefined,
        unitGroupId:
          typeof req.query.unitGroupId === "string"
            ? req.query.unitGroupId
            : undefined,
        isActive:
          typeof req.query.isActive === "string"
            ? req.query.isActive === "true"
            : undefined,
      });

      return res.status(200).json(values.map(toRoomUnitResponseDTO));
    } catch (error) {
      return handleError(res, error, "Failed to list room units.");
    }
  },

  delete: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req as OrgRequest;

      if (!requireParam(res, id, "Unit identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const deleted = await RoomUnitService.delete(id, organisationId);
      return res.status(200).json(toRoomUnitResponseDTO(deleted));
    } catch (error) {
      return handleError(res, error, "Failed to delete room unit.");
    }
  },
};
