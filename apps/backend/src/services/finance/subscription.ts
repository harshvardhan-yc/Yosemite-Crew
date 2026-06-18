import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";
import { FinanceEventService } from "./events";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toSubscriptionStatus = (
  value?: string | null,
): SubscriptionStatus | undefined => {
  if (!value) return undefined;
  if (value === "none") return "none";
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due") return "past_due";
  if (value === "unpaid") return "unpaid";
  if (value === "canceled") return "canceled";
  if (value === "incomplete") return "incomplete";
  if (value === "incomplete_expired") return "incomplete_expired";
  if (value === "paused") return "paused";
  return undefined;
};

const toBillingInterval = (
  value?: string | null,
): BillingInterval | undefined => {
  if (value === "month" || value === "year") return value;
  return undefined;
};

type SeatUsageInput = {
  orgId: string;
  seats: number;
};

type UsageEventInput = {
  orgId: string;
  usageKey: string;
  quantity: number;
  billableQuantity?: number;
  source: string;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

type UsageSnapshotInput = {
  orgId: string;
  snapshotType?: string;
  seatsActive?: number;
  seatsBillable?: number;
  appointmentsUsed?: number;
  toolsUsed?: number;
  metadata?: Record<string, unknown>;
  snapshotAt?: Date;
};

type SubscriptionEntitlementInput = {
  orgId: string;
  code: string;
  name?: string | null;
  value?: Record<string, unknown> | null;
  source: string;
  status?: string | null;
  grantedAt?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
};

type SubscriptionProviderLinkInput = {
  orgId: string;
  provider: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalSubscriptionItemId?: string | null;
  externalPriceId?: string | null;
  externalProductId?: string | null;
  metadata?: Record<string, unknown> | null;
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

type BillingCustomerLookup = {
  stripeCustomerId: string | null;
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

type StripeSubscriptionUpdatedInput = Stripe.Subscription;

type StripeSubscriptionCheckoutCompletedInput = {
  customerId: string;
  session: Stripe.Checkout.Session;
  subscription: Stripe.Subscription;
};

type SubscriptionLifecycleInput = {
  subscriptionId: string;
  invoiceId?: string | null;
};

const toPositiveInteger = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const toIsoString = (value?: Date | null) =>
  value ? value.toISOString() : null;

const readJsonRecord = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const FinanceSubscriptionService = {
  async recordUsageEvent(input: UsageEventInput) {
    const event = await prisma.usageEvent.create({
      data: {
        orgId: input.orgId,
        usageKey: input.usageKey,
        quantity: toPositiveInteger(input.quantity),
        billableQuantity: toPositiveInteger(
          input.billableQuantity ?? input.quantity,
        ),
        source: input.source,
        referenceType: input.referenceType ?? undefined,
        referenceId: input.referenceId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: input.orgId,
      eventType: "USAGE_EVENT_RECORDED",
      entityType: "USAGE",
      entityId: event.id,
      payload: {
        usageKey: input.usageKey,
        quantity: event.quantity,
        billableQuantity: event.billableQuantity,
        source: input.source,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      },
      occurredAt: event.occurredAt,
    });

    return event;
  },

  async captureUsageSnapshot(input: UsageSnapshotInput) {
    const snapshot = await prisma.usageSnapshot.create({
      data: {
        orgId: input.orgId,
        snapshotType: input.snapshotType ?? "snapshot",
        seatsActive: toPositiveInteger(input.seatsActive ?? 0),
        seatsBillable: toPositiveInteger(input.seatsBillable ?? 0),
        appointmentsUsed: toPositiveInteger(input.appointmentsUsed ?? 0),
        toolsUsed: toPositiveInteger(input.toolsUsed ?? 0),
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
        snapshotAt: input.snapshotAt ?? new Date(),
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: input.orgId,
      eventType: "USAGE_SNAPSHOT_CAPTURED",
      entityType: "USAGE",
      entityId: snapshot.id,
      payload: {
        snapshotType: snapshot.snapshotType,
        seatsActive: snapshot.seatsActive,
        seatsBillable: snapshot.seatsBillable,
        appointmentsUsed: snapshot.appointmentsUsed,
        toolsUsed: snapshot.toolsUsed,
      },
      occurredAt: snapshot.snapshotAt,
    });

    return snapshot;
  },

  async upsertSubscriptionEntitlement(input: SubscriptionEntitlementInput) {
    return prisma.subscriptionEntitlement.upsert({
      where: {
        orgId_code: {
          orgId: input.orgId,
          code: input.code,
        },
      },
      create: {
        orgId: input.orgId,
        code: input.code,
        name: input.name ?? undefined,
        value: input.value as unknown as Prisma.InputJsonValue | undefined,
        source: input.source,
        status: input.status ?? "ACTIVE",
        grantedAt: input.grantedAt ?? new Date(),
        expiresAt: input.expiresAt ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
      update: {
        name: input.name ?? undefined,
        value: input.value as unknown as Prisma.InputJsonValue | undefined,
        source: input.source,
        status: input.status ?? "ACTIVE",
        grantedAt: input.grantedAt ?? undefined,
        expiresAt: input.expiresAt ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  },

  async upsertSubscriptionProviderLink(input: SubscriptionProviderLinkInput) {
    return prisma.financeProviderLink.upsert({
      where: {
        orgId_provider: {
          orgId: input.orgId,
          provider: input.provider,
        },
      },
      create: {
        orgId: input.orgId,
        provider: input.provider,
        externalCustomerId: input.externalCustomerId ?? undefined,
        externalSubscriptionId: input.externalSubscriptionId ?? undefined,
        externalSubscriptionItemId:
          input.externalSubscriptionItemId ?? undefined,
        externalPriceId: input.externalPriceId ?? undefined,
        externalProductId: input.externalProductId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
      update: {
        externalCustomerId: input.externalCustomerId ?? undefined,
        externalSubscriptionId: input.externalSubscriptionId ?? undefined,
        externalSubscriptionItemId:
          input.externalSubscriptionItemId ?? undefined,
        externalPriceId: input.externalPriceId ?? undefined,
        externalProductId: input.externalProductId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  },

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
    await this.upsertSubscriptionProviderLink({
      orgId: input.orgId,
      provider: "STRIPE",
      externalCustomerId: input.stripeCustomerId,
      metadata: {
        source: "business_checkout",
      },
    });

    await prisma.organizationBilling.update({
      where: { orgId: input.orgId },
      data: { stripeCustomerId: input.stripeCustomerId },
    });
  },

  async resolveBillingCustomerId(
    orgId: string,
  ): Promise<BillingCustomerLookup> {
    const providerLink = await prisma.financeProviderLink.findUnique({
      where: {
        orgId_provider: {
          orgId,
          provider: "STRIPE",
        },
      },
      select: {
        externalCustomerId: true,
      },
    });

    if (providerLink?.externalCustomerId) {
      return {
        stripeCustomerId: providerLink.externalCustomerId,
      };
    }

    const billing = await prisma.organizationBilling.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
      select: {
        stripeCustomerId: true,
      },
    });

    return {
      stripeCustomerId: billing.stripeCustomerId ?? null,
    };
  },

  async resolveSubscriptionSeatSyncPlan(
    orgId: string,
  ): Promise<SeatSyncPlan | null> {
    const providerRow = await prisma.financeProviderLink.findUnique({
      where: {
        orgId_provider: {
          orgId,
          provider: "STRIPE",
        },
      },
      select: {
        externalSubscriptionItemId: true,
        metadata: true,
      },
    });

    const providerState = readJsonRecord(providerRow?.metadata);
    const providerSubscriptionStatus = readString(
      providerState.subscriptionStatus,
    );
    const providerSeatQuantity = readNumber(providerState.seatQuantity);

    if (providerRow?.externalSubscriptionItemId) {
      if (
        !["active", "trialing", "past_due"].includes(
          providerSubscriptionStatus ?? "",
        )
      ) {
        return null;
      }

      const newSeats = await prisma.userOrganization.count({
        where: {
          organizationReference: orgId,
          active: true,
        },
      });
      const oldSeats = providerSeatQuantity ?? 0;
      if (newSeats === oldSeats) return null;

      return {
        subscriptionItemId: providerRow.externalSubscriptionItemId,
        oldSeats,
        newSeats,
        prorationBehavior: newSeats > oldSeats ? "create_prorations" : "none",
      };
    }

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
    await this.recordUsageEvent({
      orgId,
      usageKey: "SEATS_ACTIVE",
      quantity: seats,
      billableQuantity: seats,
      source: "SUBSCRIPTION",
      referenceType: "organization_billing",
      referenceId: orgId,
      metadata: {
        scope: "business_checkout",
      },
    });

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

    await this.captureUsageSnapshot({
      orgId,
      snapshotType: "SEAT_SYNC",
      seatsActive: seats,
      seatsBillable: seats,
      metadata: {
        usageKey: "SEATS_ACTIVE",
      },
    });
  },

  async recordBusinessCheckoutCompleted(input: BusinessCheckoutCompletedInput) {
    const billingRows =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalCustomerId: input.customerId,
        },
        select: { orgId: true },
      })) ?? [];
    const rows: Array<{ orgId: string }> =
      billingRows.length > 0
        ? billingRows
        : ((await prisma.organizationBilling.findMany({
            where: { stripeCustomerId: input.customerId },
            select: { orgId: true },
          })) ?? []);

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

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId,
            provider: "STRIPE",
            externalCustomerId: input.customerId,
            externalSubscriptionId: input.subscriptionId,
            externalSubscriptionItemId: input.subscriptionItemId,
            externalPriceId: input.priceId,
            externalProductId: input.productId ?? null,
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
            },
          }),
          this.upsertSubscriptionEntitlement({
            orgId: row.orgId,
            code: "BUSINESS_PLAN",
            name: "Business subscription",
            value: {
              plan: "business",
              billingInterval: input.billingInterval ?? null,
              seatQuantity: input.seatQuantity ?? 0,
              priceId: input.priceId,
              productId: input.productId ?? null,
            },
            source: "STRIPE",
            status: "ACTIVE",
            grantedAt: new Date(),
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              currentPeriodStart: toIsoString(input.currentPeriodStart),
              currentPeriodEnd: toIsoString(input.currentPeriodEnd),
              seatQuantity: input.seatQuantity ?? 0,
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.customerId,
      eventType: "SUBSCRIPTION_STARTED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        customerId: input.customerId,
        subscriptionItemId: input.subscriptionItemId,
        billingInterval: input.billingInterval ?? null,
        subscriptionStatus: input.subscriptionStatus ?? "none",
        seatQuantity: input.seatQuantity ?? 0,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
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

    const billingRows: Array<{
      orgId: string;
      metadata?: Prisma.JsonValue | null;
    }> =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true, metadata: true },
      })) ?? [];
    const rows: Array<{ orgId: string }> =
      billingRows.length > 0
        ? billingRows
        : ((await prisma.organizationBilling.findMany({
            where: { stripeSubscriptionId: input.subscriptionId },
            select: { orgId: true },
          })) ?? []);

    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: input.subscriptionId },
      data,
    });

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId,
            provider: "STRIPE",
            externalSubscriptionId: input.subscriptionId,
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              seatQuantity: input.seatQuantity ?? 0,
              currentPeriodStart: toIsoString(input.currentPeriodStart),
              currentPeriodEnd: toIsoString(input.currentPeriodEnd),
            },
          }),
          prisma.subscriptionEntitlement.upsert({
            where: {
              orgId_code: {
                orgId: row.orgId,
                code: "BUSINESS_PLAN",
              },
            },
            create: {
              orgId: row.orgId,
              code: "BUSINESS_PLAN",
              name: "Business subscription",
              source: "STRIPE",
              status:
                input.subscriptionStatus === "canceled" ? "INACTIVE" : "ACTIVE",
              grantedAt: new Date(),
              metadata: {
                subscriptionStatus: input.subscriptionStatus ?? "none",
                cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              },
            },
            update: {
              source: "STRIPE",
              status:
                input.subscriptionStatus === "canceled" ? "INACTIVE" : "ACTIVE",
              metadata: {
                subscriptionStatus: input.subscriptionStatus ?? "none",
                cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              },
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_UPDATED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        subscriptionStatus: input.subscriptionStatus ?? "none",
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        canceledAt: input.canceledAt ?? null,
        seatQuantity: input.seatQuantity ?? 0,
        currentPeriodStart: input.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  },

  async recordStripeSubscriptionUpdated(
    subscription: StripeSubscriptionUpdatedInput,
  ) {
    const item = subscription.items.data[0];

    await this.recordSubscriptionUpdated({
      subscriptionId: subscription.id,
      subscriptionStatus: toSubscriptionStatus(subscription.status) ?? "none",
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      seatQuantity: item?.quantity ?? 0,
      currentPeriodStart:
        item?.current_period_start !== undefined
          ? new Date(item.current_period_start * 1000)
          : null,
      currentPeriodEnd:
        item?.current_period_end !== undefined
          ? new Date(item.current_period_end * 1000)
          : null,
    });
  },

  async recordStripeSubscriptionCheckoutCompleted(
    input: StripeSubscriptionCheckoutCompletedInput,
  ) {
    const item = input.subscription.items.data[0];
    const price = item?.price;
    if (!item || !price) return;

    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    await this.recordBusinessCheckoutCompleted({
      customerId: input.customerId,
      subscriptionId: input.subscription.id,
      subscriptionItemId: item.id,
      priceId: price.id,
      productId: productId ?? null,
      billingInterval: toBillingInterval(price.recurring?.interval) ?? null,
      subscriptionStatus:
        toSubscriptionStatus(input.subscription.status) ?? "none",
      cancelAtPeriodEnd: input.subscription.cancel_at_period_end ?? false,
      seatQuantity: item.quantity ?? 0,
      currentPeriodStart:
        item.current_period_start !== undefined
          ? new Date(item.current_period_start * 1000)
          : null,
      currentPeriodEnd:
        item.current_period_end !== undefined
          ? new Date(item.current_period_end * 1000)
          : null,
      livemode: input.session.livemode ?? false,
    });
  },

  async recordSubscriptionDeleted(subscriptionId: string) {
    const billingRows = await prisma.financeProviderLink.findMany({
      where: {
        provider: "STRIPE",
        externalSubscriptionId: subscriptionId,
      },
      select: { orgId: true },
    });
    const rows =
      billingRows.length > 0
        ? billingRows
        : await prisma.organizationBilling.findMany({
            where: { stripeSubscriptionId: subscriptionId },
            select: { orgId: true },
          });

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

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId,
            provider: "STRIPE",
            externalSubscriptionId: subscriptionId,
            metadata: {
              status: "canceled",
              canceledAt: new Date().toISOString(),
            },
          }),
          prisma.subscriptionEntitlement.upsert({
            where: {
              orgId_code: {
                orgId: row.orgId,
                code: "BUSINESS_PLAN",
              },
            },
            create: {
              orgId: row.orgId,
              code: "BUSINESS_PLAN",
              name: "Business subscription",
              source: "STRIPE",
              status: "INACTIVE",
              grantedAt: new Date(),
              expiresAt: new Date(),
              metadata: {
                status: "canceled",
              },
            },
            update: {
              source: "STRIPE",
              status: "INACTIVE",
              expiresAt: new Date(),
              metadata: {
                status: "canceled",
              },
            },
          }),
          this.captureUsageSnapshot({
            orgId: row.orgId,
            snapshotType: "SUBSCRIPTION_TERMINATED",
            metadata: {
              subscriptionId,
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? subscriptionId,
      eventType: "SUBSCRIPTION_DELETED",
      entityType: "SUBSCRIPTION",
      entityId: subscriptionId,
      payload: {
        status: "canceled",
      },
    });
  },

  async recordSubscriptionInvoicePaid(input: SubscriptionLifecycleInput) {
    const rows: Array<{ orgId: string }> =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true },
      })) ?? [];

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

    await Promise.all(
      rows.map((row) =>
        this.upsertSubscriptionProviderLink({
          orgId: row.orgId,
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
          metadata: {
            lastInvoiceId: input.invoiceId ?? null,
            lastPaymentStatus: "paid",
            lastPaymentAt: new Date().toISOString(),
          },
        }),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_INVOICE_PAID",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        invoiceId: input.invoiceId ?? null,
        paymentStatus: "paid",
      },
    });
  },

  async recordSubscriptionInvoiceFailed(input: SubscriptionLifecycleInput) {
    const rows: Array<{ orgId: string }> =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true },
      })) ?? [];

    await prisma.organizationBilling.updateMany({
      where: { stripeSubscriptionId: input.subscriptionId },
      data: {
        lastInvoiceId: input.invoiceId ?? undefined,
        lastPaymentStatus: "failed",
        accessState: "past_due",
        gracePeriodEndsAt: addDays(new Date(), 7),
      },
    });

    await Promise.all(
      rows.map((row) =>
        this.upsertSubscriptionProviderLink({
          orgId: row.orgId,
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
          metadata: {
            lastInvoiceId: input.invoiceId ?? null,
            lastPaymentStatus: "failed",
            lastPaymentAt: new Date().toISOString(),
          },
        }),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_INVOICE_FAILED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        invoiceId: input.invoiceId ?? null,
        paymentStatus: "failed",
      },
    });
  },
};
