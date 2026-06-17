import {
  Prisma,
  TaxBehavior as PrismaTaxBehavior,
  TaxProvider as PrismaTaxProvider,
} from "@prisma/client";
import type { InvoiceDiscountInput } from "./pricing";
import type { InvoicePricingBreakdown } from "./pricing";

export type InvoiceTaxSnapshotInput = {
  provider: PrismaTaxProvider;
  providerReferenceId?: string | null;
  jurisdictionCountry?: string | null;
  jurisdictionState?: string | null;
  taxBehavior?: PrismaTaxBehavior | null;
  taxableSubtotal: number;
  taxAmount: number;
  taxBreakdown: Prisma.InputJsonValue;
  rawProviderPayload: Prisma.InputJsonValue;
  calculatedAt: Date;
};

export const DEFAULT_TAX_PROVIDER: PrismaTaxProvider = PrismaTaxProvider.STRIPE;

export const DEFAULT_TAX_BEHAVIOR: PrismaTaxBehavior = "EXCLUSIVE";

export const resolveConfiguredTaxProvider = (
  provider?: string | null,
): PrismaTaxProvider => {
  const normalized = provider?.trim().toUpperCase();
  if (normalized === PrismaTaxProvider.STRIPE) {
    return PrismaTaxProvider.STRIPE;
  }

  return DEFAULT_TAX_PROVIDER;
};

type TaxSnapshotMode = "preview" | "finalize";

export type InvoiceTaxProviderInput = {
  provider?: PrismaTaxProvider | null;
  taxBehavior?: PrismaTaxBehavior | null;
  taxRatePercent: number;
  invoiceDiscount?: InvoiceDiscountInput;
  pricing: InvoicePricingBreakdown;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>;
};

export interface InvoiceTaxProviderAdapter {
  provider: PrismaTaxProvider;
  preview(input: InvoiceTaxProviderInput): InvoiceTaxSnapshotInput;
  finalize(input: InvoiceTaxProviderInput): InvoiceTaxSnapshotInput;
}

const buildInvoiceTaxSnapshot = (
  input: {
    provider?: PrismaTaxProvider | null;
    taxBehavior?: PrismaTaxBehavior | null;
    taxRatePercent: number;
    invoiceDiscount?: InvoiceDiscountInput;
    mode: TaxSnapshotMode;
  },
  pricing: InvoicePricingBreakdown,
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>,
): InvoiceTaxSnapshotInput => {
  const provider = input.provider ?? DEFAULT_TAX_PROVIDER;
  const taxBehavior = input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR;

  return {
    provider,
    providerReferenceId: null,
    jurisdictionCountry: null,
    jurisdictionState: null,
    taxBehavior,
    taxableSubtotal: pricing.taxableSubtotal,
    taxAmount: pricing.taxTotal,
    taxBreakdown: {
      subtotal: pricing.subtotal,
      lineDiscountTotal: pricing.lineDiscountTotal,
      taxableSubtotal: pricing.taxableSubtotal,
      taxTotal: pricing.taxTotal,
      invoiceDiscountTotal: pricing.invoiceDiscountTotal,
      totalAmount: pricing.totalAmount,
      lines: pricing.lines,
    } as Prisma.InputJsonValue,
    rawProviderPayload: {
      provider,
      taxBehavior,
      taxRatePercent: input.taxRatePercent,
      invoiceDiscount: input.invoiceDiscount ?? null,
      lineItems,
      mode: input.mode,
    } as Prisma.InputJsonValue,
    calculatedAt: new Date(),
  };
};

const createDefaultTaxProviderAdapter = (): InvoiceTaxProviderAdapter => ({
  provider: DEFAULT_TAX_PROVIDER,
  preview: (input) =>
    buildInvoiceTaxSnapshot(
      {
        provider: input.provider ?? DEFAULT_TAX_PROVIDER,
        taxBehavior: input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
        taxRatePercent: input.taxRatePercent,
        invoiceDiscount: input.invoiceDiscount,
        mode: "preview",
      },
      input.pricing,
      input.lineItems,
    ),
  finalize: (input) =>
    buildInvoiceTaxSnapshot(
      {
        provider: input.provider ?? DEFAULT_TAX_PROVIDER,
        taxBehavior: input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
        taxRatePercent: input.taxRatePercent,
        invoiceDiscount: input.invoiceDiscount,
        mode: "finalize",
      },
      input.pricing,
      input.lineItems,
    ),
});

export const getInvoiceTaxProviderAdapter = (
  provider?: string | null,
): InvoiceTaxProviderAdapter => {
  const resolved = resolveConfiguredTaxProvider(provider);
  switch (resolved) {
    case PrismaTaxProvider.STRIPE:
    default:
      return createDefaultTaxProviderAdapter();
  }
};

export const previewInvoiceTaxSnapshot = (
  provider: string | null | undefined,
  input: InvoiceTaxProviderInput,
): InvoiceTaxSnapshotInput =>
  getInvoiceTaxProviderAdapter(provider).preview({
    ...input,
    provider: resolveConfiguredTaxProvider(provider),
  });

export const finalizeInvoiceTaxSnapshot = (
  provider: string | null | undefined,
  input: InvoiceTaxProviderInput,
): InvoiceTaxSnapshotInput =>
  getInvoiceTaxProviderAdapter(provider).finalize({
    ...input,
    provider: resolveConfiguredTaxProvider(provider),
  });
