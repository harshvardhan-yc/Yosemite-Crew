import {
  CatalogService,
  CatalogServiceError,
  resolveCatalogSelectionFromRecord,
} from "../../src/services/catalog.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    productItem: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    productPrice: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    productBookable: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    productPackage: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    productPackageItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    speciality: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
    },
  },
}));

describe("CatalogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
      id: "spec_1",
    });
    (prisma.appointment.count as jest.Mock).mockResolvedValue(0);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productPackageItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.productItem.findFirst as jest.Mock).mockImplementation(
      (args?: { where?: { code?: string; id?: string } }) => {
        if (args?.where?.code) {
          return Promise.resolve(null);
        }

        return Promise.resolve(null);
      },
    );
  });

  it("resolves a direct bookable product into one billing item", () => {
    const resolved = resolveCatalogSelectionFromRecord({
      id: "prod_consult",
      organisationId: "org_1",
      name: "General Consultation",
      description: null,
      code: null,
      kind: "CONSULTATION",
      specialityId: null,
      legacyServiceId: "svc_consult",
      isActive: true,
      prices: [
        {
          unitPrice: 80,
          currency: "USD",
          defaultDiscountPercent: 5,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: null,
    });

    expect(resolved).toEqual({
      productItemId: "prod_consult",
      productKind: "CONSULTATION",
      legacyServiceId: "svc_consult",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      billingItems: [
        {
          productItemId: "prod_consult",
          name: "General Consultation",
          kind: "CONSULTATION",
          quantity: 1,
          unitPrice: 80,
          referenceUnitPrice: null,
          defaultDiscountPercent: 5,
          maxDiscountPercent: 10,
          isPackageComponent: false,
          packageProductItemId: null,
        },
      ],
      includedItems: [],
    });
  });

  it("expands a package into parent, included items, and priced child items", () => {
    const resolved = resolveCatalogSelectionFromRecord({
      id: "pkg_dental",
      organisationId: "org_1",
      name: "Dental Bundle",
      description: null,
      code: null,
      kind: "PACKAGE",
      specialityId: null,
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 15,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 45,
        supportsOutpatient: true,
        supportsInpatient: true,
      },
      package: {
        items: [
          {
            id: "pkg_item_exam",
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_exam",
              name: "Dental Exam",
              kind: "CONSULTATION",
              isActive: true,
              prices: [
                {
                  unitPrice: 90,
                  currency: "USD",
                  defaultDiscountPercent: null,
                  maxDiscountPercent: 10,
                  isDefault: true,
                },
              ],
            },
          },
          {
            id: "pkg_item_xray",
            childProductItemId: "prod_xray",
            quantity: 2,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: 40,
            sortOrder: 1,
            isOptional: false,
            childProductItem: {
              id: "prod_xray",
              name: "Dental X-Ray",
              kind: "DIAGNOSTIC",
              isActive: true,
              prices: [
                {
                  unitPrice: 55,
                  currency: "USD",
                  defaultDiscountPercent: null,
                  maxDiscountPercent: 10,
                  isDefault: true,
                },
              ],
            },
          },
        ],
      },
    });

    expect(resolved.appointmentKinds).toEqual(["OUTPATIENT", "INPATIENT"]);
    expect(resolved.billingItems).toEqual([
      {
        productItemId: "pkg_dental",
        name: "Dental Bundle",
        kind: "PACKAGE",
        quantity: 1,
        unitPrice: 250,
        referenceUnitPrice: null,
        defaultDiscountPercent: null,
        maxDiscountPercent: 15,
        isPackageComponent: false,
        packageProductItemId: null,
      },
      {
        productItemId: "prod_xray",
        name: "Dental X-Ray",
        kind: "DIAGNOSTIC",
        quantity: 2,
        unitPrice: 40,
        referenceUnitPrice: 55,
        defaultDiscountPercent: null,
        maxDiscountPercent: 10,
        isPackageComponent: true,
        packageProductItemId: "pkg_dental",
      },
    ]);
    expect(resolved.includedItems).toEqual([
      {
        productItemId: "prod_exam",
        name: "Dental Exam",
        kind: "CONSULTATION",
        quantity: 1,
        unitPrice: 0,
        referenceUnitPrice: 90,
        defaultDiscountPercent: null,
        maxDiscountPercent: 10,
        isPackageComponent: true,
        packageProductItemId: "pkg_dental",
      },
    ]);
  });

  it("builds organisation speciality summary counts from product items", async () => {
    (prisma.speciality.findMany as jest.Mock).mockResolvedValue([
      {
        id: "spec_1",
        organisationId: "org_1",
        name: "Cardiology",
        headUserId: "user_1",
        headName: "Dr. Lee",
        headProfilePicUrl: null,
        memberUserIds: ["user_2"],
        createdAt: new Date("2026-06-09T00:00:00.000Z"),
        updatedAt: new Date("2026-06-09T00:00:00.000Z"),
      },
    ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        specialityId: "spec_1",
        isActive: true,
        kind: "CONSULTATION",
        name: "Consult",
        code: "CS-0001",
        description: null,
      },
      {
        specialityId: "spec_1",
        isActive: false,
        kind: "PACKAGE",
        name: "Bundle",
        code: "PK-0001",
        description: null,
      },
    ]);

    const result = await CatalogService.getOrganisationSummary("org_1");

    expect(result).toEqual({
      organisationId: "org_1",
      items: [
        expect.objectContaining({
          id: "spec_1",
          activeServiceCount: 1,
          activePackageCount: 0,
          archivedServiceCount: 0,
          archivedPackageCount: 1,
          teamMemberIds: ["user_2", "user_1"],
        }),
      ],
    });
  });

  it("blocks permanent delete when a product has dependent appointments", async () => {
    (prisma.appointment.count as jest.Mock).mockResolvedValue(3);
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "prod_1",
    });

    await expect(
      CatalogService.deleteProduct("prod_1", "org_1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CATALOG_ITEM_HAS_DEPENDENCIES",
      details: expect.objectContaining({
        appointments: 3,
      }),
    });
  });

  it("creates a catalogue speciality with deduped team members", async () => {
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.speciality.create as jest.Mock).mockResolvedValue({
      id: "spec_1",
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      memberUserIds: ["user_2", "user_1"],
      isActive: true,
    });

    const created = await CatalogService.createSpeciality({
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      teamMemberIds: ["user_2", "user_1"],
    });

    expect(prisma.speciality.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberUserIds: ["user_2", "user_1"],
        }),
      }),
    );
    expect(created.id).toBe("spec_1");
  });

  it("rejects package updates that would create a cycle", async () => {
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValue({
      id: "pkg_parent",
      organisationId: "org_1",
      kind: "PACKAGE",
      code: "PK-0001",
      specialityId: "spec_1",
      prices: [],
      bookable: null,
      package: { items: [] },
    });
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "pkg_child",
          organisationId: "org_1",
          name: "Child Package",
          description: null,
          code: "PK-0002",
          kind: "PACKAGE",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          package: { items: [{ childProductItemId: "pkg_parent" }] },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pkg_parent",
          package: { items: [] },
        },
        {
          id: "pkg_child",
          package: { items: [{ childProductItemId: "pkg_parent" }] },
        },
      ]);

    await expect(
      CatalogService.updateProduct("pkg_parent", {
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "pkg_child",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PACKAGE_HAS_CYCLE",
    });
  });

  it("throws when an override-priced package item has no override price", () => {
    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_invalid",
        organisationId: "org_1",
        name: "Invalid Bundle",
        description: null,
        code: null,
        kind: "PACKAGE",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: {
          items: [
            {
              id: "pkg_item_lab",
              childProductItemId: "prod_lab",
              quantity: 1,
              pricingMode: "OVERRIDE_PRICE",
              overridePrice: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_lab",
                name: "CBC",
                kind: "LAB_TEST",
                isActive: true,
                prices: [],
              },
            },
          ],
        },
      }),
    ).toThrow(
      new CatalogServiceError(
        "Package component CBC is missing override price.",
        500,
      ),
    );
  });

  it("loads a product from prisma when resolving by id", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "prod_consult",
      organisationId: "org_1",
      name: "General Consultation",
      description: null,
      code: null,
      kind: "CONSULTATION",
      specialityId: null,
      legacyServiceId: "svc_consult",
      isActive: true,
      prices: [
        {
          unitPrice: 80,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: null,
    });

    const resolved = await CatalogService.resolveSelection(
      "prod_consult",
      "org_1",
    );

    expect(prisma.productItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "prod_consult" }, { legacyServiceId: "prod_consult" }],
          organisationId: "org_1",
        },
      }),
    );
    expect(resolved.productItemId).toBe("prod_consult");
  });

  it("creates a package product with nested price, bookable settings, and package items", async () => {
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "prod_exam",
          organisationId: "org_1",
          name: "Exam",
          description: null,
          code: "CS-0002",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          package: null,
        },
      ])
      .mockResolvedValueOnce([]);
    (prisma.productItem.create as jest.Mock).mockResolvedValue({
      id: "prod_pkg",
      organisationId: "org_1",
      name: "Dental Bundle",
      description: "desc",
      code: "DENTAL",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: 5,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 45,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: {
        items: [
          {
            id: "pkg_item_1",
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_exam",
              name: "Exam",
              kind: "CONSULTATION",
              isActive: true,
              prices: [],
            },
          },
        ],
      },
    });

    const created = await CatalogService.createProduct({
      organisationId: "org_1",
      name: "Dental Bundle",
      description: "desc",
      code: "DENTAL",
      kind: "PACKAGE",
      specialityId: "spec_1",
      price: {
        unitPrice: 250,
        currency: "USD",
        defaultDiscountPercent: 5,
        maxDiscountPercent: 10,
      },
      bookable: {
        durationMinutes: 45,
      },
      packageItems: [
        {
          childProductItemId: "prod_exam",
          quantity: 1,
          pricingMode: "INCLUDED",
        },
      ],
    });

    expect(prisma.productItem.create).toHaveBeenCalled();
    expect(created.defaultPrice?.unitPrice).toBe(250);
    expect(created.packageItems).toHaveLength(1);
  });

  it("lists active products for an organisation", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_1",
        organisationId: "org_1",
        name: "Consult",
        description: null,
        code: null,
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: null,
      },
    ]);

    const results = await CatalogService.listProducts({
      organisationId: "org_1",
    });

    expect(prisma.productItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          isActive: true,
        }),
      }),
    );
    expect(results).toHaveLength(1);
  });

  it("updates nested pricing and bookable settings", async () => {
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValue({
      id: "prod_1",
      kind: "CONSULTATION",
      prices: [{ id: "price_1", isDefault: true }],
      bookable: { id: "book_1" },
      package: null,
    });
    (prisma.productPrice.findFirst as jest.Mock).mockResolvedValue({
      id: "price_1",
    });
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});
    (prisma.productBookable.upsert as jest.Mock).mockResolvedValue({});
    (prisma.productItem.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "prod_1",
        kind: "CONSULTATION",
        prices: [{ id: "price_1", isDefault: true }],
        bookable: { id: "book_1" },
        package: null,
      })
      .mockResolvedValueOnce({
        id: "prod_1",
        organisationId: "org_1",
        name: "Updated Consult",
        description: null,
        code: null,
        kind: "CONSULTATION",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 99,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: null,
      });

    const updated = await CatalogService.updateProduct("prod_1", {
      name: "Updated Consult",
      price: {
        unitPrice: 99,
        currency: "USD",
        defaultDiscountPercent: 0,
        maxDiscountPercent: 10,
      },
      bookable: {
        durationMinutes: 30,
      },
    });

    expect(prisma.productPrice.update).toHaveBeenCalled();
    expect(prisma.productBookable.upsert).toHaveBeenCalled();
    expect(updated.name).toBe("Updated Consult");
  });

  it("builds a speciality catalog view grouped into services and packages", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_consult",
        organisationId: "org_1",
        name: "General Consultation",
        description: "Consult",
        code: "CS-1",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 100,
            currency: "USD",
            defaultDiscountPercent: 10,
            maxDiscountPercent: 15,
            isDefault: true,
          },
        ],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: null,
      },
      {
        id: "pkg_bundle",
        organisationId: "org_1",
        name: "Cardio Bundle",
        description: "Bundle",
        code: "PK-1",
        kind: "PACKAGE",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: {
          items: [
            {
              id: "pkgi_1",
              childProductItemId: "prod_consult",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              overridePrice: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_consult",
                name: "General Consultation",
                kind: "CONSULTATION",
                isActive: true,
                prices: [
                  {
                    unitPrice: 100,
                    currency: "USD",
                    defaultDiscountPercent: 10,
                    maxDiscountPercent: 15,
                    isDefault: true,
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    const result = await CatalogService.getSpecialityCatalog({
      organisationId: "org_1",
      specialityId: "spec_1",
      tab: "all",
      search: "cardio",
    });

    expect(result).toEqual({
      specialityId: "spec_1",
      organisationId: "org_1",
      activeTab: "all",
      search: "cardio",
      services: [
        {
          id: "prod_consult",
          code: "CS-1",
          name: "General Consultation",
          description: "Consult",
          kind: "CONSULTATION",
          isBookable: true,
          isActive: true,
          durationMinutes: 30,
          unitPrice: 100,
          defaultDiscountPercent: 10,
          maxDiscountPercent: 15,
          totalAmount: 90,
        },
      ],
      packages: [
        {
          id: "pkg_bundle",
          code: "PK-1",
          name: "Cardio Bundle",
          description: "Bundle",
          kind: "PACKAGE",
          isBookable: true,
          isActive: true,
          durationMinutes: 30,
          unitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          totalAmount: 90,
        },
      ],
    });
  });

  it("returns package detail with breakdown rows", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "pkg_bundle",
      organisationId: "org_1",
      name: "Cardio Bundle",
      description: "Bundle",
      code: "PK-1",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: {
        items: [
          {
            id: "pkgi_1",
            childProductItemId: "prod_consult",
            quantity: 2,
            pricingMode: "INHERITED_PRICE",
            overridePrice: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_consult",
              name: "General Consultation",
              kind: "CONSULTATION",
              isActive: true,
              prices: [
                {
                  unitPrice: 100,
                  currency: "USD",
                  defaultDiscountPercent: 10,
                  maxDiscountPercent: 15,
                  isDefault: true,
                },
              ],
            },
          },
        ],
      },
    });

    const result = await CatalogService.getPackageDetail("pkg_bundle", "org_1");

    expect(result).toEqual({
      id: "pkg_bundle",
      code: "PK-1",
      name: "Cardio Bundle",
      description: "Bundle",
      isBookable: true,
      isActive: true,
      durationMinutes: 30,
      maxDiscountPercent: 10,
      totalAmount: 180,
      items: [
        {
          id: "pkgi_1",
          type: "CONSULTATION",
          name: "General Consultation",
          quantity: 2,
          unitPrice: 100,
          grossAmount: 200,
          discountPercent: 10,
          finalAmount: 180,
        },
      ],
    });
  });
});
