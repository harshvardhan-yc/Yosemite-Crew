import { Request, Response } from "express";
import { SearchController } from "../../src/controllers/web/search.controller";
import {
  InventoryService,
  InventoryServiceError,
} from "../../src/services/inventory.service";

jest.mock("../../src/services/inventory.service", () => ({
  InventoryService: {
    listItems: jest.fn(),
  },
  InventoryServiceError: class InventoryServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "InventoryServiceError";
    }
  },
}));

const mockedInventoryService = InventoryService as jest.Mocked<
  typeof InventoryService
>;

describe("SearchController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const buildResponse = () => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { organisationId: "org-1" },
      query: {},
      body: {},
    };
    buildResponse();
  });

  it("searches medications and filters non-medical inventory", async () => {
    mockedInventoryService.listItems.mockResolvedValueOnce([
      {
        id: "item-1",
        organisationId: "org-1",
        name: "Amoxicillin",
        sku: "AMX-1",
        itemType: "MEDICAL",
        prescriptionRequired: true,
        controlledItem: false,
        expiryTrackingRequired: true,
        onHand: 10,
        allocated: 2,
        batches: [
          {
            id: "batch-1",
            batchNumber: "B-1",
            lotNumber: "LOT-1",
            expiryDate: new Date("2026-12-31T00:00:00.000Z"),
            quantity: 8,
            allocated: 0,
          },
        ],
      },
      {
        id: "item-2",
        organisationId: "org-1",
        name: "Bandage",
        sku: "BAND-1",
        itemType: "NON_MEDICAL",
        prescriptionRequired: false,
      },
    ] as never);

    await SearchController.searchMedications(
      {
        ...req,
        query: { search: "amox", page: "1", pageSize: "10" },
      } as Request,
      res as Response,
    );

    expect(mockedInventoryService.listItems).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        search: "amox",
        status: "ACTIVE",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [
          expect.objectContaining({
            itemId: "item-1",
            batches: [expect.objectContaining({ id: "batch-1" })],
          }),
        ],
      }),
    );
  });

  it("searches inventory items without medical filtering", async () => {
    mockedInventoryService.listItems.mockResolvedValueOnce([
      {
        id: "item-3",
        organisationId: "org-1",
        name: "Scalpel",
        sku: "SCL-1",
        itemType: "NON_MEDICAL",
        prescriptionRequired: false,
      },
    ] as never);

    await SearchController.searchInventoryItems(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ itemId: "item-3" })],
      }),
    );
  });

  it("returns inventory errors as api errors", async () => {
    mockedInventoryService.listItems.mockRejectedValueOnce(
      new InventoryServiceError("Inventory unavailable", 503),
    );

    await SearchController.searchInventoryItems(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Inventory unavailable",
    });
  });
});
