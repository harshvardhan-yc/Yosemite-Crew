import {
  DEFAULT_TAX_PROVIDER,
  previewInvoiceTaxSnapshot,
  resolveConfiguredTaxProvider,
} from "../../src/services/finance/tax";

describe("finance tax helpers", () => {
  it("falls back to the default tax provider for unknown config", () => {
    expect(resolveConfiguredTaxProvider("unknown")).toBe(DEFAULT_TAX_PROVIDER);
    expect(resolveConfiguredTaxProvider(undefined)).toBe(DEFAULT_TAX_PROVIDER);
  });

  it("builds a provider-neutral tax snapshot payload", () => {
    const snapshot = previewInvoiceTaxSnapshot(undefined, {
      provider: DEFAULT_TAX_PROVIDER,
      taxBehavior: "INCLUSIVE",
      taxRatePercent: 18,
      invoiceDiscount: { type: "PERCENTAGE", value: 10 },
      pricing: {
        subtotal: 118,
        lineDiscountTotal: 0,
        taxableSubtotal: 100,
        taxTotal: 18,
        invoiceDiscountTotal: 10,
        totalAmount: 108,
        lines: [
          {
            grossAmount: 118,
            lineDiscountAmount: 0,
            netAmount: 118,
            taxableAmount: 100,
            taxAmount: 18,
            totalAmount: 118,
          },
        ],
      },
      lineItems: [
        {
          description: "Consultation",
          quantity: 1,
          unitPrice: 118,
          discountPercent: undefined,
        },
      ],
    });

    expect(snapshot.provider).toBe(DEFAULT_TAX_PROVIDER);
    expect(snapshot.taxBehavior).toBe("INCLUSIVE");
    expect(snapshot.taxAmount).toBe(18);
    expect(snapshot.rawProviderPayload).toEqual(
      expect.objectContaining({
        provider: DEFAULT_TAX_PROVIDER,
        taxBehavior: "INCLUSIVE",
      }),
    );
  });
});
