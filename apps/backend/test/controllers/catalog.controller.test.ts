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
  },
  CatalogServiceError: class CatalogServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
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
});
