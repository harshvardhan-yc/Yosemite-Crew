import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  CatalogService,
  CatalogServiceError,
  type CatalogProductUpsertInput,
} from "src/services/catalog.service";

const productKindSchema = z.enum([
  "CONSULTATION",
  "PROCEDURE",
  "DIAGNOSTIC",
  "MEDICATION",
  "INVENTORY_ITEM",
  "LAB_TEST",
  "PACKAGE",
]);

const packagePricingModeSchema = z.enum([
  "INCLUDED",
  "INHERITED_PRICE",
  "OVERRIDE_PRICE",
]);

const priceSchema = z.object({
  unitPrice: z.number().min(0),
  currency: z.string().trim().min(1).optional().nullable(),
  defaultDiscountPercent: z.number().min(0).max(100).optional().nullable(),
  maxDiscountPercent: z.number().min(0).max(100).optional().nullable(),
});

const bookableSchema = z.object({
  durationMinutes: z.number().int().positive(),
  supportsOutpatient: z.boolean().optional(),
  supportsInpatient: z.boolean().optional(),
});

const packageItemSchema = z.object({
  childProductItemId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  pricingMode: packagePricingModeSchema,
  overridePrice: z.number().min(0).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isOptional: z.boolean().optional(),
});

const createProductSchema = z.object({
  organisationId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  code: z.string().trim().optional().nullable(),
  kind: productKindSchema,
  specialityId: z.string().trim().optional().nullable(),
  legacyServiceId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  price: priceSchema.optional().nullable(),
  bookable: bookableSchema.optional().nullable(),
  packageItems: z.array(packageItemSchema).optional().nullable(),
});

const updateProductSchema = createProductSchema.partial();

const resolveSchema = z.object({
  productItemId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1).optional(),
});

const listQuerySchema = z.object({
  specialityId: z.string().trim().min(1).optional(),
  kinds: z.string().trim().optional(),
  search: z.string().trim().optional(),
  includeInactive: z.union([z.literal("true"), z.literal("false")]).optional(),
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
    req: Request<unknown, unknown, CatalogProductUpsertInput>,
    res: Response,
  ) => {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid product payload.",
          errors: parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createProduct(parsed.data);
      return res.status(201).json(created);
    } catch (error) {
      return handleError(res, error, "Unable to create catalog product.");
    }
  },

  updateProduct: async (
    req: Request<{ id: string }, unknown, Partial<CatalogProductUpsertInput>>,
    res: Response,
  ) => {
    try {
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid product update payload.",
          errors: parsed.error.flatten(),
        });
      }

      const updated = await CatalogService.updateProduct(
        req.params.id,
        parsed.data,
      );
      return res.status(200).json(updated);
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
      return res.status(200).json(product);
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
        organisationId: req.params.organisationId,
        specialityId: queryResult.data.specialityId,
        kinds: parseKinds(queryResult.data.kinds),
        includeInactive: queryResult.data.includeInactive === "true",
      });

      return res.status(200).json(products);
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
