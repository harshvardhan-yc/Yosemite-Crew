import {
  InvoiceService,
  InvoiceServiceError,
} from "../../src/services/invoice.service";
import { prisma } from "src/config/prisma";
import { CatalogService } from "../../src/services/catalog.service";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { StripeService } from "../../src/services/stripe.service";
import { sendEmailTemplate } from "../../src/utils/email";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findUnique: jest.fn(), findFirst: jest.fn() },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    service: { findUnique: jest.fn() },
    organizationBilling: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));

jest.mock("../../src/services/catalog.service", () => ({
  __esModule: true,
  CatalogServiceError: class CatalogServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "CatalogServiceError";
    }
  },
  CatalogService: {
    resolveSelection: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  __esModule: true,
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  __esModule: true,
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/services/stripe.service", () => ({
  __esModule: true,
  StripeService: {
    refundPaymentIntent: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
  },
}));

jest.mock("../../src/utils/email", () => ({
  __esModule: true,
  sendEmailTemplate: jest.fn(),
}));

describe("InvoiceService", () => {
  const appointmentId = "appt_1";
  const organisationId = "org_1";
  const patientId = "patient_1";
  const parentId = "parent_1";

  beforeEach(() => {
    jest.clearAllMocks();
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue(null);
  });

  it("creates a draft invoice and persists invoice-level discounts", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_1",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 120,
      discountTotal: 0,
      invoiceDiscountType: "FIXED_AMOUNT",
      invoiceDiscountValue: 12,
      invoiceDiscountTotal: 12,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 108,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.createDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
      invoiceDiscount: { type: "FIXED_AMOUNT", value: 12 },
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: "STRIPE",
          invoiceDiscountType: "FIXED_AMOUNT",
          invoiceDiscountValue: 12,
          invoiceDiscountTotal: 12,
          subtotal: 120,
          totalAmount: 108,
          taxSnapshot: expect.objectContaining({
            create: expect.objectContaining({
              provider: "STRIPE",
              taxBehavior: "EXCLUSIVE",
              taxAmount: 0,
            }),
          }),
        }),
      }),
    );
    expect(NotificationService.sendToUser).toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_1");
  });

  it("creates extra invoices with a frozen tax snapshot", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_extra",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 40,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 40,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.createExtraInvoiceForAppointment({
      appointmentId,
      items: [
        {
          name: "Medication",
          description: "Medication",
          quantity: 2,
          unitPrice: 20,
          total: 40,
        },
      ],
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: "STRIPE",
          taxSnapshot: expect.objectContaining({
            create: expect.objectContaining({
              provider: "STRIPE",
              taxBehavior: "EXCLUSIVE",
            }),
          }),
        }),
      }),
    );
    expect((result as { id: string }).id).toBe("inv_extra");
  });

  it("updates invoice totals when adding items", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_2",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: "PERCENTAGE",
      invoiceDiscountValue: 10,
      invoiceDiscountTotal: 10,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 90,
      stripeCheckoutSessionId: "cs_1",
      stripeCheckoutUrl: "https://checkout",
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({
      id: "inv_2",
      totalAmount: 135,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 150,
      discountTotal: 15,
      invoiceDiscountType: "PERCENTAGE",
      invoiceDiscountValue: 10,
      invoiceDiscountTotal: 15,
      taxTotal: 0,
      taxPercent: 0,
      stripeCheckoutSessionId: null,
      stripeCheckoutUrl: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.addItemsToInvoice("inv_2", [
      {
        description: "Lab",
        name: "Lab",
        quantity: 1,
        unitPrice: 50,
        total: 50,
      },
    ]);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: "STRIPE",
          invoiceDiscountTotal: 15,
          totalAmount: 135,
          stripeCheckoutSessionId: null,
          stripeCheckoutUrl: null,
          taxSnapshot: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
              update: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.totalAmount).toBe(135);
  });

  it("finalizes tax snapshots and locks future line edits", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxProvider: "STRIPE",
      finalizedAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const finalized = await InvoiceService.finalizeTaxForInvoice("inv_final");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalizedAt: expect.any(Date),
          taxProvider: "STRIPE",
          taxTotal: 18,
          taxSnapshot: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
              update: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
            }),
          }),
        }),
      }),
    );
    expect(finalized.id).toBe("inv_final");

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      InvoiceService.addItemsToInvoice("inv_final", [
        {
          description: "Lab",
          name: "Lab",
          quantity: 1,
          unitPrice: 50,
          total: 50,
        },
      ]),
    ).rejects.toThrow("Cannot modify a finalized invoice");
  });

  it("marks paid invoices and supports manual settlement", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      totalAmount: 90,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      metadata: {},
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const paid = await InvoiceService.markInvoicePaid({ invoiceId: "inv_3" });
    expect(paid).toBeTruthy();

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      totalAmount: 90,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      metadata: {},
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await InvoiceService.markInvoicePaidManually("inv_4", organisationId);
    expect(prisma.invoice.update).toHaveBeenCalled();
  });

  it("cancels or refunds invoices using Postgres only", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_5",
      status: "PAID",
      stripePaymentIntentId: "pi_123",
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      metadata: {},
    });
    (StripeService.refundPaymentIntent as jest.Mock).mockResolvedValue({
      refundId: "re_123",
      amountRefunded: 90,
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_5",
      status: "REFUNDED",
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      totalAmount: 90,
      metadata: {},
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.handleInvoiceCancellation(
      "inv_5",
      "reason",
    );

    expect(result).toEqual({ action: "REFUNDED", status: "REFUNDED" });
    expect(StripeService.refundPaymentIntent).toHaveBeenCalledWith("pi_123");
  });

  it("bootsraps from Postgres appointment context", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
      appointmentType: { id: "svc_1", name: "Consult" },
      productItemId: null,
      concern: "checkup",
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.service.findUnique as jest.Mock).mockResolvedValue({
      id: "svc_1",
      name: "Consult",
      cost: 100,
      maxDiscount: 10,
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_6",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 10,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 90,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.bootstrapForAppointment(appointmentId);
    expect((result as { id: string }).id).toBe("inv_6");
  });

  it("returns invoice lookup data", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_7",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 0,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: "Org",
      googlePlacesId: "place_1",
      address: { city: "Mumbai" },
      imageUrl: "img",
    });

    const result = await InvoiceService.getById("inv_7");
    expect(result.invoice.id).toBe("inv_7");
    expect(result.organistion.name).toBe("Org");
  });

  it("creates checkout sessions and emails the parent", async () => {
    (
      StripeService.createCheckoutSessionForInvoice as jest.Mock
    ).mockResolvedValue({
      url: "https://checkout",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_8",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      totalAmount: 90,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      email: "parent@example.com",
      firstName: "Pat",
      lastName: "Owner",
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: "Org",
    });

    const result =
      await InvoiceService.createCheckoutSessionAndEmailParent("inv_8");

    expect(result.emailSent).toBe(true);
    expect(sendEmailTemplate).toHaveBeenCalled();
  });
});
