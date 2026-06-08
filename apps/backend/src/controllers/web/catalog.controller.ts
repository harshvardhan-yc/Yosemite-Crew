import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  CatalogService,
  CatalogServiceError,
} from "src/services/catalog.service";
import {
  fromCatalogRequestDTO,
  type CatalogRequestDTO,
  toCatalogBundleResponseDTO,
  toCatalogResponseDTO,
} from "@yosemite-crew/types";

const productKindSchema = z.enum([
  "CONSULTATION",
  "PROCEDURE",
  "DIAGNOSTIC",
  "MEDICATION",
  "INVENTORY_ITEM",
  "LAB_TEST",
  "PACKAGE",
]);

const healthcareServiceSchema = z
  .object({
    resourceType: z.literal("HealthcareService"),
  })
  .passthrough();

const resolveSchema = z.object({
  productItemId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1).optional(),
});

const listQuerySchema = z.object({
  specialityId: z.string().trim().min(1).optional(),
  kinds: z.string().trim().optional(),
  search: z.string().trim().optional(),
  includeInactive: z.union([z.literal("true"), z.literal("false")]).optional(),
  organization: z.string().trim().min(1).optional(),
  "provided-by": z.string().trim().min(1).optional(),
  specialty: z.string().trim().min(1).optional(),
  active: z.union([z.literal("true"), z.literal("false")]).optional(),
  name: z.string().trim().optional(),
  kind: z.string().trim().optional(),
});

const specialityCatalogQuerySchema = z.object({
  tab: z.enum(["services", "packages", "all"]).optional(),
  search: z.string().trim().optional(),
  includeInactive: z.union([z.literal("true"), z.literal("false")]).optional(),
});

const handleError = (res: Response, error: unknown, defaultMessage: string) => {
  if (error instanceof CatalogServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
};

const parseKinds = (value?: string) => {
  if (!value) return undefined;

  const rawKinds = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawKinds.length === 0) return undefined;

  return z.array(productKindSchema).parse(rawKinds);
};

export const CatalogController = {
  createProduct: async (
    req: Request<unknown, unknown, CatalogRequestDTO>,
    res: Response,
  ) => {
    try {
      const parsed = healthcareServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR HealthcareService resource.",
          errors: parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createProduct(
        fromCatalogRequestDTO(parsed.data),
      );
      return res.status(201).json(toCatalogResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Unable to create catalog product.");
    }
  },

  updateProduct: async (
    req: Request<{ id: string }, unknown, CatalogRequestDTO>,
    res: Response,
  ) => {
    try {
      const parsed = healthcareServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR HealthcareService resource.",
          errors: parsed.error.flatten(),
        });
      }

      const updated = await CatalogService.updateProduct(
        req.params.id,
        fromCatalogRequestDTO(parsed.data),
      );
      return res.status(200).json(toCatalogResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Unable to update catalog product.");
    }
  },

  getProductById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const organisationId =
        typeof req.query.organisationId === "string"
          ? req.query.organisationId
          : undefined;
      const product = await CatalogService.getProductById(
        req.params.id,
        organisationId,
      );
      return res.status(200).json(toCatalogResponseDTO(product));
    } catch (error) {
      return handleError(res, error, "Unable to fetch catalog product.");
    }
  },

  getPackageDetail: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const organisationId =
        typeof req.query.organisationId === "string"
          ? req.query.organisationId
          : undefined;
      const pkg = await CatalogService.getPackageDetail(
        req.params.id,
        organisationId,
      );
      return res.status(200).json(pkg);
    } catch (error) {
      return handleError(res, error, "Unable to fetch catalog package.");
    }
  },

  listProducts: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const queryResult = listQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          message: "Invalid catalog list query.",
          errors: queryResult.error.flatten(),
        });
      }

      const products = await CatalogService.listProducts({
        organisationId:
          queryResult.data.organization ??
          queryResult.data["provided-by"] ??
          req.params.organisationId,
        specialityId:
          queryResult.data.specialty ?? queryResult.data.specialityId,
        kinds: parseKinds(queryResult.data.kind ?? queryResult.data.kinds),
        includeInactive:
          queryResult.data.includeInactive === "true" ||
          queryResult.data.active === "false",
      });

      return res.status(200).json(
        toCatalogBundleResponseDTO(products, {
          baseUrl: `${req.baseUrl}`,
          searchMode: "match",
        }),
      );
    } catch (error) {
      return handleError(res, error, "Unable to list catalog products.");
    }
  },

  getSpecialityCatalog: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = specialityCatalogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid speciality catalog query.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.getSpecialityCatalog({
        organisationId: req.params.organisationId,
        specialityId: req.params.specialityId,
        tab: parsed.data.tab,
        search: parsed.data.search,
        includeInactive: parsed.data.includeInactive === "true",
      });

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to fetch speciality catalog.");
    }
  },

  resolveProduct: async (req: Request, res: Response) => {
    try {
      const parsed = resolveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog resolve payload.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.resolveSelection(
        parsed.data.productItemId,
        parsed.data.organisationId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to resolve catalog product.");
    }
  },
};
