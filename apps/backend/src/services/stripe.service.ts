// src/services/stripe.service.ts
import Stripe from "stripe";
import logger from "../utils/logger";

import { InvoiceService } from "./invoice.service";
import { FinancePaymentService } from "./finance/payment";
import { FinanceSubscriptionService } from "./finance/subscription";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";

import { prisma } from "src/config/prisma";
import { getOrgBillingCurrency } from "src/utils/billing";
import { Prisma, BillingInterval, SubscriptionStatus } from "@prisma/client";

let stripeClient: Stripe | null = null;

const extractAppointmentTypeId = (
  value: Prisma.JsonValue | null,
): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>).id;
  return typeof candidate === "string" ? candidate : undefined;
};

const extractCompanionRefs = (
  value: Prisma.JsonValue,
): { patientId?: string; parentId?: string } => {
  if (!value || typeof value !== "object") return {};
  const companion = value as Record<string, unknown>;
  const patientId = typeof companion.id === "string" ? companion.id : undefined;
  const parent = companion.parent as Record<string, unknown> | undefined;
  const parentId =
    parent && typeof parent.id === "string" ? parent.id : undefined;
  return { patientId, parentId };
};

const extractAppointmentPatientRefs = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) =>
  extractCompanionRefs(appointment.patient ?? appointment.companion ?? null);

const toBillingInterval = (
  value?: string | null,
): BillingInterval | undefined => {
  if (value === "month" || value === "year") return value;
  return undefined;
};

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

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  stripeClient = new Stripe(apiKey, { apiVersion: "2026-01-28.clover" });
  return stripeClient;
};

function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

// --- Billing helpers ---
type BillingDoc = {
  stripeCustomerId?: string | null;
};

async function ensureBillingDocs(
  orgId: string,
): Promise<{ billing: BillingDoc }> {
  const billing = await prisma.organizationBilling.upsert({
    where: { orgId },
    create: { orgId },
    update: {},
  });

  return {
    billing: billing as BillingDoc,
  };
}

async function computeBillableSeats(orgId: string): Promise<number> {
  // Every active user in this org is billable
  return prisma.userOrganization.count({
    where: {
      organizationReference: orgId,
      active: true,
    },
  });
}

