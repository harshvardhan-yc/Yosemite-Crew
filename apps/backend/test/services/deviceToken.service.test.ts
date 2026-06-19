import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    deviceToken: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("DeviceTokenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerToken", () => {
    it("skips when device token is missing", async () => {
      await DeviceTokenService.registerToken("user-1", "", "ios");

      expect(mockedPrisma.deviceToken.upsert).not.toHaveBeenCalled();
    });

    it("upserts token with platform", async () => {
      await DeviceTokenService.registerToken("user-1", "token-123", "android");

      expect(mockedPrisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { deviceToken: "token-123" },
        create: {
          userId: "user-1",
          deviceToken: "token-123",
          platform: "android",
          isActive: true,
        },
        update: {
          userId: "user-1",
          platform: "android",
          isActive: true,
        },
      });
    });
  });

  describe("getTokensForUser", () => {
    it("maps prisma tokens to response shape", async () => {
      mockedPrisma.deviceToken.findMany.mockResolvedValueOnce([
        {
          id: "t1",
          userId: "user-1",
          deviceToken: "abc",
          platform: "ios",
          isActive: true,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
        },
      ]);

      const result = await DeviceTokenService.getTokensForUser("user-1");

      expect(mockedPrisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(result).toEqual([
        expect.objectContaining({
          _id: "t1",
          userId: "user-1",
          deviceToken: "abc",
          platform: "ios",
          isActive: true,
        }),
      ]);
    });
  });

  describe("removeToken", () => {
    it("removes token by value", async () => {
      await DeviceTokenService.removeToken("token-1");

      expect(mockedPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { deviceToken: "token-1" },
      });
    });
  });
});
