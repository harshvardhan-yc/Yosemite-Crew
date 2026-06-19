import { LabResultService } from "../../src/services/lab-result.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    labResult: { findMany: jest.fn(), findFirst: jest.fn() },
    labOrder: { findMany: jest.fn() },
  },
}));

describe("LabResultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.labResult.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.labResult.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("lists using postgres filters", async () => {
    await LabResultService.list({
      organisationId: "org",
      provider: "IDEXX",
      orderId: "order",
      limit: 10,
    });

    expect(prisma.labResult.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org",
        provider: "IDEXX",
        orderId: "order",
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
  });

  it("uses patientId to derive order ids in postgres", async () => {
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([
      { idexxOrderId: "o1" },
      { idexxOrderId: null },
    ]);

    await LabResultService.list({
      patientId: "507f191e810c19729de860ea",
    });

    expect(prisma.labOrder.findMany).toHaveBeenCalled();
    expect(prisma.labResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: { in: ["o1"] } },
      }),
    );
  });

  it("returns empty list when patientId resolves to no orders in postgres", async () => {
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([]);

    const results = await LabResultService.list({
      patientId: "507f191e810c19729de860ea",
    });

    expect(results).toEqual([]);
    expect(prisma.labResult.findMany).not.toHaveBeenCalled();
  });

  it("uses patientId as a direct filter in postgres", async () => {
    await LabResultService.list({ patientId: "bad" });

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith({
      where: { patientId: "bad" },
      select: { idexxOrderId: true },
    });
  });

  it("gets by result id in postgres", async () => {
    await LabResultService.getByResultId("org", "IDEXX", "res");
    expect(prisma.labResult.findFirst).toHaveBeenCalledWith({
      where: { organisationId: "org", provider: "IDEXX", resultId: "res" },
    });
  });

  it("rejects invalid organisationId, provider or resultId", async () => {
    await expect(LabResultService.getByResultId("", "", "")).rejects.toThrow(
      "Invalid organisationId, provider or resultId",
    );
  });
});
