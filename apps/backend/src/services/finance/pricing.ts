export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export type TaxBehavior = "INCLUSIVE" | "EXCLUSIVE";

export type InvoicePricingLineInput = {
  quantity: number;
  unitAmount: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  taxBehavior?: TaxBehavior | null;
};

export type InvoiceDiscountInput = {
  type: DiscountType;
  value: number;
};

export type InvoicePricingInput = {
  lines: InvoicePricingLineInput[];
  taxRatePercent?: number | null;
  invoiceDiscount?: InvoiceDiscountInput | null;
};

export type InvoicePricingLineBreakdown = {
  grossAmount: number;
  lineDiscountAmount: number;
  netAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type InvoicePricingBreakdown = {
  subtotal: number;
  lineDiscountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  invoiceDiscountTotal: number;
  totalAmount: number;
  lines: InvoicePricingLineBreakdown[];
};

const MONEY_SCALE = 100;

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

const normalizePositiveNumber = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

const calculateLineDiscount = (
  grossAmount: number,
  discountType: DiscountType | null | undefined,
  discountValue: number | null | undefined,
): number => {
  const normalizedValue = normalizePositiveNumber(discountValue);
  if (!normalizedValue) {
    return 0;
  }

  if (discountType === "FIXED_AMOUNT") {
    return roundMoney(Math.min(normalizedValue, grossAmount));
  }

  if (discountType === "PERCENTAGE") {
    return roundMoney(
      Math.min(grossAmount, grossAmount * (normalizedValue / 100)),
    );
  }

  return 0;
};

const calculateInvoiceDiscount = (
  invoiceDiscount: InvoiceDiscountInput | null | undefined,
  baseAmount: number,
): number => {
  if (!invoiceDiscount) {
    return 0;
  }

  const normalizedValue = normalizePositiveNumber(invoiceDiscount.value);
  if (!normalizedValue) {
    return 0;
  }

  if (invoiceDiscount.type === "FIXED_AMOUNT") {
    return roundMoney(Math.min(normalizedValue, baseAmount));
  }

  if (invoiceDiscount.type === "PERCENTAGE") {
    return roundMoney(
      Math.min(baseAmount, baseAmount * (normalizedValue / 100)),
    );
  }

  return 0;
};

export const calculateInvoicePricing = (
  input: InvoicePricingInput,
): InvoicePricingBreakdown => {
  const taxRatePercent = normalizePositiveNumber(input.taxRatePercent);

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let taxableSubtotal = 0;
  let taxTotal = 0;

  const lines = input.lines.map((line) => {
    const quantity = normalizePositiveNumber(line.quantity);
    const unitAmount = normalizePositiveNumber(line.unitAmount);
    const grossAmount = roundMoney(quantity * unitAmount);
    const lineDiscountAmount = calculateLineDiscount(
      grossAmount,
      line.discountType,
      line.discountValue,
    );
    const netAmount = roundMoney(grossAmount - lineDiscountAmount);
    const taxBehavior = line.taxBehavior ?? "EXCLUSIVE";

    const taxableAmount =
      taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? roundMoney(netAmount / (1 + taxRatePercent / 100))
        : netAmount;

    const taxAmount =
      taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? roundMoney(netAmount - taxableAmount)
        : roundMoney(taxableAmount * (taxRatePercent / 100));

    const totalAmount =
      taxBehavior === "INCLUSIVE"
        ? netAmount
        : roundMoney(netAmount + taxAmount);

    subtotal = roundMoney(subtotal + grossAmount);
    lineDiscountTotal = roundMoney(lineDiscountTotal + lineDiscountAmount);
    taxableSubtotal = roundMoney(taxableSubtotal + taxableAmount);
    taxTotal = roundMoney(taxTotal + taxAmount);

    return {
      grossAmount,
      lineDiscountAmount,
      netAmount,
      taxableAmount,
      taxAmount,
      totalAmount,
    };
  });

  const amountBeforeInvoiceDiscount = roundMoney(
    lines.reduce((sum, line) => sum + line.totalAmount, 0),
  );
  const invoiceDiscountTotal = calculateInvoiceDiscount(
    input.invoiceDiscount,
    amountBeforeInvoiceDiscount,
  );
  const totalAmount = roundMoney(
    amountBeforeInvoiceDiscount - invoiceDiscountTotal,
  );

  return {
    subtotal,
    lineDiscountTotal,
    taxableSubtotal,
    taxTotal,
    invoiceDiscountTotal,
    totalAmount,
    lines,
  };
};
