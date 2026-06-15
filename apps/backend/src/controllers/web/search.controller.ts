import { Request, Response } from "express";
import { z } from "zod";
import {
  InventoryService,
  InventoryServiceError,
} from "src/services/inventory.service";
import logger from "src/utils/logger";

const searchQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "DELETED"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const asString = (value: unknown) => (typeof value === "string" ? value : null);

const toBatchSummary = (batch: Record<string, unknown>) => ({
  id: asString(batch.id) ?? "",
  batchNumber: asString(batch.batchNumber),
  lotNumber: asString(batch.lotNumber),
  expiryDate: batch.expiryDate instanceof Date ? batch.expiryDate : null,
  quantity: typeof batch.quantity === "number" ? batch.quantity : 0,
  allocated: typeof batch.allocated === "number" ? batch.allocated : 0,
});

const toSearchResult = (item: Record<string, unknown>) => ({
  itemId: asString(item.id) ?? "",
  organisationId: asString(item.organisationId) ?? "",
  name: asString(item.name) ?? "",
  code: asString(item.sku),
  genericName: asString(item.genericName),
  strength: asString(item.strength),
  dosageForm: asString(item.dosageForm),
  routeOfAdministration: asString(item.routeOfAdministration),
  drugClass: asString(item.drugClass),
  prescriptionRequired: Boolean(item.prescriptionRequired),
  controlledItem: Boolean(item.controlledItem),
  expiryTrackingRequired: Boolean(item.expiryTrackingRequired),
  unitOfMeasure: asString(item.unitOfMeasure),
  packageQuantity:
    typeof item.packageQuantity === "number" ? item.packageQuantity : null,
  onHand: typeof item.onHand === "number" ? item.onHand : 0,
  allocated: typeof item.allocated === "number" ? item.allocated : 0,
  nearestExpiryDate:
    item.nearestExpiryDate instanceof Date ? item.nearestExpiryDate : null,
  batches: Array.isArray(item.batches)
    ? item.batches.map((batch) =>
        toBatchSummary(batch as Record<string, unknown>),
      )
    : [],
});

const isMedicationItem = (item: Record<string, unknown>) =>
  item.itemType === "MEDICAL" ||
  Boolean(item.prescriptionRequired) ||
  asString(item.category)?.toLowerCase().includes("medication") === true;

const handleError = (error: unknown, res: Response) => {
  if (error instanceof InventoryServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid search query.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  logger.error("Unexpected search error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const runSearch = async (
  organisationId: string,
  query: z.infer<typeof searchQuerySchema>,
  medicationOnly: boolean,
) => {
  const results = await InventoryService.listItems({
    organisationId,
    search: query.search,
    category: query.category,
    subCategory: query.subCategory,
    status: query.status ?? "ACTIVE",
    sortBy: "name",
  });

  const items = (Array.isArray(results) ? results : results.items)
    .map((item) => item as Record<string, unknown>)
    .filter((item) => (medicationOnly ? isMedicationItem(item) : true))
    .map(toSearchResult);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
  };
};

export const SearchController = {
  async searchMedications(req: Request, res: Response) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await runSearch(req.params.organisationId, query, true);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchInventoryItems(req: Request, res: Response) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await runSearch(req.params.organisationId, query, false);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
