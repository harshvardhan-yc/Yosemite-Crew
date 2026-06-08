import {
  CatalogService,
  CatalogServiceError,
  resolveCatalogSelectionFromRecord,
} from "../../src/services/catalog.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    productItem: {
      findFirst: jest.fn(),
    },
  },
}));

describe("CatalogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves a direct bookable product into one billing item", () => {
    const resolved = resolveCatalogSelectionFromRecord({
      id: "prod_consult",
      organisationId: "org_1",
      name: "General Consultation",
      kind: "CONSULTATION",
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
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: null,
    });

    expect(resolved).toEqual({
      productItemId: "prod_consult",
      productKind: "CONSULTATION",
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
      kind: "PACKAGE",
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
        supportsOutpatient: true,
        supportsInpatient: true,
      },
      package: {
        items: [
          {
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
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
            childProductItemId: "prod_xray",
            quantity: 2,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: 40,
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

  it("throws when an override-priced package item has no override price", () => {
    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_invalid",
        organisationId: "org_1",
        name: "Invalid Bundle",
        kind: "PACKAGE",
        isActive: true,
        prices: [],
        bookable: null,
        package: {
          items: [
            {
              childProductItemId: "prod_lab",
              quantity: 1,
              pricingMode: "OVERRIDE_PRICE",
              overridePrice: null,
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
      kind: "CONSULTATION",
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
          id: "prod_consult",
          organisationId: "org_1",
        },
      }),
    );
    expect(resolved.productItemId).toBe("prod_consult");
  });
});
