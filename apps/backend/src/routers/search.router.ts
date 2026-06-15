import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { SearchController } from "src/controllers/web/search.controller";

const router = Router();

router.get(
  "/organisations/:organisationId/medications",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["inventory:view:any", "prescription:view:any"]),
  (req, res) => SearchController.searchMedications(req, res),
);

router.get(
  "/organisations/:organisationId/inventory-items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  (req, res) => SearchController.searchInventoryItems(req, res),
);

export default router;
