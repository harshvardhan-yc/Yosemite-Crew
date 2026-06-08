import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CatalogController } from "src/controllers/web/catalog.controller";

const router = Router();

router.post(
  "/products",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createProduct,
);

router.patch(
  "/products/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateProduct,
);

router.get(
  "/products/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getProductById,
);

router.get(
  "/packages/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getPackageDetail,
);

router.get(
  "/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listProducts,
);

router.get(
  "/organisation/:organisationId/specialities/:specialityId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getSpecialityCatalog,
);

router.post(
  "/resolve",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.resolveProduct,
);

export default router;
