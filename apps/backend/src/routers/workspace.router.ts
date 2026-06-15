import { Router } from "express";
import { WorkspaceController } from "src/controllers/web/workspace.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/organisations/:organisationId/appointments/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getAppointmentBootstrap(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getEncounterBootstrap(req, res),
);

export default router;
