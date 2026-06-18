import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationUsageCounter: {
      upsert: jest.fn(),
    },
    organizationBilling: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("FinanceSubscriptionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records seat usage in org billing and usage counters", async () => {
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.organizationBilling.update as jest.Mock).mockResolvedValueOnce({});

    await FinanceSubscriptionService.recordSeatUsage({
      orgId: "org_1",
      seats: 4,
    });

    expect(prisma.organizationUsageCounter.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        usersActiveCount: 4,
        usersBillableCount: 4,
      },
      update: { usersActiveCount: 4, usersBillableCount: 4 },
    });
    expect(prisma.organizationBilling.update).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      data: {
        seatQuantity: 4,
        seatQuantityUpdatedAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    });
  });

  it("records business checkout completion", async () => {
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordBusinessCheckoutCompleted({
      customerId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionItemId: "item_1",
      priceId: "price_1",
      productId: "prod_1",
      billingInterval: "month",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      seatQuantity: 2,
      currentPeriodStart: new Date("2026-06-17T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-17T00:00:00.000Z"),
      livemode: false,
    });

    expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      data: expect.objectContaining({
        plan: "business",
        accessState: "active",
        stripeSubscriptionId: "sub_1",
        stripeSubscriptionItemId: "item_1",
        stripePriceId: "price_1",
        stripeProductId: "prod_1",
        billingInterval: "month",
        subscriptionStatus: "active",
        cancelAtPeriodEnd: true,
        seatQuantity: 2,
        stripeLivemode: false,
        gracePeriodEndsAt: null,
      }),
    });
  });

  it("records subscription updates and omits absent timestamps", async () => {
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordSubscriptionUpdated({
      subscriptionId: "sub_1",
      subscriptionStatus: "past_due",
      cancelAtPeriodEnd: false,
      seatQuantity: 6,
      currentPeriodStart: new Date("2026-06-18T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-18T00:00:00.000Z"),
    });

    expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_1" },
      data: expect.objectContaining({
        subscriptionStatus: "past_due",
        cancelAtPeriodEnd: false,
        seatQuantity: 6,
        currentPeriodStart: new Date("2026-06-18T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-07-18T00:00:00.000Z"),
      }),
    });
  });

  it("records subscription lifecycle changes", async () => {
    (prisma.organizationBilling.updateMany as jest.Mock)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await FinanceSubscriptionService.recordSubscriptionDeleted("sub_1");
    await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
      subscriptionId: "sub_1",
      invoiceId: "inv_1",
    });
    await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
      subscriptionId: "sub_1",
      invoiceId: "inv_2",
    });

    expect(prisma.organizationBilling.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_1" },
        data: expect.objectContaining({
          plan: "free",
          accessState: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionItemId: null,
          stripePriceId: null,
        }),
      }),
    );
    expect(prisma.organizationBilling.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_1" },
        data: expect.objectContaining({
          lastInvoiceId: "inv_1",
          lastPaymentStatus: "paid",
          accessState: "active",
          gracePeriodEndsAt: null,
        }),
      }),
    );
    expect(prisma.organizationBilling.updateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_1" },
        data: expect.objectContaining({
          lastInvoiceId: "inv_2",
          lastPaymentStatus: "failed",
          accessState: "past_due",
        }),
      }),
    );
  });
});
