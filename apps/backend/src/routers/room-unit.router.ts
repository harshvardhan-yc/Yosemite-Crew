import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { RoomUnitController } from "src/controllers/web/room-unit.controller";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.create,
);

router.put(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.update,
);

router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  RoomUnitController.list,
);

router.delete(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.delete,
);

export default router;
