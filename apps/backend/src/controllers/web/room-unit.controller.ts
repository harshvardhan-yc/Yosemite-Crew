import { Request, Response } from "express";
import {
  fromRoomUnitRequestDTO,
  toRoomUnitResponseDTO,
  type RoomUnitRequestDTO,
} from "@yosemite-crew/types";
import logger from "src/utils/logger";
import {
  RoomUnitService,
  RoomUnitServiceError,
} from "src/services/room-unit.service";

const isFHIRLocationPayload = (
  payload: unknown,
): payload is RoomUnitRequestDTO =>
  Boolean(
    payload &&
    typeof payload === "object" &&
    (payload as { resourceType?: string }).resourceType === "Location",
  );

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof RoomUnitServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

export const RoomUnitController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!isFHIRLocationPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const created = await RoomUnitService.create(
        fromRoomUnitRequestDTO(req.body),
      );
      return res.status(201).json(toRoomUnitResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Failed to create room unit.");
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      if (!isFHIRLocationPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const updated = await RoomUnitService.update(
        req.params.id,
        fromRoomUnitRequestDTO(req.body),
      );
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
      const deleted = await RoomUnitService.delete(req.params.id);
      return res.status(200).json(toRoomUnitResponseDTO(deleted));
    } catch (error) {
      return handleError(res, error, "Failed to delete room unit.");
    }
  },
};
