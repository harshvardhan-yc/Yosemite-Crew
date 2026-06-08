import type {
  AppointmentKind,
  CatalogListRow,
  CatalogPackageDetail,
  CatalogPackageBreakdownRow,
  CatalogPricePolicy,
  CatalogTab,
  PackageItemPricingMode,
  ProductKind,
  ResolvedCatalogItem,
  ResolvedCatalogSelection,
  SpecialityCatalogView,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";

export type CatalogPackageItemInput = {
  childProductItemId: string;
  quantity: number;
  pricingMode: PackageItemPricingMode;
  overridePrice?: number | null;
  sortOrder?: number;
  isOptional?: boolean;
};

export type CatalogBookableInput = {
  durationMinutes: number;
  supportsOutpatient?: boolean;
  supportsInpatient?: boolean;
};

export type CatalogProductUpsertInput = {
  organisationId: string;
  name: string;
  description?: string | null;
  code?: string | null;
  kind: ProductKind;
  specialityId?: string | null;
  legacyServiceId?: string | null;
  isActive?: boolean;
  price?: CatalogPricePolicy | null;
  bookable?: CatalogBookableInput | null;
  packageItems?: CatalogPackageItemInput[] | null;
};

export type CatalogProductListFilters = {
  organisationId: string;
  specialityId?: string;
  kinds?: ProductKind[];
  includeInactive?: boolean;
};

export type CatalogProductView = {
  id: string;
  organisationId: string;
  name: string;
  description: string | null;
  code: string | null;
  kind: ProductKind;
  specialityId: string | null;
  legacyServiceId: string | null;
  isActive: boolean;
  defaultPrice: (CatalogPricePolicy & { isDefault: boolean }) | null;
  bookable: {
    durationMinutes: number;
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  packageItems: Array<{
    id: string;
    childProductItemId: string;
    childProductName: string;
    childProductKind: ProductKind;
    quantity: number;
    pricingMode: PackageItemPricingMode;
    overridePrice: number | null;
    sortOrder: number;
    isOptional: boolean;
  }>;
};

export type SpecialityCatalogFilters = {
  organisationId: string;
  specialityId: string;
  tab?: CatalogTab;
  search?: string;
  includeInactive?: boolean;
};

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
  description: string | null;
  code: string | null;
  kind: ProductKind;
  specialityId: string | null;
  legacyServiceId: string | null;
  isActive: boolean;
  prices: ProductPriceRecord[];
  bookable: {
    durationMinutes: number;
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  package: {
    items: Array<{
      id: string;
      childProductItemId: string;
      quantity: number;
      pricingMode: PackageItemPricingMode;
      overridePrice: number | null;
      sortOrder: number;
      isOptional: boolean;
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

const requireSafeString = (value: unknown, field: string) => {
  if (typeof value !== "string") {
    throw new CatalogServiceError(`${field} is required.`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new CatalogServiceError(`${field} is required.`, 400);
  }

  if (trimmed.includes("$")) {
    throw new CatalogServiceError(`Invalid ${field}.`, 400);
  }

  return trimmed;
};

const optionalSafeString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new CatalogServiceError("Invalid string value.", 400);
  }
  const trimmed = value.trim();
  return trimmed || null;
};

const assertPackageItems = (
  kind: ProductKind,
  packageItems: CatalogPackageItemInput[] | null | undefined,
) => {
  if (kind !== "PACKAGE" && packageItems && packageItems.length > 0) {
    throw new CatalogServiceError(
      "Only products with kind PACKAGE can define package items.",
      400,
    );
  }

  if (kind === "PACKAGE" && !packageItems) {
    throw new CatalogServiceError(
      "Package products must include packageItems.",
      400,
    );
  }
};

const assertBookableConfig = (
  bookable: CatalogBookableInput | null | undefined,
) => {
  if (!bookable) return;

  if (
    !Number.isInteger(bookable.durationMinutes) ||
    bookable.durationMinutes <= 0
  ) {
    throw new CatalogServiceError(
      "Bookable durationMinutes must be a positive integer.",
      400,
    );
  }

  if (
    bookable.supportsOutpatient === false &&
    bookable.supportsInpatient === false
  ) {
    throw new CatalogServiceError(
      "Bookable products must support at least one appointment kind.",
      400,
    );
  }
};

const assertPriceConfig = (price: CatalogPricePolicy | null | undefined) => {
  if (!price) return;

  if (price.unitPrice < 0) {
    throw new CatalogServiceError("Price unitPrice cannot be negative.", 400);
  }
  if (
    price.defaultDiscountPercent != null &&
    (price.defaultDiscountPercent < 0 || price.defaultDiscountPercent > 100)
  ) {
    throw new CatalogServiceError(
      "defaultDiscountPercent must be between 0 and 100.",
      400,
    );
  }
  if (
    price.maxDiscountPercent != null &&
    (price.maxDiscountPercent < 0 || price.maxDiscountPercent > 100)
  ) {
    throw new CatalogServiceError(
      "maxDiscountPercent must be between 0 and 100.",
      400,
    );
  }
  if (
    price.defaultDiscountPercent != null &&
    price.maxDiscountPercent != null &&
    price.defaultDiscountPercent > price.maxDiscountPercent
  ) {
    throw new CatalogServiceError(
      "defaultDiscountPercent cannot exceed maxDiscountPercent.",
      400,
    );
  }
};

const sanitizePackageItems = (
  packageItems: CatalogPackageItemInput[] | null | undefined,
) => {
  if (!packageItems) return null;

  return packageItems.map((item, index) => {
    const childProductItemId = requireSafeString(
      item.childProductItemId,
      `packageItems[${index}].childProductItemId`,
    );

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new CatalogServiceError(
        `packageItems[${index}].quantity must be a positive integer.`,
        400,
      );
    }

    if (
      item.pricingMode === "OVERRIDE_PRICE" &&
      (item.overridePrice == null || item.overridePrice < 0)
    ) {
      throw new CatalogServiceError(
        `packageItems[${index}].overridePrice is required for OVERRIDE_PRICE.`,
        400,
      );
    }

    return {
      childProductItemId,
      quantity: item.quantity,
      pricingMode: item.pricingMode,
      overridePrice: item.overridePrice ?? null,
      sortOrder: item.sortOrder ?? index,
      isOptional: item.isOptional ?? false,
    };
  });
};

const mapProductRecordToView = (product: ProductRecord): CatalogProductView => {
  const defaultPrice = getDefaultPrice(product.prices);

  return {
    id: product.id,
    organisationId: product.organisationId,
    name: product.name,
    description: product.description,
    code: product.code,
    kind: product.kind,
    specialityId: product.specialityId,
    legacyServiceId: product.legacyServiceId,
    isActive: product.isActive,
    defaultPrice: defaultPrice
      ? {
          unitPrice: defaultPrice.unitPrice,
          currency: defaultPrice.currency,
          defaultDiscountPercent: defaultPrice.defaultDiscountPercent,
          maxDiscountPercent: defaultPrice.maxDiscountPercent,
          isDefault: defaultPrice.isDefault,
        }
      : null,
    bookable: product.bookable
      ? {
          durationMinutes: product.bookable.durationMinutes,
          supportsOutpatient: product.bookable.supportsOutpatient,
          supportsInpatient: product.bookable.supportsInpatient,
        }
      : null,
    packageItems:
      product.package?.items.map((item) => ({
        id: item.id,
        childProductItemId: item.childProductItemId,
        childProductName: item.childProductItem.name,
        childProductKind: item.childProductItem.kind,
        quantity: item.quantity,
        pricingMode: item.pricingMode,
        overridePrice: item.overridePrice,
        sortOrder: item.sortOrder,
        isOptional: item.isOptional,
      })) ?? [],
  };
};

const computeLineAmount = (params: {
  unitPrice: number;
  quantity: number;
  discountPercent?: number | null;
}) => {
  const grossAmount = params.unitPrice * params.quantity;
  const discountPercent = params.discountPercent ?? 0;
  const finalAmount = grossAmount - grossAmount * (discountPercent / 100);

  return {
    grossAmount,
    finalAmount,
  };
};

const mapProductRecordToCatalogListRow = (
  product: ProductRecord,
): CatalogListRow => {
  const defaultPrice = getDefaultPrice(product.prices);
  const durationMinutes = product.bookable?.durationMinutes ?? null;
  const unitPrice = defaultPrice?.unitPrice ?? null;
  const defaultDiscountPercent = defaultPrice?.defaultDiscountPercent ?? null;
  const maxDiscountPercent = defaultPrice?.maxDiscountPercent ?? null;

  let totalAmount = 0;

  if (product.kind === "PACKAGE" && product.package?.items.length) {
    totalAmount = product.package.items.reduce((sum, item) => {
      const childPrice = getDefaultPrice(item.childProductItem.prices);
      const referenceUnitPrice =
        item.pricingMode === "OVERRIDE_PRICE"
          ? (item.overridePrice ?? 0)
          : (childPrice?.unitPrice ?? 0);
      const discountPercent =
        childPrice?.defaultDiscountPercent ?? defaultDiscountPercent ?? 0;
      const line = computeLineAmount({
        unitPrice: item.pricingMode === "INCLUDED" ? 0 : referenceUnitPrice,
        quantity: item.quantity,
        discountPercent: item.pricingMode === "INCLUDED" ? 0 : discountPercent,
      });

      return sum + line.finalAmount;
    }, 0);
  } else if (unitPrice != null) {
    totalAmount = computeLineAmount({
      unitPrice,
      quantity: 1,
      discountPercent: defaultDiscountPercent ?? 0,
    }).finalAmount;
  }

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    kind: product.kind,
    isBookable: Boolean(product.bookable),
    isActive: product.isActive,
    durationMinutes,
    unitPrice,
    defaultDiscountPercent,
    maxDiscountPercent,
    totalAmount,
  };
};

const mapPackageRecordToDetail = (
  product: ProductRecord,
): CatalogPackageDetail => {
  if (product.kind !== "PACKAGE") {
    throw new CatalogServiceError("Product is not a package.", 400);
  }

  const defaultPrice = getDefaultPrice(product.prices);
  const items: CatalogPackageBreakdownRow[] =
    product.package?.items.map((item) => {
      const childPrice = getDefaultPrice(item.childProductItem.prices);
      const unitPrice =
        item.pricingMode === "OVERRIDE_PRICE"
          ? (item.overridePrice ?? 0)
          : (childPrice?.unitPrice ?? 0);
      const discountPercent =
        item.pricingMode === "INCLUDED"
          ? 0
          : (childPrice?.defaultDiscountPercent ?? 0);
      const { grossAmount, finalAmount } = computeLineAmount({
        unitPrice: item.pricingMode === "INCLUDED" ? 0 : unitPrice,
        quantity: item.quantity,
        discountPercent,
      });

      return {
        id: item.id,
        type: item.childProductItem.kind,
        name: item.childProductItem.name,
        quantity: item.quantity,
        unitPrice,
        grossAmount,
        discountPercent: item.pricingMode === "INCLUDED" ? 0 : discountPercent,
        finalAmount,
      };
    }) ?? [];

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    isBookable: Boolean(product.bookable),
    isActive: product.isActive,
    durationMinutes: product.bookable?.durationMinutes ?? null,
    maxDiscountPercent: defaultPrice?.maxDiscountPercent ?? null,
    totalAmount: items.reduce((sum, item) => sum + item.finalAmount, 0),
    items,
  };
};

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
      legacyServiceId: product.legacyServiceId,
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
    legacyServiceId: product.legacyServiceId,
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
      durationMinutes: true,
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
  async createProduct(input: CatalogProductUpsertInput) {
    const organisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const name = requireSafeString(input.name, "name");
    const description = optionalSafeString(input.description);
    const code = optionalSafeString(input.code);
    const specialityId = optionalSafeString(input.specialityId);
    const legacyServiceId = optionalSafeString(input.legacyServiceId);
    const packageItems = sanitizePackageItems(input.packageItems);

    assertPackageItems(input.kind, packageItems);
    assertBookableConfig(input.bookable);
    assertPriceConfig(input.price);

    const created = (await prisma.productItem.create({
      data: {
        organisationId,
        name,
        description: description ?? undefined,
        code: code ?? undefined,
        kind: input.kind,
        specialityId: specialityId ?? undefined,
        legacyServiceId: legacyServiceId ?? undefined,
        isActive: input.isActive ?? true,
        prices: input.price
          ? {
              create: {
                unitPrice: input.price.unitPrice,
                currency: input.price.currency ?? undefined,
                defaultDiscountPercent:
                  input.price.defaultDiscountPercent ?? undefined,
                maxDiscountPercent: input.price.maxDiscountPercent ?? undefined,
                isDefault: true,
              },
            }
          : undefined,
        bookable: input.bookable
          ? {
              create: {
                durationMinutes: input.bookable.durationMinutes,
                supportsOutpatient: input.bookable.supportsOutpatient ?? true,
                supportsInpatient: input.bookable.supportsInpatient ?? false,
              },
            }
          : undefined,
        package:
          input.kind === "PACKAGE"
            ? {
                create: {
                  items:
                    packageItems && packageItems.length > 0
                      ? {
                          create: packageItems,
                        }
                      : undefined,
                },
              }
            : undefined,
      },
      include: productSelectionInclude,
    })) as ProductRecord;

    return mapProductRecordToView(created);
  },

  async updateProduct(id: string, input: Partial<CatalogProductUpsertInput>) {
    const productId = requireSafeString(id, "productId");
    const existing = await prisma.productItem.findUnique({
      where: { id: productId },
      include: {
        prices: true,
        bookable: true,
        package: { include: { items: true } },
      },
    });

    if (!existing) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    const nextKind = input.kind ?? (existing.kind as ProductKind);
    const packageItems =
      input.packageItems === undefined
        ? undefined
        : sanitizePackageItems(input.packageItems);
    assertPackageItems(
      nextKind,
      packageItems ?? existing.package?.items ?? null,
    );
    assertBookableConfig(input.bookable);
    assertPriceConfig(input.price);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.productItem.update({
        where: { id: productId },
        data: {
          organisationId:
            input.organisationId != null
              ? requireSafeString(input.organisationId, "organisationId")
              : undefined,
          name:
            input.name != null
              ? requireSafeString(input.name, "name")
              : undefined,
          description:
            input.description !== undefined
              ? (optionalSafeString(input.description) ?? null)
              : undefined,
          code:
            input.code !== undefined
              ? (optionalSafeString(input.code) ?? null)
              : undefined,
          kind: input.kind,
          specialityId:
            input.specialityId !== undefined
              ? optionalSafeString(input.specialityId)
              : undefined,
          legacyServiceId:
            input.legacyServiceId !== undefined
              ? optionalSafeString(input.legacyServiceId)
              : undefined,
          isActive: input.isActive,
        },
      });

      if (input.price !== undefined) {
        const defaultPrice = await tx.productPrice.findFirst({
          where: { productItemId: productId, isDefault: true },
        });
        if (input.price === null) {
          if (defaultPrice) {
            await tx.productPrice.delete({ where: { id: defaultPrice.id } });
          }
        } else if (defaultPrice) {
          await tx.productPrice.update({
            where: { id: defaultPrice.id },
            data: {
              unitPrice: input.price.unitPrice,
              currency: input.price.currency ?? null,
              defaultDiscountPercent:
                input.price.defaultDiscountPercent ?? null,
              maxDiscountPercent: input.price.maxDiscountPercent ?? null,
            },
          });
        } else {
          await tx.productPrice.create({
            data: {
              productItemId: productId,
              unitPrice: input.price.unitPrice,
              currency: input.price.currency ?? undefined,
              defaultDiscountPercent:
                input.price.defaultDiscountPercent ?? undefined,
              maxDiscountPercent: input.price.maxDiscountPercent ?? undefined,
              isDefault: true,
            },
          });
        }
      }

      if (input.bookable !== undefined) {
        if (input.bookable === null) {
          await tx.productBookable.deleteMany({
            where: { productItemId: productId },
          });
        } else {
          await tx.productBookable.upsert({
            where: { productItemId: productId },
            update: {
              durationMinutes: input.bookable.durationMinutes,
              supportsOutpatient: input.bookable.supportsOutpatient ?? true,
              supportsInpatient: input.bookable.supportsInpatient ?? false,
            },
            create: {
              productItemId: productId,
              durationMinutes: input.bookable.durationMinutes,
              supportsOutpatient: input.bookable.supportsOutpatient ?? true,
              supportsInpatient: input.bookable.supportsInpatient ?? false,
            },
          });
        }
      }

      if (nextKind === "PACKAGE") {
        const pkg = await tx.productPackage.upsert({
          where: { productItemId: productId },
          update: {},
          create: { productItemId: productId },
        });

        if (packageItems !== undefined) {
          const nextPackageItems = packageItems ?? [];
          await tx.productPackageItem.deleteMany({
            where: { packageId: pkg.id },
          });

          if (nextPackageItems.length > 0) {
            await tx.productPackageItem.createMany({
              data: nextPackageItems.map((item) => ({
                packageId: pkg.id,
                childProductItemId: item.childProductItemId,
                quantity: item.quantity,
                pricingMode: item.pricingMode,
                overridePrice: item.overridePrice,
                sortOrder: item.sortOrder,
                isOptional: item.isOptional,
              })),
            });
          }
        }
      } else {
        const pkg = await tx.productPackage.findUnique({
          where: { productItemId: productId },
        });
        if (pkg) {
          await tx.productPackage.delete({ where: { id: pkg.id } });
        }
      }

      return (await tx.productItem.findUnique({
        where: { id: productId },
        include: productSelectionInclude,
      })) as ProductRecord | null;
    });

    if (!updated) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    return mapProductRecordToView(updated);
  },

  async getProductById(id: string, organisationId?: string) {
    const productId = requireSafeString(id, "productId");
    const product = (await prisma.productItem.findFirst({
      where: {
        id: productId,
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    return mapProductRecordToView(product);
  },

  async getPackageDetail(id: string, organisationId?: string) {
    const productId = requireSafeString(id, "productId");
    const product = (await prisma.productItem.findFirst({
      where: {
        id: productId,
        kind: "PACKAGE",
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Package not found.", 404);
    }

    return mapPackageRecordToDetail(product);
  },

  async listProducts(filters: CatalogProductListFilters) {
    const organisationId = requireSafeString(
      filters.organisationId,
      "organisationId",
    );

    const products = (await prisma.productItem.findMany({
      where: {
        organisationId,
        ...(filters.specialityId
          ? {
              specialityId: requireSafeString(
                filters.specialityId,
                "specialityId",
              ),
            }
          : {}),
        ...(filters.kinds && filters.kinds.length > 0
          ? { kind: { in: filters.kinds } }
          : {}),
        ...(filters.includeInactive ? {} : { isActive: true }),
      },
      include: productSelectionInclude,
      orderBy: [{ name: "asc" }],
    })) as ProductRecord[];

    return products.map(mapProductRecordToView);
  },

  async getSpecialityCatalog(
    filters: SpecialityCatalogFilters,
  ): Promise<SpecialityCatalogView> {
    const organisationId = requireSafeString(
      filters.organisationId,
      "organisationId",
    );
    const specialityId = requireSafeString(
      filters.specialityId,
      "specialityId",
    );
    const search = optionalSafeString(filters.search);
    const activeTab = filters.tab ?? "all";

    const products = (await prisma.productItem.findMany({
      where: {
        organisationId,
        specialityId,
        ...(filters.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: productSelectionInclude,
      orderBy: [{ name: "asc" }],
    })) as ProductRecord[];

    const services = products
      .filter((product) => product.kind !== "PACKAGE")
      .map(mapProductRecordToCatalogListRow);
    const packages = products
      .filter((product) => product.kind === "PACKAGE")
      .map(mapProductRecordToCatalogListRow);

    return {
      specialityId,
      organisationId,
      activeTab,
      search,
      services: activeTab === "packages" ? [] : services,
      packages: activeTab === "services" ? [] : packages,
    };
  },

  async resolveSelection(productItemId: string, organisationId?: string) {
    const product = (await prisma.productItem.findFirst({
      where: {
        OR: [{ id: productItemId }, { legacyServiceId: productItemId }],
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
