import { Request, Response } from "express";
import { ZodError, z } from "zod";
import {
  FinancePaymentError,
  FinancePaymentService,
} from "src/services/finance/payment";
import { StripeController } from "src/controllers/web/stripe.controller";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";
import { AuthenticatedRequest } from "src/middlewares/auth";

const CreateInvoicePaymentSessionBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
});

const InvoiceItemBodySchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  description: z.string().optional(),
  discountPercent: z.number().optional(),
});

const CreateInvoiceBodySchema = z.object({
  appointmentId: z.string().trim().min(1),
  parentId: z.string().trim().min(1),
  patientId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1),
  paymentCollectionMethod: z.string().trim().min(1),
  items: z.array(InvoiceItemBodySchema).min(1),
  invoiceDiscount: z
    .object({
      type: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]),
      value: z.number(),
    })
    .optional(),
  notes: z.string().trim().min(1).optional(),
});

const FinalizeInvoiceBodySchema = z.object({
  taxProvider: z.string().trim().min(1).optional(),
});

const PreviewTaxBodySchema = z.object({
  taxProvider: z.string().trim().min(1).optional(),
});
const RecordInvoicePaymentBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  settlementChannel: z.string().trim().min(1).optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.string().datetime().optional(),
});

const RefundPaymentBodySchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().min(1).optional(),
});

const VoidInvoiceBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

const SupplementInvoiceBodySchema = z.object({
  items: z.array(InvoiceItemBodySchema).min(1),
});

const ListInvoicesQuerySchema = z.object({
  organisationId: z.string().trim().min(1).optional(),
  appointmentId: z.string().trim().min(1).optional(),
  parentId: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
});

const normalizeProvider = (value?: string) =>
  value?.trim().toUpperCase() ?? "STRIPE";

const toFinanceSuccess = <T>(data: T) => ({
  data,
  meta: null,
  error: null,
});

