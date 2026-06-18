import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withAppointmentOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const withInvoiceOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const withPaymentIntentOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const FinanceController = {
  webhook: jest.fn(),
  listInvoices: jest.fn(),
  createInvoice: jest.fn(),
  addInvoiceItems: jest.fn(),
  getInvoiceById: jest.fn(),
  getInvoiceByPaymentIntentId: jest.fn(),
  listInvoicesForAppointment: jest.fn(),
  listInvoicesForParent: jest.fn(),
  bootstrapInvoiceForAppointment: jest.fn(),
  finalizeInvoice: jest.fn(),
  previewInvoiceTax: jest.fn(),
  voidInvoice: jest.fn(),
  supplementInvoice: jest.fn(),
  createInvoicePaymentSession: jest.fn(),
  recordInvoicePayment: jest.fn(),
  refundPayment: jest.fn(),
  getSubscriptionOverview: jest.fn(),
  getSubscriptionSeatSyncPlan: jest.fn(),
  getUsageOverview: jest.fn(),
  recordSubscriptionCustomer: jest.fn(),
  recordSubscriptionCheckoutCompleted: jest.fn(),
  recordSubscriptionUpdated: jest.fn(),
  recordSubscriptionDeleted: jest.fn(),
  recordSubscriptionInvoicePaid: jest.fn(),
  recordSubscriptionInvoiceFailed: jest.fn(),
  getCurrentSubscription: jest.fn(),
  upsertSubscription: jest.fn(),
  recordUsageEvent: jest.fn(),
  captureUsageSnapshot: jest.fn(),
  getUsageSnapshots: jest.fn(),
  recordVisitMilestone: jest.fn(),
  markAppointmentReadyForBilling: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentIntentOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/app/finance.controller", () => ({
  FinanceController,
}));

const financeRouter = jest.requireActual("../../src/routers/finance.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (financeRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("finance.router", () => {
  it("routes payment and refund endpoints through finance handlers", () => {
    const sessionRoute = findRoute(
      "/invoices/:invoiceId/payments/sessions",
      "post",
    );
    const paymentRoute = findRoute("/invoices/:invoiceId/payments", "post");
    const refundRoute = findRoute("/payments/:paymentId/refunds", "post");
    const mobileParentRoute = findRoute(
      "/mobile/parents/:parentId/invoices",
      "get",
    );

    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.createInvoicePaymentSession,
    );
    expect(paymentRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.recordInvoicePayment,
    );
    expect(refundRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.refundPayment,
    );
    expect(mobileParentRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognitoMobile,
    );
  });

  it("exposes the remaining finance contract routes", () => {
    expect(
      findRoute("/organisation/:organisationId/usage", "get"),
    ).toBeUndefined();
    expect(
      findRoute("/organisation/:organisationId/usage/events", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/organisation/:organisationId/usage/snapshots", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/organisation/:organisationId/list", "get"),
    ).toBeUndefined();
    expect(
      findRoute("/appointments/:appointmentId/charges", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/appointments/:appointmentId/bootstrap", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/pms/appointment/:appointmentId/bootstrap", "post"),
    ).toBeUndefined();
    expect(findRoute("/:invoiceId/checkout-session", "post")).toBeUndefined();
    expect(findRoute("/:invoiceId/mark-paid", "post")).toBeUndefined();
    expect(
      findRoute("/:invoiceId/payment-collection-method", "patch"),
    ).toBeUndefined();
    expect(findRoute("/:invoiceId/credit-notes", "post")).toBeUndefined();
    expect(
      findRoute("/:invoiceId/credit-notes/:creditNoteId/void", "post"),
    ).toBeUndefined();

    expect(
      findRoute("/subscriptions/current", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.getCurrentSubscription);
    expect(
      findRoute("/subscriptions", "post")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.upsertSubscription);
    expect(
      findRoute("/usage-events", "post")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.recordUsageEvent);
    expect(
      findRoute("/usage-snapshots", "get")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.getUsageSnapshots);
    expect(
      findRoute("/visits/:visitId/milestones", "post")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.recordVisitMilestone);
    expect(
      findRoute(
        "/appointments/:appointmentId/ready-for-billing",
        "post",
      )?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.markAppointmentReadyForBilling);
  });
});
