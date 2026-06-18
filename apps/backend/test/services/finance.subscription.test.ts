import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    subscriptionEntitlement: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    financeProviderLink: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    usageEvent: {
      create: jest.fn(),
    },
    usageSnapshot: {
      create: jest.fn(),
    },
    financeEvent: {
      create: jest.fn(),
    },
    organizationUsageCounter: {
      upsert: jest.fn(),
    },
    organizationBilling: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userOrganization: {
      count: jest.fn(),
    },
  },
}));

describe("FinanceSubscriptionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    process.env.STRIPE_PRICE_BUSINESS_MONTH = "price_month_mock";
    process.env.STRIPE_PRICE_BUSINESS_YEAR = "price_year_mock";
    (prisma.usageEvent.create as jest.Mock).mockResolvedValue({
      id: "usage_evt_default",
      quantity: 0,
      billableQuantity: 0,
      occurredAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValue({
      id: "usage_snapshot_default",
      snapshotType: "snapshot",
      seatsActive: 0,
      seatsBillable: 0,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records seat usage in org billing and usage counters", async () => {
    (prisma.usageEvent.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_evt_1",
      quantity: 4,
      billableQuantity: 4,
      occurredAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_snapshot_1",
      snapshotType: "SEAT_SYNC",
      seatsActive: 4,
      seatsBillable: 4,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.organizationBilling.update as jest.Mock).mockResolvedValueOnce({});

    await FinanceSubscriptionService.recordSeatUsage({
      orgId: "org_1",
      seats: 4,
    });

    expect(prisma.usageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        usageKey: "SEATS_ACTIVE",
        quantity: 4,
        billableQuantity: 4,
        source: "SUBSCRIPTION",
      }),
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
    expect(prisma.usageSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        snapshotType: "SEAT_SYNC",
        seatsActive: 4,
        seatsBillable: 4,
      }),
    });
  });

  it("prepares business checkout context and records seat usage", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });
    (prisma.organizationBilling.upsert as jest.Mock).mockResolvedValueOnce({
      connectAccountId: null,
      stripeCustomerId: null,
    });
    (prisma.organizationBilling.update as jest.Mock).mockResolvedValueOnce({
      connectAccountId: "acct_1",
      stripeCustomerId: null,
    });
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(3);
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.organizationBilling.update as jest.Mock).mockResolvedValueOnce({});

    const context =
      await FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      );

    expect(context).toEqual({
      orgName: "Clinic One",
      connectAccountId: "acct_1",
      stripeCustomerId: null,
      priceId: "price_month_mock",
      seats: 3,
    });
    expect(prisma.organizationBilling.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: { orgId: "org_1" },
      update: {},
      select: {
        connectAccountId: true,
        stripeCustomerId: true,
      },
    });
    expect(prisma.organizationBilling.update).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      data: { connectAccountId: "acct_1" },
      select: {
        connectAccountId: true,
        stripeCustomerId: true,
      },
    });
    expect(prisma.userOrganization.count).toHaveBeenCalledWith({
      where: {
        organizationReference: "org_1",
        active: true,
      },
    });
    expect(prisma.organizationUsageCounter.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        usersActiveCount: 3,
        usersBillableCount: 3,
      },
      update: { usersActiveCount: 3, usersBillableCount: 3 },
    });
  });

  it("records the stripe customer id for business checkout", async () => {
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.organizationBilling.update as jest.Mock).mockResolvedValueOnce({});

    await FinanceSubscriptionService.recordBusinessCheckoutCustomer({
      orgId: "org_1",
      stripeCustomerId: "cus_1",
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: {
        orgId: "org_1",
        provider: "STRIPE",
        externalCustomerId: "cus_1",
        externalSubscriptionId: undefined,
        externalSubscriptionItemId: undefined,
        externalPriceId: undefined,
        externalProductId: undefined,
        metadata: { source: "business_checkout" },
      },
      update: {
        externalCustomerId: "cus_1",
        externalSubscriptionId: undefined,
        externalSubscriptionItemId: undefined,
        externalPriceId: undefined,
        externalProductId: undefined,
        metadata: { source: "business_checkout" },
      },
    });
    expect(prisma.organizationBilling.update).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      data: { stripeCustomerId: "cus_1" },
    });
  });

  it("resolves the stripe customer id for customer portal sessions", async () => {
    (prisma.organizationBilling.upsert as jest.Mock).mockResolvedValueOnce({
      stripeCustomerId: "cus_1",
    });

    await expect(
      FinanceSubscriptionService.resolveBillingCustomerId("org_1"),
    ).resolves.toEqual({
      stripeCustomerId: "cus_1",
    });

    expect(prisma.organizationBilling.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: { orgId: "org_1" },
      update: {},
      select: {
        stripeCustomerId: true,
      },
    });
  });

  it("throws when organisation is missing", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("Organisation not found");
  });

  it("throws when business pricing env vars are missing", async () => {
    delete process.env.STRIPE_PRICE_BUSINESS_MONTH;

    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("Missing STRIPE_PRICE_BUSINESS_* env vars");
  });

  it("throws when there are no active users", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });
    (prisma.organizationBilling.upsert as jest.Mock).mockResolvedValueOnce({
      connectAccountId: "acct_1",
      stripeCustomerId: null,
    });
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(0);

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("No users found. Add at least 1 user to start Business.");
  });

  it("resolves a seat sync plan only when business subscription is active", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        plan: "free",
        stripeSubscriptionItemId: null,
        subscriptionStatus: "none",
        seatQuantity: 0,
      })
      .mockResolvedValueOnce({
        plan: "business",
        stripeSubscriptionItemId: "item_1",
        subscriptionStatus: "active",
        seatQuantity: 2,
      });
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(5);

    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toBeNull();
    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toBeNull();
    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toEqual({
      subscriptionItemId: "item_1",
      oldSeats: 2,
      newSeats: 5,
      prorationBehavior: "create_prorations",
    });
  });

  it("records business checkout completion", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
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
    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
        externalSubscriptionItemId: "item_1",
        externalPriceId: "price_1",
        externalProductId: "prod_1",
      }),
      update: expect.objectContaining({
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "ACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "ACTIVE",
      }),
    });
  });

  it("normalizes stripe subscription checkout completion into finance writes", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted({
      customerId: "cus_1",
      session: {
        livemode: false,
      } as any,
      subscription: {
        id: "sub_1",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: "item_1",
              quantity: 2,
              current_period_start: 1718668800,
              current_period_end: 1721260800,
              price: {
                id: "price_1",
                recurring: { interval: "month" },
                product: "prod_1",
              },
            },
          ],
        },
      } as any,
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
        cancelAtPeriodEnd: false,
        seatQuantity: 2,
        stripeLivemode: false,
      }),
    });
    expect(prisma.financeProviderLink.upsert).toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalled();
  });

  it("records subscription updates and omits absent timestamps", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1", metadata: null },
    ]);
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
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
    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalSubscriptionId: "sub_1",
      }),
      update: expect.objectContaining({
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "ACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "ACTIVE",
      }),
    });
  });

  it("normalizes stripe subscription updates into finance writes", async () => {
    (prisma.organizationBilling.updateMany as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordStripeSubscriptionUpdated({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            quantity: 6,
            current_period_start: 1718668800,
            current_period_end: 1721260800,
          },
        ],
      },
    } as any);

    expect(prisma.organizationBilling.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_1" },
      data: expect.objectContaining({
        subscriptionStatus: "active",
        cancelAtPeriodEnd: false,
        seatQuantity: 6,
        currentPeriodStart: new Date("2024-06-18T00:00:00.000Z"),
        currentPeriodEnd: new Date("2024-07-18T00:00:00.000Z"),
      }),
    });
  });

  it("records subscription lifecycle changes", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.organizationBilling.updateMany as jest.Mock)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_snapshot_2",
      snapshotType: "SUBSCRIPTION_TERMINATED",
      seatsActive: 0,
      seatsBillable: 0,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });

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
    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalSubscriptionId: "sub_1",
      }),
      update: expect.objectContaining({
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "INACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "INACTIVE",
      }),
    });
    expect(prisma.usageSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        snapshotType: "SUBSCRIPTION_TERMINATED",
      }),
    });
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
