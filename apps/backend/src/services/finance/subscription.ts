import { prisma } from "src/config/prisma";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

type SeatUsageInput = {
  orgId: string;
  seats: number;
};

type BusinessCheckoutInterval = "month" | "year";

type BusinessCheckoutContext = {
  orgName: string;
  connectAccountId?: string | null;
  stripeCustomerId?: string | null;
  priceId: string;
  seats: number;
};

type CheckoutCustomerInput = {
  orgId: string;
  stripeCustomerId: string;
};

type SeatSyncPlan = {
  subscriptionItemId: string;
  oldSeats: number;
  newSeats: number;
  prorationBehavior: "create_prorations" | "none";
};

type BusinessCheckoutCompletedInput = {
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  priceId: string;
  productId?: string | null;
  billingInterval?: BillingInterval | null;
  subscriptionStatus?: SubscriptionStatus | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  livemode?: boolean | null;
  seatQuantity?: number | null;
};

type SubscriptionUpdatedInput = {
  subscriptionId: string;
  subscriptionStatus?: SubscriptionStatus | null;
  cancelAtPeriodEnd?: boolean | null;
  canceledAt?: Date | null;
  seatQuantity?: number | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
};

type SubscriptionLifecycleInput = {
  subscriptionId: string;
  invoiceId?: string | null;
};

export const FinanceSubscriptionService = {
  async prepareBusinessCheckoutSession(
    orgId: string,
    interval: BusinessCheckoutInterval,
  ): Promise<BusinessCheckoutContext> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, stripeAccountId: true },
    });
    if (!org) throw new Error("Organisation not found");

    const priceId =
      interval === "month"
        ? process.env.STRIPE_PRICE_BUSINESS_MONTH
        : process.env.STRIPE_PRICE_BUSINESS_YEAR;
    if (!priceId) throw new Error("Missing STRIPE_PRICE_BUSINESS_* env vars");

    let billingRow = await prisma.organizationBilling.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
      select: {
        connectAccountId: true,
        stripeCustomerId: true,
      },
    });

    if (!billingRow.connectAccountId && org.stripeAccountId) {
      billingRow = await prisma.organizationBilling.update({
        where: { orgId },
        data: { connectAccountId: org.stripeAccountId },
        select: {
          connectAccountId: true,
          stripeCustomerId: true,
        },
      });
    }

    const seats = await prisma.userOrganization.count({
      where: {
        organizationReference: orgId,
        active: true,
      },
    });
    if (seats < 1) {
      throw new Error("No users found. Add at least 1 user to start Business.");
    }

    await this.recordSeatUsage({ orgId, seats });

    return {
      orgName: org.name,
      connectAccountId: billingRow.connectAccountId ?? org.stripeAccountId,
      stripeCustomerId: billingRow.stripeCustomerId ?? null,
      priceId,
      seats,
    };
  },

  async recordBusinessCheckoutCustomer(
    input: CheckoutCustomerInput,
  ): Promise<void> {
    await prisma.organizationBilling.update({
      where: { orgId: input.orgId },
      data: { stripeCustomerId: input.stripeCustomerId },
    });
  },

  async resolveSubscriptionSeatSyncPlan(
    orgId: string,
  ): Promise<SeatSyncPlan | null> {
    const billingRow = await prisma.organizationBilling.findUnique({
      where: { orgId },
      select: {
        plan: true,
        stripeSubscriptionItemId: true,
        subscriptionStatus: true,
        seatQuantity: true,
      },
    });

    if (!billingRow || billingRow.plan !== "business") return null;

    const subscriptionItemId = billingRow.stripeSubscriptionItemId;
    if (!subscriptionItemId) return null;

    const subscriptionStatus = billingRow.subscriptionStatus ?? "none";
    if (!["active", "trialing", "past_due"].includes(subscriptionStatus)) {
      return null;
    }

    const newSeats = await prisma.userOrganization.count({
      where: {
        organizationReference: orgId,
        active: true,
      },
    });
    const oldSeats = billingRow.seatQuantity ?? 0;
    if (newSeats === oldSeats) return null;

    return {
      subscriptionItemId,
      oldSeats,
      newSeats,
      prorationBehavior: newSeats > oldSeats ? "create_prorations" : "none",
    };
  },

  async recordSeatUsage({ orgId, seats }: SeatUsageInput) {
    await prisma.organizationUsageCounter.upsert({
      where: { orgId },
      create: {
        orgId,
        usersActiveCount: seats,
        usersBillableCount: seats,
      },
      update: { usersActiveCount: seats, usersBillableCount: seats },
    });

    await prisma.organizationBilling.update({
      where: { orgId },
      data: {
        seatQuantity: seats,
        seatQuantityUpdatedAt: new Date(),
      },
    });
  },

  async recordBusinessCheckoutCompleted(input: BusinessCheckoutCompletedInput) {
    await prisma.organizationBilling.updateMany({
      where: { stripeCustomerId: input.customerId },
      data: {
        plan: "business",
        accessState: "active",
        upgradedAt: new Date(),
        stripeSubscriptionId: input.subscriptionId,
        stripeSubscriptionItemId: input.subscriptionItemId,
        stripePriceId: input.priceId,
        stripeProductId: input.productId ?? null,
        billingInterval: input.billingInterval ?? null,
        joinedAt: new Date(),
        subscriptionStatus: input.subscriptionStatus ?? "none",
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        seatQuantity: input.seatQuantity ?? 0,
        seatQuantityUpdatedAt: new Date(),
        currentPeriodStart: input.currentPeriodStart ?? undefined,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
        stripeLivemode: input.livemode ?? false,
        gracePeriodEndsAt: null,
      },
    });
  },

  async recordSubscriptionUpdated(input: SubscriptionUpdatedInput) {
    const data: Record<string, unknown> = {
      subscriptionStatus: input.subscriptionStatus ?? "none",
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      seatQuantity: input.seatQuantity ?? 0,
    };

    if (input.canceledAt !== undefined) {
      data.canceledAt = input.canceledAt;
    }
    if (input.currentPeriodStart !== undefined) {
      data.currentPeriodStart = input.currentPeriodStart;
    }
    if (input.currentPeriodEnd !== undefined) {
      data.currentPeriodEnd = input.currentPeriodEnd;
    }

    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: input.subscriptionId },
      data,
    });
  },

  async recordSubscriptionDeleted(subscriptionId: string) {
    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        plan: "free",
        accessState: "free",
        downgradedAt: new Date(),
        subscriptionStatus: "canceled",
        billingInterval: null,
        stripeSubscriptionItemId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        gracePeriodEndsAt: null,
      },
    });
  },

  async recordSubscriptionInvoicePaid(input: SubscriptionLifecycleInput) {
    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: input.subscriptionId },
      data: {
        lastInvoiceId: input.invoiceId ?? undefined,
        lastPaymentStatus: "paid",
        lastPaymentAt: new Date(),
        accessState: "active",
        gracePeriodEndsAt: null,
      },
    });
  },

  async recordSubscriptionInvoiceFailed(input: SubscriptionLifecycleInput) {
    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: input.subscriptionId },
      data: {
        lastInvoiceId: input.invoiceId ?? undefined,
        lastPaymentStatus: "failed",
        accessState: "past_due",
        gracePeriodEndsAt: addDays(new Date(), 7),
      },
    });
  },
};