export const StripeService = {
  // ----------------------------
  // CONNECT (existing + improved)
  // ----------------------------
  async createOrGetConnectedAccount(organisationId: string) {
    const stripe = getStripeClient();

    const org = await prisma.organization.findUnique({
      where: { id: organisationId },
    });
    if (!org) throw new Error("Organisation not found");

    if (org.stripeAccountId) return { accountId: org.stripeAccountId };

    const account = await stripe.accounts.create({});

    await prisma.organization.update({
      where: { id: organisationId },
      data: { stripeAccountId: account.id },
    });

    await prisma.organizationBilling.upsert({
      where: { orgId: organisationId },
      create: { orgId: organisationId, connectAccountId: account.id },
      update: { connectAccountId: account.id },
    });

    return { accountId: account.id };
  },

  async getAccountStatus(organisationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { id: true },
    });
    if (!org) {
      throw new Error("Organistaion not found");
    }

    const [orgBilling, orgUsage] = await Promise.all([
      prisma.organizationBilling.findUnique({
        where: { orgId: org.id },
      }),
      prisma.organizationUsageCounter.findUnique({
        where: { orgId: org.id },
      }),
    ]);

    return {
      orgBilling: orgBilling,
      orgUsage: orgUsage,
    };
  },

  async createOnboardingLink(organisationId: string) {
    const stripe = getStripeClient();
    const orgBilling = await prisma.organizationBilling.findUnique({
      where: { orgId: organisationId },
    });

    if (!orgBilling?.connectAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const accountSession = await stripe.accountSessions.create({
      account: orgBilling.connectAccountId,
      components: {
        account_onboarding: { enabled: true },
        tax_settings: {
          enabled: true,
          features: {},
        },
        tax_registrations: {
          enabled: true,
        },
      },
    });

    return { client_secret: accountSession.client_secret };
  },

  // ----------------------------
  // SAAS SUBSCRIPTION (NEW)
  // ----------------------------

  async createBusinessCheckoutSession(
    orgId: string,
    interval: "month" | "year",
  ) {
    const stripe = getStripeClient();
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
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
    });

    if (!billingRow.connectAccountId && org.stripeAccountId) {
      billingRow = await prisma.organizationBilling.update({
        where: { orgId },
        data: { connectAccountId: org.stripeAccountId },
      });
    }

    const seats = await computeBillableSeats(orgId);
    if (seats < 1)
      throw new Error("No users found. Add at least 1 user to start Business.");

    await FinanceSubscriptionService.recordSeatUsage({ orgId, seats });

    if (!billingRow.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billingRow.connectAccountId ?? ""),
        },
      });

      billingRow = await prisma.organizationBilling.update({
        where: { orgId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const successUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;
    const cancelUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: billingRow.stripeCustomerId ?? undefined,
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billingRow.connectAccountId ?? ""),
        },
      },
      tax_id_collection: {
        enabled: true,
      },
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: "auto",
      metadata: {
        orgId: String(orgId),
        interval,
        seats: String(seats),
      },
      customer_update: {
        name: "auto",
        address: "auto",
      },
    });

    return { url: session.url };
  },

  async createCustomerPortalSession(orgId: string) {
    const stripe = getStripeClient();
    const { billing } = await ensureBillingDocs(orgId);

    if (!billing.stripeCustomerId) {
      throw new Error("No billing customer found. Upgrade to Business first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${process.env.APP_URL}/organization`,
    });

    return { url: session.url };
  },

  async syncSubscriptionSeats(orgId: string) {
    const stripe = getStripeClient();
    const billingRow = await prisma.organizationBilling.findUnique({
      where: { orgId },
    });

    if (!billingRow) return { updated: false, reason: "not_business" };
    if (billingRow.plan !== "business")
      return { updated: false, reason: "not_business" };
    const subscriptionItemId = billingRow.stripeSubscriptionItemId;
    if (!subscriptionItemId)
      return { updated: false, reason: "missing_item_id" };

    const subscriptionStatus = billingRow.subscriptionStatus ?? "none";
    if (!["active", "trialing", "past_due"].includes(subscriptionStatus)) {
      return { updated: false, reason: "subscription_not_syncable" };
    }

    const newSeats = await computeBillableSeats(orgId);
    const oldSeats = billingRow.seatQuantity ?? 0;
    if (newSeats === oldSeats) return { updated: false, reason: "no_change" };

    const prorationBehavior =
      newSeats > oldSeats ? "create_prorations" : "none";

    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: newSeats,
      proration_behavior: prorationBehavior,
    });

    await FinanceSubscriptionService.recordSeatUsage({
      orgId,
      seats: newSeats,
    });

    return { updated: true, oldSeats, newSeats, prorationBehavior };
  },

  // ----------------------------
  // EXISTING PAYMENT INTENTS (keep)
  // ----------------------------

  async createPaymentIntentForAppointment(appointmentId: string) {
    const stripe = getStripeClient();
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        organisationId: true,
        appointmentType: true,
        patient: true,
      },
    });
    if (!appointment) throw new Error("Appointment not found");

    if (!["REQUESTED", "UPCOMING"].includes(appointment.status)) {
      throw new Error("Appointment does not allow payment");
    }

    const serviceId = extractAppointmentTypeId(appointment.appointmentType);
    if (!serviceId) throw new Error("Service not found");

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new Error("Service not found");

    const organisation = await prisma.organization.findUnique({
      where: { id: appointment.organisationId },
      select: { stripeAccountId: true },
    });
    if (!organisation?.stripeAccountId)
      throw new Error("Organisation has no Stripe account");

    const amount = toStripeAmount(service.cost);
    const currency = await getOrgBillingCurrency(appointment.organisationId);

    const { parentId, patientId } = extractAppointmentPatientRefs(appointment);
    const companionId = patientId ?? "";

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        type: "APPOINTMENT_BOOKING",
        appointmentId,
        organisationId: appointment.organisationId,
        parentId: parentId ?? "",
        patientId: companionId,
        companionId,
      },
      transfer_data: { destination: organisation.stripeAccountId },
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: service.cost,
      currency,
    };
  },

  async createPaymentIntentForInvoice(invoiceId: string) {
    return FinancePaymentService.createPaymentIntentForInvoice(invoiceId);
  },

  async createCheckoutSessionForInvoice(invoiceId: string) {
    return FinancePaymentService.createCheckoutSessionForInvoice(invoiceId);
  },

  async retrievePaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();
    return stripe.paymentIntents.retrieve(paymentIntentId);
  },

  async retrieveCheckoutSession(sessionId: string) {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    return {
      status: session.payment_status,
      total: session.amount_total ? session.amount_total / 100 : 0,
    };
  },

  async refundPaymentIntent(paymentIntentId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!invoice) throw new Error("Invoice not found");

    const result = await FinancePaymentService.refundInvoicePayment(invoice.id);
    await InvoiceService.markRefunded(invoice.id);

    return {
      refundId: result.refund.refundId,
      status: result.refund.status,
      amountRefunded: result.refund.amountRefunded,
    };
  },

  // ----------------------------
  // WEBHOOK VERIFICATION (existing)
  // ----------------------------
  verifyWebhook(body: Buffer, signature: string | string[] | undefined) {
    const stripe = getStripeClient();
    if (!signature) throw new Error("Missing Stripe signature header");
    if (Array.isArray(signature))
      throw new Error("Invalid Stripe signature header format");

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");

    return stripe.webhooks.constructEvent(body, signature, secret);
  },

  // ----------------------------
  // WEBHOOK HANDLER (UPGRADED)
  // ----------------------------
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);

    switch (event.type) {
      // marketplace flows (existing)
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await this._handlePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await this._handleRefund(event.data.object);
        break;

      // connect readiness
      case "account.updated":
        await this._handleAccountUpdated(event.data.object);
        break;

      // subscription lifecycle
      case "checkout.session.completed":
        await this._handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await this._handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await this._handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.paid":
        await this._handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await this._handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  },

  // ----------------------------
  // WEBHOOK: CONNECT
  // ----------------------------
  async _handleAccountUpdated(account: Stripe.Account) {
    const canAccept =
      account.charges_enabled === true && account.payouts_enabled === true;

    await prisma.organizationBilling.updateMany({
      where: { connectAccountId: account.id },
      data: {
        currency: account.default_currency ?? undefined,
        connectChargesEnabled: account.charges_enabled ?? false,
        connectPayoutsEnabled: account.payouts_enabled ?? false,
        canAcceptPayments: canAccept,
        connectDisabledReason:
          account.requirements?.disabled_reason ?? undefined,
        connectRequirements: {
          currentlyDue: account.requirements?.currently_due ?? [],
          eventuallyDue: account.requirements?.eventually_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          pendingVerification: account.requirements?.pending_verification ?? [],
          errors: account.requirements?.errors ?? [],
        } as unknown as Prisma.InputJsonValue,
      },
    });
  },

  // ----------------------------
  // WEBHOOK: SUBSCRIPTIONS
  // ----------------------------
  async _handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === "subscription") {
      return this._handleSubscriptionCheckout(session);
    } else if (session.mode === "payment") {
      return this._handleInvoiceCheckout(session);
    }
  },

  async _handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];

    await FinanceSubscriptionService.recordSubscriptionUpdated({
      subscriptionId: subscription.id,
      subscriptionStatus: toSubscriptionStatus(subscription.status) ?? "none",
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      seatQuantity: item?.quantity ?? 0,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
    });
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await FinanceSubscriptionService.recordSubscriptionDeleted(subscription.id);
  },

  async _handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
      subscriptionId,
      invoiceId: invoice.id ?? null,
    });
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
      subscriptionId,
      invoiceId: invoice.id ?? null,
    });
  },

  // ----------------------------
  // EXISTING HANDLERS (keep)
  // ----------------------------
  async _handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const type = pi.metadata?.type;
    if (!type) {
      logger.error("payment_intent.succeeded missing metadata.type");
      return;
    }
    if (type === "INVOICE_PAYMENT") return this._handleInvoicePayment(pi);
    if (type === "APPOINTMENT_BOOKING")
      return this._handleAppointmentBookingPayment(pi);
    logger.error("Unknown payment type in metadata");
  },

  async _handleAppointmentBookingPayment(pi: Stripe.PaymentIntent) {
    // (your existing code unchanged)
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        appointmentType: true,
        organisationId: true,
        patient: true,
      },
    });
    if (!appointment) return;

    const openInvoice = await prisma.invoice.findFirst({
      where: {
        appointmentId,
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (openInvoice) {
      const chargeId = pi.latest_charge as string;
      const charge = await getStripeClient().charges.retrieve(chargeId);

      await prisma.invoice.updateMany({
        where: {
          id: openInvoice.id,
          status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        },
        data: {
          status: "PAID",
          stripePaymentIntentId: pi.id,
          stripeChargeId: charge.id,
          stripeReceiptUrl: charge.receipt_url ?? undefined,
          paymentCollectionMethod: "PAYMENT_INTENT",
          updatedAt: new Date(),
        },
      });

      await prisma.appointment.updateMany({
        where: { id: appointmentId },
        data: {
          status: "REQUESTED",
          updatedAt: new Date(),
          expiresAt: null,
        },
      });

      logger.info(
        `Appointment ${appointmentId} booking PAID. Invoice ${openInvoice.id} settled`,
      );
      return;
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: { appointmentId, status: "PAID" },
    });
    if (existingInvoice) return;

    const chargeId = pi.latest_charge as string;
    const charge = await getStripeClient().charges.retrieve(chargeId);

    const serviceId = extractAppointmentTypeId(appointment.appointmentType);
    if (!serviceId) return;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) return;

    const { parentId, patientId } = extractAppointmentPatientRefs(appointment);

    await prisma.invoice.create({
      data: {
        appointmentId,
        organisationId: appointment.organisationId,
        parentId: parentId ?? undefined,
        patientId: patientId ?? undefined,
        currency: pi.currency ?? "usd",
        status: "PAID",
        items: [
          {
            name: service.name,
            description: service.description ?? undefined,
            quantity: 1,
            unitPrice: service.cost,
            total: service.cost,
          },
        ] as unknown as Prisma.InputJsonValue,
        subtotal: service.cost,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: service.cost,
        stripePaymentIntentId: pi.id,
        stripeChargeId: charge.id,
        stripeReceiptUrl: charge.receipt_url ?? undefined,
      },
    });

    await prisma.appointment.updateMany({
      where: { id: appointmentId },
      data: {
        status: "REQUESTED",
        updatedAt: new Date(),
        expiresAt: null,
      },
    });

    logger.info(`Appointment ${appointmentId} booking PAID. Invoice created`);
  },

  async _handleInvoicePayment(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId,
        paymentIntentId: pi.id,
        chargeId:
          typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        currency: pi.currency ?? null,
        rawProviderPayload: {
          paymentIntentId: pi.id,
          invoiceId,
          metadata: pi.metadata,
        } as Prisma.InputJsonValue,
      });

    if (result.action === "REFUNDED") {
      logger.warn(`Invoice ${invoiceId} refunded from payment-intent webhook`);
      return;
    }

    if (result.action === "IGNORED") {
      return;
    }

    if (result.action === "PAID") {
      logger.info(`Invoice ${invoiceId} marked PAID`);
    }
  },

  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const appointmentId = pi.metadata?.appointmentId;
    const invoiceId = pi.metadata?.invoiceId;
    const result = await FinancePaymentService.handleInvoicePaymentFailed({
      invoiceId,
      appointmentId,
      paymentIntentId: pi.id,
    });
    if (result.action === "FAILED") {
      logger.warn(`Invoice ${result.invoice.id} marked FAILED`);
    }
  },

  async _handleRefund(charge: Stripe.Charge) {
    const invoiceId = charge.metadata?.invoiceId;
    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId,
      paymentIntentId:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null,
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      reason: charge.refunded ? "Refunded via Stripe" : undefined,
    });

    if (result.action !== "REFUNDED" || !result.invoice.parentId) {
      return;
    }

    const notificationPayload = NotificationTemplates.Payment.REFUND_ISSUED(
      charge.amount / 100,
      charge.currency,
    );
    await NotificationService.sendToUser(
      result.invoice.parentId,
      notificationPayload,
    );

    logger.warn(`Invoice ${result.invoice.id} marked REFUNDED`);
  },

  async _handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const stripe = getStripeClient();

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    if (!customerId || !subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    const item = subscription.items.data[0];
    const price = item.price;

    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    await FinanceSubscriptionService.recordBusinessCheckoutCompleted({
      customerId,
      subscriptionId: subscription.id,
      subscriptionItemId: item.id,
      priceId: price.id,
      productId: productId ?? null,
      billingInterval: toBillingInterval(price.recurring?.interval) ?? null,
      subscriptionStatus: toSubscriptionStatus(subscription.status) ?? "none",
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      seatQuantity: item.quantity ?? 0,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      livemode: session.livemode ?? false,
    });
  },

  async _handleInvoiceCheckout(session: Stripe.Checkout.Session) {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;
    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        currency: session.currency ?? null,
        rawProviderPayload: {
          sessionId: session.id,
          invoiceId,
        } as Prisma.InputJsonValue,
      });

    if (result.action === "REFUNDED") {
      return;
    }

    if (result.action !== "PAID" || !result.invoice.parentId) {
      return;
    }

    await NotificationService.sendToUser(
      result.invoice.parentId,
      NotificationTemplates.Payment.PAYMENT_SUCCESS(
        result.invoice.totalAmount,
        result.invoice.currency,
      ),
    );
  },

  async _refundByPaymentIntentId(paymentIntentId: string) {
    try {
      await FinancePaymentService.refundPaymentIntent(paymentIntentId);
    } catch (err) {
      logger.error(
        "Failed to auto-refund payment intent",
        paymentIntentId,
        err,
      );
    }
  },
};
