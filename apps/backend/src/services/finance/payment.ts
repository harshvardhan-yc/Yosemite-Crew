import { Prisma } from "@prisma/client";
import type {
  BillingCollectionMode as PrismaBillingCollectionMode,
  PaymentAttemptStatus as PrismaPaymentAttemptStatus,
  PaymentProvider as PrismaPaymentProvider,
  PaymentStatus as PrismaPaymentStatus,
  SettlementChannel as PrismaSettlementChannel,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { roundMoney } from "./pricing";

type PaymentLineSummary = {
  id: string;
  amount: number;
  status: PrismaPaymentStatus;
};

export class FinancePaymentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FinancePaymentError";
  }
}

export type PaymentAttemptInput = {
  provider: PrismaPaymentProvider;
  status?: PrismaPaymentAttemptStatus;
  settlementChannel?: PrismaSettlementChannel | null;
  providerPaymentIntentId?: string | null;
  providerCheckoutSessionId?: string | null;
  providerPaymentLinkId?: string | null;
  amountRequested?: number;
  amountCaptured?: number;
  amountApplied?: number;
  currency: string;
  collectionMode?: PrismaBillingCollectionMode | null;
  isOffline?: boolean;
  isPartial?: boolean;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type ManualPaymentInput = {
  settlementChannel?: PrismaSettlementChannel;
  receivedAt?: Date;
  reference?: string;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type InvoicePaymentInput = {
  provider: PrismaPaymentProvider;
  amount: number;
  currency?: string;
  settlementChannel?: PrismaSettlementChannel | null;
  receivedAt?: Date;
  reference?: string;
  providerPaymentId?: string | null;
  collectionMode?: PrismaBillingCollectionMode | null;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

const getOutstandingBalance = async (
  invoiceId: string,
  totalAmount: number,
) => {
  const payments = await prisma.payment.findMany({
    where: { invoiceId, status: "SUCCEEDED" },
    select: { amount: true },
  });
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    paid: roundMoney(paid),
    balance: roundMoney(Math.max(0, totalAmount - paid)),
  };
};

const createPaymentAttempt = async (
  invoiceId: string,
  input: PaymentAttemptInput,
) =>
  prisma.paymentAttempt.create({
    data: {
      invoiceId,
      provider: input.provider,
      settlementChannel: input.settlementChannel ?? null,
      providerPaymentIntentId: input.providerPaymentIntentId ?? null,
      providerCheckoutSessionId: input.providerCheckoutSessionId ?? null,
      providerPaymentLinkId: input.providerPaymentLinkId ?? null,
      status: input.status ?? "REQUIRES_PAYMENT_METHOD",
      amountRequested: input.amountRequested ?? 0,
      amountCaptured: input.amountCaptured ?? 0,
      amountApplied: input.amountApplied ?? 0,
      currency: input.currency,
      collectionMode: input.collectionMode ?? null,
      isOffline: input.isOffline ?? false,
      isPartial: input.isPartial ?? false,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    },
  });

export const FinancePaymentService = {
  async createPaymentAttempt(invoiceId: string, input: PaymentAttemptInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    return createPaymentAttempt(invoiceId, input);
  },

  async recordManualPayment(invoiceId: string, input: ManualPaymentInput = {}) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: "SUCCEEDED" } } },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    const { balance } = await getOutstandingBalance(
      invoiceId,
      invoice.totalAmount,
    );
    const amount = balance;
    return this.recordInvoicePayment(invoiceId, {
      provider: "MANUAL",
      amount,
      settlementChannel: input.settlementChannel ?? "CASH",
      receivedAt: input.receivedAt,
      reference: input.reference,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    });
  },

  async recordInvoicePayment(invoiceId: string, input: InvoicePaymentInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: "SUCCEEDED" } } },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      throw new FinancePaymentError("Invoice cannot accept payment", 409);
    }

    const { paid, balance } = await getOutstandingBalance(
      invoiceId,
      invoice.totalAmount,
    );

    if (balance <= 0) {
      return {
        invoice,
        paymentAttempt: null,
        payment: null,
        balanceAfterPayment: 0,
        paidToDate: paid,
        appliedAmount: 0,
      };
    }

    const requestedAmount = roundMoney(input.amount);
    if (requestedAmount <= 0) {
      throw new FinancePaymentError(
        "Payment amount must be greater than zero",
        400,
      );
    }

    const appliedAmount = roundMoney(Math.min(requestedAmount, balance));
    const receivedAt = input.receivedAt ?? new Date();
    const isPartial = appliedAmount < balance || paid > 0;

    const paymentAttempt = await createPaymentAttempt(invoiceId, {
      provider: input.provider,
      status: "SUCCEEDED",
      settlementChannel: input.settlementChannel ?? null,
      amountRequested: requestedAmount,
      amountCaptured: appliedAmount,
      amountApplied: appliedAmount,
      currency: input.currency ?? invoice.currency,
      collectionMode: input.collectionMode ?? null,
      providerPaymentIntentId: input.providerPaymentId ?? null,
      isOffline: input.provider === "MANUAL",
      isPartial,
      rawProviderPayload: input.rawProviderPayload ?? null,
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        paymentAttemptId: paymentAttempt.id,
        provider: input.provider,
        settlementChannel: input.settlementChannel ?? null,
        collectionMode: input.collectionMode ?? null,
        providerPaymentId: input.providerPaymentId ?? null,
        amount: appliedAmount,
        currency: input.currency ?? invoice.currency,
        status: "SUCCEEDED",
        paidAt: receivedAt,
        receiptUrl: input.reference ?? undefined,
        rawProviderPayload: input.rawProviderPayload ?? undefined,
      },
    });

    const updatedInvoice =
      appliedAmount >= balance
        ? await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: "PAID", paidAt: receivedAt },
          })
        : invoice;

    const summary = await getOutstandingBalance(
      invoiceId,
      updatedInvoice.totalAmount,
    );

    return {
      invoice: updatedInvoice,
      paymentAttempt,
      payment,
      balanceAfterPayment: summary.balance,
      paidToDate: summary.paid,
      appliedAmount,
    };
  },

  async listPaymentsForInvoice(
    invoiceId: string,
  ): Promise<PaymentLineSummary[]> {
    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true, status: true },
    });

    return payments;
  },
};
