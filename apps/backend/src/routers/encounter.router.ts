import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { EncounterController } from "src/controllers/web/case-encounter.controller";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.create,
);

router.patch(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.update,
);

router.get(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.getById,
);

router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.list,
);

export default router;
