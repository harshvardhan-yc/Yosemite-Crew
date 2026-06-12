import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CaseController } from "src/controllers/web/case-encounter.controller";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CaseController.create,
);

router.patch(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CaseController.update,
);

router.get(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CaseController.getById,
);

router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CaseController.list,
);

export default router;
