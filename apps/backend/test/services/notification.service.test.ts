import { NotificationService } from "../../src/services/notification.service";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import logger from "../../src/utils/logger";
import { NotificationPayload } from "../../src/utils/notificationTemplates";
import { prisma } from "src/config/prisma";

const mockSend = jest.fn();
jest.mock("firebase-admin", () => ({
  __esModule: true,
  default: {
    messaging: jest.fn(() => ({
      send: mockSend,
    })),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {
    removeToken: jest.fn(),
    getTokensForUser: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("NotificationService", () => {
  const payload: NotificationPayload = {
    title: "Test Title",
    body: "Test Body",
    type: "TEST_TYPE" as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendToDevice", () => {
    it("returns error if token is missing or empty", async () => {
      const res = await NotificationService.sendToDevice("   ", payload);
      expect(res).toEqual({
        token: "   ",
        success: false,
        error: "Invalid token",
      });
    });

    it("successfully sends a push notification", async () => {
      mockSend.mockResolvedValueOnce("message-id-123");

      const res = await NotificationService.sendToDevice(
        "valid-token",
        payload,
        {
          data: { custom: "data" },
          dryRun: true,
        },
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "valid-token",
          notification: { title: "Test Title", body: "Test Body" },
          data: { custom: "data" },
        }),
        true,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Notification sent"),
      );
      expect(res).toEqual({ token: "valid-token", success: true });
    });

    it("removes invalid registration tokens", async () => {
      mockSend.mockRejectedValueOnce({
        code: "messaging/invalid-registration-token",
      });
      (DeviceTokenService.removeToken as jest.Mock).mockResolvedValueOnce(true);

      const res = await NotificationService.sendToDevice("bad-token", payload);

      expect(DeviceTokenService.removeToken).toHaveBeenCalledWith("bad-token");
      expect(res.success).toBe(false);
    });
  });

  describe("sendToUser", () => {
    it("returns empty array and logs if no tokens found", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce(
        [],
      );

      const res = await NotificationService.sendToUser("user1", payload);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("No device tokens found"),
      );
      expect(res).toEqual([]);
    });

    it("sends notifications and stores records in postgres", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-1" },
      ]);
      mockSend.mockResolvedValue("msg-id");
      (mockedPrisma.notification.create as jest.Mock).mockResolvedValueOnce({
        id: "notif-1",
      });

      const res = await NotificationService.sendToUser("user1", payload);

      await new Promise(process.nextTick);

      expect(res).toHaveLength(1);
      expect(mockedPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user1",
            title: payload.title,
            body: payload.body,
          }),
        }),
      );
    });
  });

  describe("listNotificationsForUser", () => {
    it("returns notifications from prisma", async () => {
      (mockedPrisma.notification.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "notif1", userId: "user1" },
      ]);

      const res = await NotificationService.listNotificationsForUser("user1");

      expect(mockedPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        orderBy: { createdAt: "desc" },
      });
      expect(res).toHaveLength(1);
    });
  });

  describe("markNotificationAsSeen", () => {
    it("updates notification via prisma", async () => {
      await NotificationService.markNotificationAsSeen("notif-1");

      expect(mockedPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { isSeen: true },
      });
    });
  });
});
