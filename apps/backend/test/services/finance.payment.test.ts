import {
  FinancePaymentError,
  FinancePaymentService,
  __setFinanceStripeClientForTests,
} from "../../src/services/finance/payment";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    paymentAttempt: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
  },
}));

describe("FinancePaymentService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    __setFinanceStripeClientForTests({
      checkout: { sessions: { create: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.APP_URL = "https://app.test";
  });

  it("creates provider-backed payment attempts", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_1",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_1",
      invoiceId: "inv_1",
    });

    const attempt = await FinancePaymentService.createPaymentAttempt("inv_1", {
      provider: "STRIPE",
      status: "REQUIRES_ACTION",
      settlementChannel: "STRIPE",
      providerPaymentIntentId: "pi_1",
      providerCheckoutSessionId: "cs_1",
      providerPaymentLinkId: "pl_1",
      amountRequested: 100,
      amountCaptured: 0,
      amountApplied: 0,
      currency: "usd",
      collectionMode: "PREPAY_AT_BOOKING",
      isOffline: false,
      isPartial: false,
      rawProviderPayload: { mode: "test" },
    });

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_1",
          provider: "STRIPE",
          status: "REQUIRES_ACTION",
          amountRequested: 100,
        }),
      }),
    );
    expect(attempt.id).toBe("pa_1");
  });

  it("records a partial payment without closing the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_2",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_2",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_2",
      amount: 25,
      status: "SUCCEEDED",
    });

    const result = await FinancePaymentService.recordInvoicePayment("inv_2", {
      provider: "MANUAL",
      amount: 25,
      settlementChannel: "CASH",
      currency: "usd",
      receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      rawProviderPayload: { source: "front-desk" },
    });

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountRequested: 25,
          amountApplied: 25,
          isPartial: true,
          isOffline: true,
          provider: "MANUAL",
        }),
      }),
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.balanceAfterPayment).toBe(75);
    expect(result.appliedAmount).toBe(25);
  });

  it("creates a checkout session and payment attempt for payable invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_6",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      stripeCheckoutUrl: null,
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [
        {
          name: "Consult",
          description: "Consult",
          unitPrice: 100,
          quantity: 1,
        },
      ],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_1",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_6",
    });
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_6");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_intent_data: expect.objectContaining({
          transfer_data: { destination: "acct_1" },
        }),
      }),
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_6",
          provider: "STRIPE",
          providerCheckoutSessionId: "cs_1",
          status: "REQUIRES_ACTION",
          amountRequested: 100,
        }),
      }),
    );
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_6" },
        data: expect.objectContaining({
          stripeCheckoutSessionId: "cs_1",
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      }),
    );
    expect(result.sessionId).toBe("cs_1");
    expect(result.paymentAttemptId).toBe("pa_6");
  });

  it("creates a payment intent and records a payment attempt for payable invoices", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_10",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        stripeCheckoutSessionId: "sess_old",
        stripeCheckoutUrl: "https://old",
        stripePaymentIntentId: null,
        organisationId: "org_1",
        appointmentId: "appt_1",
        parentId: "parent_1",
        items: [],
      })
      .mockResolvedValueOnce({
        id: "inv_10",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        stripePaymentIntentId: null,
        organisationId: "org_1",
        appointmentId: "appt_1",
        parentId: "parent_1",
        items: [],
      });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_10",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_10",
      client_secret: "cs_10",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_10",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_10",
    });
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });

    const result =
      await FinancePaymentService.createPaymentIntentForInvoice("inv_10");

    expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: "usd",
      }),
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_10",
          providerPaymentIntentId: "pi_10",
          status: "REQUIRES_ACTION",
        }),
      }),
    );
    expect(result).toEqual({
      paymentIntentId: "pi_10",
      clientSecret: "cs_10",
      amount: 100,
      currency: "usd",
    });
  });

  it("returns an existing checkout session without creating a new one", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_7",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: "cs_existing",
      stripeCheckoutUrl: "https://existing",
      organisationId: "org_1",
      items: [],
    });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_7");

    expect(
      (prisma.organization.findUnique as jest.Mock).mock.calls,
    ).toHaveLength(0);
    expect((prisma.invoice.updateMany as jest.Mock).mock.calls).toHaveLength(0);
    expect(prisma.paymentAttempt.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      sessionId: "cs_existing",
      url: "https://existing",
      paymentAttemptId: null,
    });
  });

  it("rejects checkout session creation for in-clinic invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_8",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      stripeCheckoutUrl: null,
      organisationId: "org_1",
      items: [],
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_8"),
    ).rejects.toBeInstanceOf(FinancePaymentError);
  });

  it("records manual settlement for the outstanding balance", async () => {
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_3",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
      })
      .mockResolvedValueOnce({
        id: "inv_3",
        totalAmount: 100,
        currency: "usd",
        status: "PAID",
      });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([{ amount: 40 }])
      .mockResolvedValueOnce([{ amount: 40 }])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_3",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_3",
      amount: 60,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      paidAt: new Date("2026-06-18T10:10:00.000Z"),
    });

    const result = await FinancePaymentService.recordManualPayment("inv_3", {
      settlementChannel: "CASH",
      receivedAt: new Date("2026-06-18T10:10:00.000Z"),
      reference: "receipt-001",
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 60,
          provider: "MANUAL",
          settlementChannel: "CASH",
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
        }),
      }),
    );
    expect(result.balanceAfterPayment).toBe(0);
    expect(result.paidToDate).toBe(100);
  });

  it("rejects payments for cancelled invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      totalAmount: 100,
      currency: "usd",
      status: "CANCELLED",
    });

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_4", {
        provider: "MANUAL",
        amount: 10,
        settlementChannel: "CASH",
        currency: "usd",
      }),
    ).rejects.toBeInstanceOf(FinancePaymentError);
  });

  it("refunds a Stripe-backed invoice payment", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_9",
      totalAmount: 90,
      currency: "usd",
      status: "PAID",
      stripePaymentIntentId: "pi_9",
      metadata: {},
      payments: [],
    });
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: { id: "ch_9" },
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_9",
      status: "succeeded",
      amount: 9000,
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_9",
      amount: 90,
      currency: "usd",
      provider: "STRIPE",
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_9",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_9",
      status: "REFUNDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_9",
      status: "REFUNDED",
      currency: "usd",
      payments: [],
    });

    const result = await FinancePaymentService.refundInvoicePayment(
      "inv_9",
      "requested by owner",
    );

    expect(stripeClient.paymentIntents.retrieve).toHaveBeenCalledWith("pi_9", {
      expand: ["latest_charge"],
    });
    expect(stripeClient.refunds.create).toHaveBeenCalledWith({
      charge: "ch_9",
    });
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: "pay_9",
          provider: "STRIPE",
          providerRefundId: "re_9",
          amount: 90,
        }),
      }),
    );
    expect(result.refund.refundId).toBe("re_9");
    expect(result.invoice.status).toBe("REFUNDED");
  });

  it("lists invoice payments in creation order", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: "pay_1", amount: 20, status: "SUCCEEDED" },
      { id: "pay_2", amount: 30, status: "SUCCEEDED" },
    ]);

    const payments =
      await FinancePaymentService.listPaymentsForInvoice("inv_5");

    expect(payments).toHaveLength(2);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: "inv_5" },
      }),
    );
  });
});
