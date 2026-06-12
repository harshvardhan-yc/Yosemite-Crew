import { Request, Response } from "express";
import logger from "src/utils/logger";
import {
  fromFHIRRoomUnitGroup,
  toFHIRRoomUnitGroup,
} from "@yosemite-crew/types";
import {
  RoomUnitGroupService,
  RoomUnitGroupServiceError,
} from "src/services/room-unit-group.service";
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
  if (error instanceof RoomUnitGroupServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

const isRoomUnitGroupPayload = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as { resourceType?: string }).resourceType === "Location",
  );

export const RoomUnitGroupController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!isRoomUnitGroupPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const dto = req.body as Parameters<typeof fromFHIRRoomUnitGroup>[0];
      const payload = fromFHIRRoomUnitGroup(dto);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const created = await RoomUnitGroupService.create({
        ...payload,
        organisationId,
      });

      return res.status(201).json(toFHIRRoomUnitGroup(created));
    } catch (error) {
      return handleError(res, error, "Failed to create room unit group.");
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      if (!isRoomUnitGroupPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const dto = req.body as Parameters<typeof fromFHIRRoomUnitGroup>[0];
      const payload = fromFHIRRoomUnitGroup(dto);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!requireParam(res, req.params.id, "Group identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const updated = await RoomUnitGroupService.update(req.params.id, {
        ...payload,
        organisationId,
      });

      return res.status(200).json(toFHIRRoomUnitGroup(updated));
    } catch (error) {
      return handleError(res, error, "Failed to update room unit group.");
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const values = await RoomUnitGroupService.list({
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

      return res.status(200).json(values.map(toFHIRRoomUnitGroup));
    } catch (error) {
      return handleError(res, error, "Failed to list room unit groups.");
    }
  },

  delete: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req as OrgRequest;

      if (!requireParam(res, id, "Group identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const deleted = await RoomUnitGroupService.delete(id, organisationId);
      return res.status(200).json(toFHIRRoomUnitGroup(deleted));
    } catch (error) {
      return handleError(res, error, "Failed to delete room unit group.");
    }
  },
};
