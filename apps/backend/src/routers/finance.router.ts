import { Router } from "express";
import bodyParser from "body-parser";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentIntentOrgPermissions,
} from "src/middlewares/rbac";
import { FinanceController } from "src/controllers/app/finance.controller";

const router = Router();

router.post(
  "/webhooks/:provider",
  bodyParser.raw({ type: "application/json" }),
  FinanceController.webhook,
);

router.get(
  "/organisation/:organisationId/subscription/seat-sync-plan",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getSubscriptionSeatSyncPlan,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/customer",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionCustomer,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/checkout/completed",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionCheckoutCompleted,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/updated",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionUpdated,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/deleted",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionDeleted,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/invoice-paid",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionInvoicePaid,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/invoice-failed",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionInvoiceFailed,
);

router.get(
  "/subscriptions/current",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getCurrentSubscription,
);

router.post(
  "/subscriptions",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.upsertSubscription,
);

router.post(
  "/usage-events",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordUsageEvent,
);

router.get(
  "/usage-snapshots",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getUsageSnapshots,
);

router.post(
  "/visits/:visitId/milestones",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.recordVisitMilestone,
);

router.post(
  "/appointments/:appointmentId/ready-for-billing",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.markAppointmentReadyForBilling,
);

router.get("/invoices", authorizeCognito, FinanceController.listInvoices);

router.post("/invoices", authorizeCognito, FinanceController.createInvoice);

router.post(
  "/invoices/:invoiceId/lines",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.addInvoiceItems,
);

router.get(
  "/invoices/:invoiceId",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.getInvoiceById,
);

router.get(
  "/invoices/payment-intent/:paymentIntentId",
  authorizeCognito,
  withPaymentIntentOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.getInvoiceByPaymentIntentId,
);

router.post(
  "/invoices/:invoiceId/finalize",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.finalizeInvoice,
);

router.post(
  "/invoices/:invoiceId/tax/preview",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.previewInvoiceTax,
);

router.post(
  "/invoices/:invoiceId/tax/finalize",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.finalizeInvoice,
);

router.post(
  "/invoices/:invoiceId/void",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.voidInvoice,
);

router.post(
  "/invoices/:invoiceId/supplement",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.supplementInvoice,
);

router.post(
  "/invoices/:invoiceId/payments",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.recordInvoicePayment,
);

router.post(
  "/invoices/:invoiceId/payments/sessions",
  authorizeCognito,
  FinanceController.createInvoicePaymentSession,
);

router.get("/:invoiceId", authorizeCognito, FinanceController.getInvoiceById);

router.get(
  "/mobile/parents/:parentId/invoices",
  authorizeCognitoMobile,
  FinanceController.listInvoicesForParent,
);

router.get(
  "/mobile/appointments/:appointmentId/invoices",
  authorizeCognitoMobile,
  FinanceController.listInvoicesForAppointment,
);

router.post(
  "/mobile/appointments/:appointmentId/seed",
  authorizeCognitoMobile,
  FinanceController.bootstrapInvoiceForAppointment,
);

router.get(
  "/mobile/payment-intent/:paymentIntentId",
  authorizeCognitoMobile,
  FinanceController.getInvoiceByPaymentIntentId,
);

router.get(
  "/mobile/:invoiceId",
  authorizeCognitoMobile,
  FinanceController.getInvoiceById,
);

router.post(
  "/payments/:paymentId/refunds",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.refundPayment,
);

export default router;
