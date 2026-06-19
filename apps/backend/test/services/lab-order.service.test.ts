import { LabOrderService } from "../../src/services/lab-order.service";
import { prisma } from "../../src/config/prisma";
import { getLabOrderAdapter } from "../../src/labs";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeEntry: { count: jest.fn(), findMany: jest.fn() },
    labOrder: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/labs", () => {
  const actual = jest.requireActual("../../src/labs");
  return {
    ...actual,
    getLabOrderAdapter: jest.fn(),
  };
});

describe("LabOrderService", () => {
  const adapter = {
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    updateOrder: jest.fn(),
    cancelOrder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getLabOrderAdapter as jest.Mock).mockReturnValue(adapter);
    adapter.createOrder.mockResolvedValue({
      idexxOrderId: "id-1",
      requestPayload: {},
      responsePayload: {},
      status: "CREATED",
    });
    (prisma.labOrder.create as jest.Mock).mockResolvedValue({
      id: "order-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
    });
    (prisma.labOrder.update as jest.Mock).mockResolvedValue({
      id: "order-1",
      status: "CREATED",
    });
  });

  it("rejects unsupported provider for listProviderTests", async () => {
    await expect(LabOrderService.listProviderTests("BAD", {})).rejects.toThrow(
      "Unsupported lab provider.",
    );
  });

  it("rejects invalid query type", async () => {
    await expect(
      LabOrderService.listProviderTests("IDEXX", { query: 123 as any }),
    ).rejects.toThrow("Invalid query.");
  });

  it("lists provider tests using postgres", async () => {
    (prisma.codeEntry.count as jest.Mock).mockResolvedValue(2);
    (prisma.codeEntry.findMany as jest.Mock).mockResolvedValue([{ code: "A" }]);

    const result = await LabOrderService.listProviderTests("IDEXX", {
      query: "chem",
      limit: 10,
      page: 1,
    });

    expect(result).toEqual({
      total: 2,
      page: 1,
      limit: 10,
      tests: [{ code: "A" }],
    });
  });

  it("creates order in postgres", async () => {
    const result = await LabOrderService.createOrder("IDEXX", {
      organisationId: "org-1",
      patientId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
    });

    expect(result).toEqual({ id: "order-1", status: "CREATED" });
    expect(adapter.createOrder).toHaveBeenCalled();
  });

  it("rejects unsupported provider for createOrder", async () => {
    await expect(
      LabOrderService.createOrder("BAD", {
        organisationId: "org-1",
        patientId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("throws when getOrder missing in postgres", async () => {
    (prisma.labOrder.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      LabOrderService.getOrder("IDEXX", "org-1", "id-1"),
    ).rejects.toThrow("Lab order not found.");
  });

  it("rejects invalid provider in listOrders", async () => {
    await expect(
      LabOrderService.listOrders({
        organisationId: "org-1",
        provider: "BAD",
      }),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("lists orders using postgres", async () => {
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([]);

    const result = await LabOrderService.listOrders({
      organisationId: "org-1",
      limit: 5,
    });

    expect(result).toEqual([]);
    expect(prisma.labOrder.findMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  });
});
