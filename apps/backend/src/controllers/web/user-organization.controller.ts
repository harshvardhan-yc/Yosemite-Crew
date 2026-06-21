import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
  type UserOrganizationFHIRPayload,
} from "../../services/user-organization.service";
import { resolveUserIdFromRequest } from "src/utils/request";

type PermissionExtension = {
  url?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
};

type PermissionResource = {
  effectivePermissions?: string[];
  extension?: PermissionExtension[];
};

type UserOrganizationMapping = {
  practitionerReference?: string;
  organizationReference?: string;
  active?: boolean;
} & PermissionResource;

type UserOrganizationListing = {
  mapping?: UserOrganizationMapping;
};

type FhirPractitionerRole = {
  practitioner?: { reference?: string };
  organization?: { reference?: string };
  active?: boolean;
} & PermissionResource;

const TEAM_VIEW_PERMISSION = "teams:view:any";
const TEAM_EDIT_PERMISSION = "teams:edit:any";
const EFFECTIVE_PERMISSIONS_EXTENSION =
  "https://yosemitecrew.com/fhir/StructureDefinition/effective-permissions";

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

const isActiveMembership = (
  mapping:
    | Pick<UserOrganizationMapping, "active">
    | Pick<FhirPractitionerRole, "active">,
): boolean => mapping.active !== false;

const extractEffectivePermissions = (
  resource: UserOrganizationMapping | FhirPractitionerRole | undefined,
): string[] => {
  if (!resource) {
    return [];
  }

  if (resource.effectivePermissions?.length) {
    return resource.effectivePermissions;
  }

  const effectivePermissionsExtension = resource.extension?.find(
    (entry) => entry.url === EFFECTIVE_PERMISSIONS_EXTENSION,
  );

  return (
    effectivePermissionsExtension?.extension
      ?.map((entry) => entry.valueString)
      .filter((permission): permission is string =>
        Boolean(permission?.trim()),
      ) ?? []
  );
};

const hasTeamPermission = (
  resource: UserOrganizationMapping | FhirPractitionerRole | undefined,
  permission: string,
): boolean =>
  Boolean(
    resource &&
    isActiveMembership(resource) &&
    extractEffectivePermissions(resource).includes(permission),
  );

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
      (hasTeamPermission(mapping, TEAM_VIEW_PERMISSION) ||
        hasTeamPermission(mapping, TEAM_EDIT_PERMISSION)),
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
      isActiveMembership(mapping) &&
      sameOrganisation(mapping.organizationReference, organisationReference) &&
      hasTeamPermission(mapping, TEAM_EDIT_PERMISSION),
    );
  });

const resolveExistingResource = async (
  id: string | undefined,
): Promise<FhirPractitionerRole | null> => {
  if (!id) {
    return null;
  }

  const resource = await UserOrganizationService.getById(id);

  if (!resource || Array.isArray(resource)) {
    return null;
  }

  return resource as FhirPractitionerRole;
};

const hasPermissionOnCurrentAndNextOrg = (
  currentOrgReference: string | undefined,
  nextOrgReference: string | undefined,
  requesterMappings: UserOrganizationListing[],
): boolean => {
  if (!canEditOrganisation(currentOrgReference, requesterMappings)) {
    return false;
  }

  if (
    nextOrgReference &&
    !sameOrganisation(currentOrgReference, nextOrgReference) &&
    !canEditOrganisation(nextOrgReference, requesterMappings)
  ) {
    return false;
  }

  return true;
};

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
      const existingResource = await resolveExistingResource(payload.id);

      const hasTargetOrgAccess = canEditOrganisation(
        payload.organization?.reference,
        requesterMappings ?? [],
      );
      const hasExistingOrgAccess = existingResource
        ? canEditOrganisation(
            existingResource.organization?.reference,
            requesterMappings ?? [],
          )
        : true;
      const hasDestinationOrgAccess =
        existingResource &&
        payload.organization?.reference &&
        !sameOrganisation(
          existingResource.organization?.reference,
          payload.organization.reference,
        )
          ? canEditOrganisation(
              payload.organization.reference,
              requesterMappings ?? [],
            )
          : true;

      if (
        !hasTargetOrgAccess ||
        !hasExistingOrgAccess ||
        !hasDestinationOrgAccess
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

      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;
      const resource = await resolveExistingResource(id);

      if (!resource) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      if (
        !canEditOrganisation(
          resource.organization?.reference,
          requesterMappings ?? [],
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

      const requesterMappings = (await UserOrganizationService.listByUserId(
        requesterUserId,
      )) as UserOrganizationListing[] | undefined;
      const resource = await resolveExistingResource(id);

      if (!resource) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      if (
        !hasPermissionOnCurrentAndNextOrg(
          resource.organization?.reference,
          undefined,
          requesterMappings ?? [],
        )
      ) {
        res.status(403).json({
          message: "Forbidden – insufficient permissions",
        });
        return;
      }

      if (
        payload.organization?.reference &&
        !sameOrganisation(
          resource.organization?.reference,
          payload.organization.reference,
        ) &&
        !canEditOrganisation(
          payload.organization.reference,
          requesterMappings ?? [],
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
            isActiveMembership(mapping) &&
            sameOrganisation(
              mapping.organizationReference,
              `Organization/${organisationId}`,
            ) &&
            hasTeamPermission(mapping, TEAM_VIEW_PERMISSION),
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
