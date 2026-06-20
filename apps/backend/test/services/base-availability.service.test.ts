import { BaseAvailabilityService } from "../../src/services/base-availability.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    baseAvailability: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("BaseAvailabilityService", () => {
  const mockUserId = "user_123";
  const validSlot = {
    startTime: "09:00",
    endTime: "17:00",
    isAvailable: true,
  };
  const validAvailability = [
    { dayOfWeek: "MONDAY" as const, slots: [validSlot] },
    { dayOfWeek: "TUESDAY" as const, slots: [validSlot] },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("validates the payload", async () => {
      await expect(
        BaseAvailabilityService.create({
          userId: 123,
          availability: validAvailability,
        }),
      ).rejects.toThrow("User id is required.");

      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: [],
        }),
      ).rejects.toThrow("Availability cannot be empty.");

      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: [{}],
        }),
      ).rejects.toThrow("Availability[0].dayOfWeek is required.");
    });

    it("creates availability rows in postgres", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "row-1",
          userId: mockUserId,
          organisationId: "org-1",
          dayOfWeek: "MONDAY",
          slots: [validSlot],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "row-2",
          userId: mockUserId,
          organisationId: "org-1",
          dayOfWeek: "TUESDAY",
          slots: [validSlot],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: [
          { ...validAvailability[0], organisationId: "org-1" },
          { ...validAvailability[1], organisationId: "org-1" },
        ],
      });

      expect(prisma.baseAvailability.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { id: true },
      });
      expect(prisma.baseAvailability.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: mockUserId,
            organisationId: "org-1",
            dayOfWeek: "MONDAY",
          }),
        ]),
      });
      expect(result).toHaveLength(2);
      expect(result[0].dayOfWeek).toBe("MONDAY");
    });

    it("rejects duplicate schedules", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "existing",
      });

      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: [{ ...validAvailability[0], organisationId: "org-1" }],
        }),
      ).rejects.toThrow("Base availability already exists for this user.");
    });
  });

  describe("update", () => {
    it("validates the payload", async () => {
      await expect(
        BaseAvailabilityService.update(mockUserId, { availability: {} }),
      ).rejects.toThrow("Availability must be an array.");
    });

    it("replaces existing availability rows", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "row-1",
          userId: mockUserId,
          organisationId: "org-1",
          dayOfWeek: "MONDAY",
          slots: [validSlot],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await BaseAvailabilityService.update(mockUserId, {
        availability: [{ ...validAvailability[1], organisationId: "org-1" }],
      });

      expect(prisma.baseAvailability.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(prisma.baseAvailability.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: mockUserId,
            organisationId: "org-1",
            dayOfWeek: "TUESDAY",
          }),
        ]),
      });
      expect(result).toHaveLength(1);
      expect(result[0].dayOfWeek).toBe("MONDAY");
    });
  });

  describe("getByUserId", () => {
    it("queries postgres for the user's availability", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "row-1",
          userId: mockUserId,
          organisationId: "org-1",
          dayOfWeek: "MONDAY",
          slots: [validSlot],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await BaseAvailabilityService.getByUserId(mockUserId);

      expect(prisma.baseAvailability.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { dayOfWeek: "asc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].dayOfWeek).toBe("MONDAY");
    });
  });
});
