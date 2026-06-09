import { CatalogController } from "../../src/controllers/web/catalog.controller";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";

jest.mock("../../src/services/catalog.service", () => ({
  CatalogService: {
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    getProductById: jest.fn(),
    getPackageDetail: jest.fn(),
    listProducts: jest.fn(),
    getSpecialityCatalog: jest.fn(),
    resolveSelection: jest.fn(),
    getOrganisationSummary: jest.fn(),
    listSpecialities: jest.fn(),
    archiveProduct: jest.fn(),
    restoreProduct: jest.fn(),
    deleteProduct: jest.fn(),
    searchItems: jest.fn(),
    getArchiveCatalog: jest.fn(),
    createSpeciality: jest.fn(),
    updateSpeciality: jest.fn(),
    archiveSpeciality: jest.fn(),
    restoreSpeciality: jest.fn(),
    deleteSpeciality: jest.fn(),
  },
  CatalogServiceError: class CatalogServiceError extends Error {
    statusCode: number;
    code?: string;
    details?: Record<string, unknown>;

    constructor(
      message: string,
      statusCode: number,
      code?: string,
      details?: Record<string, unknown>,
    ) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    }
  },
}));

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };

  return res;
};

describe("CatalogController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns speciality catalog view for screen queries", async () => {
    (CatalogService.getSpecialityCatalog as jest.Mock).mockResolvedValue({
      specialityId: "spec_1",
      organisationId: "org_1",
      activeTab: "services",
      search: null,
      services: [],
      packages: [],
    });

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { tab: "services" },
    };
    const res = createResponse();

    await CatalogController.getSpecialityCatalog(req as never, res as never);

    expect(CatalogService.getSpecialityCatalog).toHaveBeenCalledWith({
      organisationId: "org_1",
      specialityId: "spec_1",
      tab: "services",
      search: undefined,
      includeInactive: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns package detail by id", async () => {
    (CatalogService.getPackageDetail as jest.Mock).mockResolvedValue({
      id: "pkg_1",
      version: 3,
      items: [],
    });

    const req = {
      params: { id: "pkg_1" },
      query: { organisationId: "org_1" },
    };
    const res = createResponse();

    await CatalogController.getPackageDetail(req as never, res as never);

    expect(CatalogService.getPackageDetail).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"3"');
  });

  it("passes If-Match through for service updates and returns the next version", async () => {
    (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
      id: "prod_1",
      version: 8,
      name: "Updated Consult",
    });

    const req = {
      params: { organisationId: "org_1", id: "prod_1" },
      body: { name: "Updated Consult" },
      header: jest.fn().mockReturnValue('W/"7"'),
    };
    const res = createResponse();

    await CatalogController.updateService(req as never, res as never);

    expect(CatalogService.updateProduct).toHaveBeenCalledWith("prod_1", {
      organisationId: "org_1",
      specialityId: undefined,
      name: "Updated Consult",
      description: null,
      code: null,
      kind: "CONSULTATION",
      isActive: undefined,
      price: undefined,
      bookable: undefined,
      expectedVersion: 7,
    });
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"8"');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps catalog service errors to status codes", async () => {
    (CatalogService.getPackageDetail as jest.Mock).mockRejectedValue(
      new CatalogServiceError("Package not found.", 404),
    );

    const req = {
      params: { id: "pkg_missing" },
      query: {},
    };
    const res = createResponse();

    await CatalogController.getPackageDetail(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Package not found.",
    });
  });

  it("returns organisation catalog summary", async () => {
    (CatalogService.getOrganisationSummary as jest.Mock).mockResolvedValue({
      organisationId: "org_1",
      items: [],
    });

    const req = {
      params: { organisationId: "org_1" },
      query: { search: "cardio", includeArchived: "true" },
    };
    const res = createResponse();

    await CatalogController.getOrganisationSummary(req as never, res as never);

    expect(CatalogService.getOrganisationSummary).toHaveBeenCalledWith(
      "org_1",
      {
        search: "cardio",
        includeArchived: true,
      },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns dependency-shaped catalog errors for delete flows", async () => {
    (CatalogService.deleteProduct as jest.Mock).mockRejectedValue(
      new CatalogServiceError(
        "Catalog item cannot be permanently deleted because it has dependencies.",
        409,
        "CATALOG_ITEM_HAS_DEPENDENCIES",
        { appointments: 2 },
      ),
    );

    const req = {
      params: { organisationId: "org_1", id: "prod_1" },
    };
    const res = createResponse();

    await CatalogController.deleteService(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "CATALOG_ITEM_HAS_DEPENDENCIES",
        message:
          "Catalog item cannot be permanently deleted because it has dependencies.",
        details: { appointments: 2 },
      },
    });
  });

  it("creates a speciality from the catalog contract", async () => {
    (CatalogService.createSpeciality as jest.Mock).mockResolvedValue({
      id: "spec_1",
      name: "Cardiology",
    });

    const req = {
      params: { organisationId: "org_1" },
      body: {
        name: "Cardiology",
        headUserId: "user_1",
        teamMemberIds: ["user_1", "user_2"],
      },
    };
    const res = createResponse();

    await CatalogController.createSpeciality(req as never, res as never);

    expect(CatalogService.createSpeciality).toHaveBeenCalledWith({
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      headName: undefined,
      headProfilePicUrl: undefined,
      teamMemberIds: ["user_1", "user_2"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns FHIR Parameters for resolve operation", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Cardio Package",
      code: "PK-1",
      currency: "USD",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      leadCount: 1,
      supportCount: 0,
      additionalDiscountPercent: 0,
      grossAmount: 100,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 100,
      breakdownItemCount: 1,
      billingItems: [
        {
          productItemId: "pkg_1",
          code: "PK-1",
          name: "Cardio Package",
          kind: "PACKAGE",
          quantity: 1,
          currency: "USD",
          unitPrice: 100,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 100,
          discountAmount: 0,
          finalAmount: 100,
          isPackageComponent: false,
          packageProductItemId: null,
        },
      ],
      includedItems: [],
    });

    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "productItemId", valueString: "pkg_1" },
          { name: "organization", valueString: "Organization/org_1" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.resolveProductOperation(req as never, res as never);

    expect(CatalogService.resolveSelection).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
      }),
    );
  });

  it("returns FHIR Parameters for component search operation", async () => {
    (CatalogService.searchItems as jest.Mock).mockResolvedValue({
      query: "cbc",
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_1",
          code: "LB-0001",
          name: "CBC - Canine",
          description: "Blood test",
          kind: "LAB_TEST",
          source: "CATALOG",
          status: "ACTIVE",
          isBookable: false,
          durationMinutes: 20,
          unitPrice: 800,
          currency: "USD",
          defaultDiscountPercent: 2,
          maxDiscountPercent: 10,
          totalAmount: 784,
          canBeAddedToPackage: true,
          blockReason: null,
          nestedBreakdown: null,
        },
      ],
    });

    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "q", valueString: "cbc" },
          { name: "kinds", valueString: "LAB,PACKAGE" },
          { name: "page", valueInteger: 1 },
          { name: "pageSize", valueInteger: 20 },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).toHaveBeenCalledWith({
      organisationId: "org_1",
      q: "cbc",
      specialityId: undefined,
      kinds: ["LAB", "PACKAGE"],
      includeArchived: false,
      excludePackageId: undefined,
      includeNestedBreakdown: false,
      page: 1,
      pageSize: 20,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
      }),
    );
  });

  it("accepts canonical specialty in component search operation", async () => {
    (CatalogService.searchItems as jest.Mock).mockResolvedValue({
      query: null,
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
    });

    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "specialty", valueString: "spec_1" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).toHaveBeenCalledWith({
      organisationId: "org_1",
      q: undefined,
      specialityId: "spec_1",
      kinds: undefined,
      includeArchived: false,
      excludePackageId: undefined,
      includeNestedBreakdown: false,
      page: undefined,
      pageSize: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects unsupported FHIR component search kinds", async () => {
    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "kinds", valueString: "LAB_TEST" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unsupported catalog search kind: LAB_TEST",
    });
  });
});
