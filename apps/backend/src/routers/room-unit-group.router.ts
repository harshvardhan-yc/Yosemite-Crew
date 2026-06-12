import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { RoomUnitGroupController } from "src/controllers/web/room-unit-group.controller";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.create,
);

router.put(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.update,
);

router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  RoomUnitGroupController.list,
);

router.delete(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.delete,
);

export default router;
