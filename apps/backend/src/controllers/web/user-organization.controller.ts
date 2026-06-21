import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
  type UserOrganizationFHIRPayload,
} from "../../services/user-organization.service";
import { resolveUserIdFromRequest } from "src/utils/request";

type UserOrganizationMapping = {
  practitionerReference?: string;
  organizationReference?: string;
  effectivePermissions?: string[];
};

type UserOrganizationListing = {
  mapping?: UserOrganizationMapping;
};

type FhirPractitionerRole = {
  practitioner?: { reference?: string };
  organization?: { reference?: string };
  extension?: Array<{
    url?: string;
    extension?: Array<{ url?: string; valueString?: string }>;
  }>;
};

const TEAM_VIEW_PERMISSION = "teams:view:any";
const TEAM_EDIT_PERMISSION = "teams:edit:any";

const extractIdentifier = (reference: string | undefined): string | undefined =>
  reference?.trim().split("/").filter(Boolean).at(-1)?.trim() || undefined;

const sameOrganisation = (
  left: string | undefined,
  right: string | undefined,
): boolean => {
  const leftId = extractIdentifier(left);
  const rightId = extractIdentifier(right);

  return Boolean(leftId && rightId && leftId === rightId);
};

const hasPermission = (
  permissions: string[] | undefined,
  permission: string,
): boolean => Boolean(permissions?.includes(permission));

const canViewResource = (
  resource: FhirPractitionerRole,
  requesterUserId: string,
  requesterMappings: UserOrganizationListing[],
): boolean => {
  const requesterRefs = new Set([
    requesterUserId,
    `Practitioner/${requesterUserId}`,
  ]);

  if (
    resource.practitioner?.reference &&
    requesterRefs.has(resource.practitioner.reference)
  ) {
    return true;
  }

  const resourceOrg = resource.organization?.reference;
  return requesterMappings.some((entry) => {
    const mapping = entry.mapping;
    return Boolean(
      mapping &&
      sameOrganisation(mapping.organizationReference, resourceOrg) &&
      (hasPermission(mapping.effectivePermissions, TEAM_VIEW_PERMISSION) ||
        hasPermission(mapping.effectivePermissions, TEAM_EDIT_PERMISSION)),
    );
  });
};

const canEditOrganisation = (
  organisationReference: string | undefined,
  requesterMappings: UserOrganizationListing[],
): boolean =>
  requesterMappings.some((entry) => {
    const mapping = entry.mapping;
    return Boolean(
      mapping &&
      sameOrganisation(mapping.organizationReference, organisationReference) &&
      hasPermission(mapping.effectivePermissions, TEAM_EDIT_PERMISSION),
    );
  });

export const UserOrganizationController = {
  upsertMapping: async (req: Request, res: Response) => {
    try {
      const payload = req.body as UserOrganizationFHIRPayload | undefined;
      const requesterUserId = resolveUserIdFromRequest(req);

      if (payload?.resourceType !== "PractitionerRole") {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR PractitionerRole resource.",
        });
        return;
      }

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;

      if (
        !canEditOrganisation(
          payload.organization?.reference,
          requesterMappings ?? [],
        )
      ) {
        res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
        return;
      }

      const { response, created } =
        await UserOrganizationService.upsert(payload);
      res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to persist user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to persist user-organization mapping." });
    }
  },

  getMappingById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const requesterUserId = resolveUserIdFromRequest(req);

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resource = await UserOrganizationService.getById(id);
      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;

      if (!resource || (Array.isArray(resource) && resource.length === 0)) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      const resources = (
        Array.isArray(resource) ? resource : [resource]
      ) as FhirPractitionerRole[];

      if (
        !resources.every((entry) =>
          canViewResource(entry, requesterUserId, requesterMappings ?? []),
        )
      ) {
        res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to retrieve user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to retrieve user-organization mapping." });
    }
  },

  listMappings: async (req: Request, res: Response) => {
    try {
      const requesterUserId = resolveUserIdFromRequest(req);

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resources =
        await UserOrganizationService.listByUserId(requesterUserId);
      res.status(200).json(resources);
    } catch (error) {
      logger.error("Failed to list user-organization mappings", error);
      res
        .status(500)
        .json({ message: "Unable to list user-organization mappings." });
    }
  },

  deleteMappingById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const requesterUserId = resolveUserIdFromRequest(req);

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resource = await UserOrganizationService.getById(id);
      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;

      const resources = (
        Array.isArray(resource) ? resource : [resource]
      ).filter(Boolean) as FhirPractitionerRole[];

      if (!resources.length) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      if (
        !resources.every((entry) =>
          canEditOrganisation(
            entry.organization?.reference,
            requesterMappings ?? [],
          ),
        )
      ) {
        res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
        return;
      }

      const deleted = await UserOrganizationService.deleteById(id);

      if (!deleted) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      res.status(200).json({ message: "Mapping deleted successfully." });
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to delete user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to delete user-organization mapping." });
    }
  },

  updateMappingById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = req.body as UserOrganizationFHIRPayload | undefined;
      const requesterUserId = resolveUserIdFromRequest(req);

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      if (payload?.resourceType !== "PractitionerRole") {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR PractitionerRole resource.",
        });
        return;
      }

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resource = await UserOrganizationService.getById(id);
      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;

      const resources = (
        Array.isArray(resource) ? resource : [resource]
      ).filter(Boolean) as FhirPractitionerRole[];

      if (!resources.length) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      if (
        !resources.every((entry) =>
          canEditOrganisation(
            entry.organization?.reference,
            requesterMappings ?? [],
          ),
        )
      ) {
        res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
        return;
      }

      const updatedResource = await UserOrganizationService.update(id, payload);

      if (!updatedResource) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      res.status(200).json(updatedResource);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to update user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to update user-organization mapping." });
    }
  },

  listMappingsForUser: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req); // this is the Cognito sub from the token

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resources = await UserOrganizationService.listByUserId(userId);

      res.status(200).json(resources);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error(
        "Failed to list current user's organization mappings",
        error,
      );
      res.status(500).json({
        message: "Unable to list current user's organization mappings.",
      });
    }
  },

  listByOrganisationId: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const requesterUserId = resolveUserIdFromRequest(req);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organisation Id is required and type should be string.",
        });
      }

      if (!requesterUserId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;

      if (
        !canEditOrganisation(
          `Organization/${organisationId}`,
          requesterMappings ?? [],
        ) &&
        !requesterMappings?.some((entry) => {
          const mapping = entry.mapping;
          return Boolean(
            mapping &&
            sameOrganisation(
              mapping.organizationReference,
              `Organization/${organisationId}`,
            ) &&
            hasPermission(mapping.effectivePermissions, TEAM_VIEW_PERMISSION),
          );
        })
      ) {
        return res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
      }

      const result =
        await UserOrganizationService.listByOrganisationId(organisationId);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to list current organization's mappings", error);
      res.status(500).json({
        message: "Unable to list current user's organization mappings.",
      });
    }
  },
};
