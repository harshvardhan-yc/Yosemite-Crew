import type {
  AppointmentKind,
  PackageItemPricingMode,
  ProductKind,
  ResolvedCatalogItem,
  ResolvedCatalogSelection,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";

type ProductPriceRecord = {
  unitPrice: number;
  currency: string | null;
  defaultDiscountPercent: number | null;
  maxDiscountPercent: number | null;
  isDefault: boolean;
};

type ProductRecord = {
  id: string;
  organisationId: string;
  name: string;
  kind: ProductKind;
  isActive: boolean;
  prices: ProductPriceRecord[];
  bookable: {
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  package: {
    items: Array<{
      childProductItemId: string;
      quantity: number;
      pricingMode: PackageItemPricingMode;
      overridePrice: number | null;
      childProductItem: {
        id: string;
        name: string;
        kind: ProductKind;
        isActive: boolean;
        prices: ProductPriceRecord[];
      };
    }>;
  } | null;
};

export class CatalogServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CatalogServiceError";
  }
}

const toAppointmentKinds = (
  bookable: ProductRecord["bookable"],
): AppointmentKind[] => {
  if (!bookable) return [];

  const kinds: AppointmentKind[] = [];
  if (bookable.supportsOutpatient) kinds.push("OUTPATIENT");
  if (bookable.supportsInpatient) kinds.push("INPATIENT");
  return kinds;
};

const getDefaultPrice = (prices: ProductPriceRecord[]) =>
  prices.find((price) => price.isDefault) ?? prices[0] ?? null;

const buildResolvedItem = (params: {
  productItemId: string;
  name: string;
  kind: ProductKind;
  quantity: number;
  unitPrice: number;
  referenceUnitPrice?: number | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
  isPackageComponent: boolean;
  packageProductItemId?: string | null;
}): ResolvedCatalogItem => ({
  productItemId: params.productItemId,
  name: params.name,
  kind: params.kind,
  quantity: params.quantity,
  unitPrice: params.unitPrice,
  referenceUnitPrice: params.referenceUnitPrice ?? null,
  defaultDiscountPercent: params.defaultDiscountPercent ?? null,
  maxDiscountPercent: params.maxDiscountPercent ?? null,
  isPackageComponent: params.isPackageComponent,
  packageProductItemId: params.packageProductItemId ?? null,
});

export const resolveCatalogSelectionFromRecord = (
  product: ProductRecord,
): ResolvedCatalogSelection => {
  if (!product.isActive) {
    throw new CatalogServiceError("Selected product is inactive.", 400);
  }

  const appointmentKinds = toAppointmentKinds(product.bookable);
  const parentPrice = getDefaultPrice(product.prices);
  const isBookable = appointmentKinds.length > 0;

  if (product.kind !== "PACKAGE") {
    return {
      productItemId: product.id,
      productKind: product.kind,
      isBookable,
      appointmentKinds,
      billingItems: [
        buildResolvedItem({
          productItemId: product.id,
          name: product.name,
          kind: product.kind,
          quantity: 1,
          unitPrice: parentPrice?.unitPrice ?? 0,
          defaultDiscountPercent: parentPrice?.defaultDiscountPercent ?? null,
          maxDiscountPercent: parentPrice?.maxDiscountPercent ?? null,
          isPackageComponent: false,
        }),
      ],
      includedItems: [],
    };
  }

  if (!product.package) {
    throw new CatalogServiceError(
      "Package product is missing package configuration.",
      500,
    );
  }

  const billingItems: ResolvedCatalogItem[] = [
    buildResolvedItem({
      productItemId: product.id,
      name: product.name,
      kind: product.kind,
      quantity: 1,
      unitPrice: parentPrice?.unitPrice ?? 0,
      defaultDiscountPercent: parentPrice?.defaultDiscountPercent ?? null,
      maxDiscountPercent: parentPrice?.maxDiscountPercent ?? null,
      isPackageComponent: false,
    }),
  ];
  const includedItems: ResolvedCatalogItem[] = [];

  for (const item of product.package.items) {
    if (!item.childProductItem.isActive) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is inactive.`,
        400,
      );
    }

    const childPrice = getDefaultPrice(item.childProductItem.prices);

    if (item.pricingMode === "INCLUDED") {
      includedItems.push(
        buildResolvedItem({
          productItemId: item.childProductItem.id,
          name: item.childProductItem.name,
          kind: item.childProductItem.kind,
          quantity: item.quantity,
          unitPrice: 0,
          referenceUnitPrice: childPrice?.unitPrice ?? null,
          defaultDiscountPercent: childPrice?.defaultDiscountPercent ?? null,
          maxDiscountPercent: childPrice?.maxDiscountPercent ?? null,
          isPackageComponent: true,
          packageProductItemId: product.id,
        }),
      );
      continue;
    }

    if (item.pricingMode === "OVERRIDE_PRICE" && item.overridePrice == null) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is missing override price.`,
        500,
      );
    }

    if (item.pricingMode === "INHERITED_PRICE" && !childPrice) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is missing default price.`,
        500,
      );
    }

    billingItems.push(
      buildResolvedItem({
        productItemId: item.childProductItem.id,
        name: item.childProductItem.name,
        kind: item.childProductItem.kind,
        quantity: item.quantity,
        unitPrice:
          item.pricingMode === "OVERRIDE_PRICE"
            ? (item.overridePrice as number)
            : (childPrice?.unitPrice ?? 0),
        referenceUnitPrice: childPrice?.unitPrice ?? null,
        defaultDiscountPercent: childPrice?.defaultDiscountPercent ?? null,
        maxDiscountPercent: childPrice?.maxDiscountPercent ?? null,
        isPackageComponent: true,
        packageProductItemId: product.id,
      }),
    );
  }

  return {
    productItemId: product.id,
    productKind: product.kind,
    isBookable,
    appointmentKinds,
    billingItems,
    includedItems,
  };
};

const productSelectionInclude = {
  prices: {
    orderBy: [{ isDefault: "desc" as const }],
  },
  bookable: {
    select: {
      supportsOutpatient: true,
      supportsInpatient: true,
    },
  },
  package: {
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" as const }],
        include: {
          childProductItem: {
            include: {
              prices: {
                orderBy: [{ isDefault: "desc" as const }],
              },
            },
          },
        },
      },
    },
  },
};

export const CatalogService = {
  async resolveSelection(productItemId: string, organisationId?: string) {
    const product = (await prisma.productItem.findFirst({
      where: {
        id: productItemId,
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    return resolveCatalogSelectionFromRecord(product);
  },
};
