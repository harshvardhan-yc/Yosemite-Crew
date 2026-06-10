export const PRODUCT_KINDS = [
  'CONSULTATION',
  'PROCEDURE',
  'DIAGNOSTIC',
  'MEDICATION',
  'INVENTORY_ITEM',
  'LAB_TEST',
  'PACKAGE',
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const APPOINTMENT_KINDS = ['OUTPATIENT', 'INPATIENT'] as const;

export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export const PACKAGE_ITEM_PRICING_MODES = [
  'INCLUDED',
  'INHERITED_PRICE',
  'OVERRIDE_PRICE',
] as const;

export type PackageItemPricingMode = (typeof PACKAGE_ITEM_PRICING_MODES)[number];

export type CatalogPricePolicy = {
  unitPrice: number;
  currency?: string | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
};

export type ResolvedCatalogItem = {
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
};

export type ResolvedCatalogSelection = {
  productItemId: string;
  productKind: ProductKind;
  legacyServiceId?: string | null;
  isBookable: boolean;
  appointmentKinds: AppointmentKind[];
  billingItems: ResolvedCatalogItem[];
  includedItems: ResolvedCatalogItem[];
};