export const FinanceController = {
  async createInvoice(this: void, req: Request, res: Response) {
    try {
      const body = CreateInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const items = body.data.items.map((item) => ({
        ...item,
        description: item.description ?? item.name,
      }));

      const invoice = await InvoiceService.createDraftForAppointment({
        appointmentId: body.data.appointmentId,
        parentId: body.data.parentId,
        patientId: body.data.patientId,
        organisationId: body.data.organisationId,
        paymentCollectionMethod: body.data.paymentCollectionMethod as
          | "PAYMENT_INTENT"
          | "PAYMENT_LINK"
          | "PAYMENT_AT_CLINIC",
        items,
        invoiceDiscount: body.data.invoiceDiscount,
        notes: body.data.notes,
      });

      return res.status(201).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error creating invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async listInvoices(this: void, req: Request, res: Response) {
    try {
      const query = ListInvoicesQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ message: "Invalid request query" });
      }

      const filters = query.data;
      const resolved = {
        organisationId: filters.organisationId,
        appointmentId: filters.appointmentId,
        parentId: filters.parentId,
        patientId: filters.patientId,
      };

      if (
        !resolved.organisationId &&
        !resolved.appointmentId &&
        !resolved.parentId &&
        !resolved.patientId
      ) {
        return res.status(400).json({
          message:
            "At least one of organisationId, appointmentId, parentId, or patientId is required",
        });
      }

      if (resolved.organisationId) {
        const invoices = await InvoiceService.listForOrganisation(
          resolved.organisationId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.appointmentId) {
        const invoices = await InvoiceService.getByAppointmentId(
          resolved.appointmentId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.parentId) {
        const invoices = await InvoiceService.listForParent(resolved.parentId);
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      const invoices = await InvoiceService.listForCompanion(
        resolved.patientId as string,
      );
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error listing invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async listInvoicesForOrganisation(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const invoices = await InvoiceService.listForOrganisation(organisationId);
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching organisation invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async addInvoiceItems(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = SupplementInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const invoice = await InvoiceService.addItemsToInvoice(
        invoiceId,
        body.data.items,
      );

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error adding invoice items", error);
      return res.status(statusCode).json({ message });
    }
  },

  async listInvoicesForAppointment(this: void, req: Request, res: Response) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      const invoices = await InvoiceService.getByAppointmentId(
        appointmentId,
        organisationId,
      );

      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching appointment invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async listInvoicesForParent(this: void, req: Request, res: Response) {
    try {
      const parentId = req.params.parentId;
      if (!parentId) {
        return res.status(400).json({ message: "Parent Id is required" });
      }

      const authReq = req as AuthenticatedRequest;
      if (authReq.userId) {
        const authUser = await AuthUserMobileService.getByProviderUserId(
          authReq.userId,
        );
        if (!authUser?.parentId) {
          return res.status(403).json({
            message: "Parent account is not linked to this mobile user",
          });
        }

        if (authUser.parentId !== parentId) {
          return res.status(403).json({
            message: "Cannot access invoices for another parent",
          });
        }
      }

      const invoices = await InvoiceService.listForParent(parentId);
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching parent invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getInvoiceById(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const invoice = await InvoiceService.getById(invoiceId);
      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error fetching invoice by ID", error);
      return res.status(statusCode).json({ message });
    }
  },

  async getInvoiceByPaymentIntentId(this: void, req: Request, res: Response) {
    try {
      const paymentIntentId = req.params.paymentIntentId;
      if (!paymentIntentId) {
        return res
          .status(400)
          .json({ message: "Payment Intent Id is required" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      const invoice = await InvoiceService.getByPaymentIntentId(
        paymentIntentId,
        organisationId,
      );

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      logger.error("Error fetching invoice by payment intent", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async bootstrapInvoiceForAppointment(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const invoice =
        await InvoiceService.bootstrapForAppointment(appointmentId);
      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error bootstrapping appointment invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async finalizeInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = FinalizeInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const invoice = await InvoiceService.finalizeTaxForInvoice(
        invoiceId,
        body.data.taxProvider,
      );

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error finalizing invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async previewInvoiceTax(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = PreviewTaxBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const preview = await InvoiceService.previewTaxForInvoice(
        invoiceId,
        body.data.taxProvider,
      );
      return res.status(200).json(toFinanceSuccess(preview));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error previewing invoice tax", error);
      return res.status(statusCode).json({ message });
    }
  },

  async recordInvoicePayment(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = RecordInvoicePaymentBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const provider = normalizeProvider(body.data.provider);
      if (provider !== "MANUAL") {
        return res
          .status(400)
          .json({ message: "Unsupported payment provider" });
      }

      const settlementChannel = body.data.settlementChannel ?? "CASH";
      const payment = await FinancePaymentService.recordInvoicePayment(
        invoiceId,
        {
          provider: "MANUAL",
          settlementChannel: settlementChannel as
            | "CASH"
            | "BANK_TRANSFER"
            | "CARD_PRESENT"
            | "DEPOSIT"
            | "OTHER",
          amount: body.data.amount,
          currency: body.data.currency,
          reference: body.data.reference,
          receivedAt: body.data.receivedAt
            ? new Date(body.data.receivedAt)
            : undefined,
        },
      );

      if (!payment.payment) {
        return res.status(409).json({ message: "Invoice already settled" });
      }

      return res.status(201).json(
        toFinanceSuccess({
          paymentId: payment.payment.id,
          status: payment.payment.status,
          amount: payment.appliedAmount,
          balanceAfterPayment: payment.balanceAfterPayment,
        }),
      );
    } catch (error) {
      const statusCode =
        error instanceof FinancePaymentError ? error.statusCode : 500;
      const message =
        error instanceof FinancePaymentError
          ? error.message
          : "Internal server error";

      logger.error("Error recording invoice payment", error);
      return res.status(statusCode).json({ message });
    }
  },

  async refundPayment(this: void, req: Request, res: Response) {
    try {
      const paymentId = req.params.paymentId;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment Id is required" });
      }

      const body = RefundPaymentBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const result = await FinancePaymentService.refundPaymentById(paymentId, {
        amount: body.data.amount,
        reason: body.data.reason,
      });

      return res.status(201).json(toFinanceSuccess(result.refund));
    } catch (error) {
      const statusCode =
        error instanceof FinancePaymentError ? error.statusCode : 500;
      const message =
        error instanceof FinancePaymentError
          ? error.message
          : "Internal server error";

      logger.error("Error refunding payment", error);
      return res.status(statusCode).json({ message });
    }
  },

  async voidInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = VoidInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const action = await InvoiceService.handleInvoiceCancellation(
        invoiceId,
        body.data.reason ?? "Invoice voided",
      );
      const invoice = await InvoiceService.getById(invoiceId);

      return res.status(200).json(
        toFinanceSuccess({
          action,
          invoice,
        }),
      );
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error voiding invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async supplementInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = SupplementInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const invoice = await InvoiceService.getById(invoiceId);
      const appointmentId = invoice.invoice.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({
          message: "Invoice is not linked to an appointment",
        });
      }

      const organisationId = (req as OrgRequest).organisationId;
      const updatedInvoice = await InvoiceService.addChargesToAppointment(
        appointmentId,
        body.data.items,
        organisationId,
      );

      return res.status(201).json(toFinanceSuccess(updatedInvoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error creating supplemental invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async createInvoicePaymentSession(this: void, req: Request, res: Response) {
    try {
      const body = CreateInvoicePaymentSessionBodySchema.parse(req.body);
      const provider = normalizeProvider(body.provider);

      if (provider !== "STRIPE") {
        return res
          .status(400)
          .json({ message: "Unsupported payment provider" });
      }

      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const result =
        await FinancePaymentService.createCheckoutSessionForInvoice(
          invoiceId,
          provider,
        );

      return res.status(201).json({
        data: result,
        meta: null,
        error: null,
      });
    } catch (error) {
      logger.error("Error creating invoice payment session", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request body",
        });
      }

      if (error instanceof FinancePaymentError) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async webhook(this: void, req: Request, res: Response) {
    const provider = normalizeProvider(req.params.provider);
    if (provider !== "STRIPE") {
      return res.status(400).json({ message: "Unsupported provider" });
    }

    return StripeController.webhook(
      req as Request<Record<string, string>, unknown, Buffer>,
      res,
    );
  },
};
