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
import { InvoiceController } from "src/controllers/app/invoice.controller";

const router = Router();

router.post(
  "/webhooks/:provider",
  bodyParser.raw({ type: "application/json" }),
  FinanceController.webhook,
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

router.get(
  "/appointments/:appointmentId/invoices",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.listInvoicesForAppointment,
);

router.post(
  "/appointments/:appointmentId/charges",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.addChargesToAppointment,
);

router.post(
  "/appointment/:appointmentId",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.listInvoicesForAppointment,
);

router.post(
  "/appointments/:appointmentId/bootstrap",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.bootstrapInvoiceForAppointment,
);

router.post(
  "/pms/appointment/:appointmentId/bootstrap",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.bootstrapInvoiceForAppointment,
);

router.get(
  "/organisation/:organisationId/list",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.listInvoicesForOrganisation,
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
  "/:invoiceId/checkout-session",
  authorizeCognito,
  InvoiceController.createCheckoutSessionForInvoice,
);

router.post(
  "/:invoiceId/mark-paid",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.recordInvoicePayment,
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

router.patch(
  "/:invoiceId/payment-collection-method",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.updatePaymentCollectionMethod,
);

router.post(
  "/:invoiceId/credit-notes",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.issueCreditNote,
);

router.post(
  "/:invoiceId/credit-notes/:creditNoteId/void",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.voidCreditNote,
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
