import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import {
  AvailabilityService,
  generateBookableWindows,
} from "../../src/services/availability.service";
import { prisma } from "src/config/prisma";

dayjs.extend(utc);

jest.mock("src/config/prisma", () => ({
  prisma: {
    baseAvailability: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    weeklyAvailabilityOverride: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    occupancy: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe("AvailabilityService", () => {
  const organisationId = "org-1";
  const userId = "user-1";
  const slot = {
    startTime: "09:00",
    endTime: "10:00",
    isAvailable: true,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("generateBookableWindows", () => {
    it("splits a slot into windows", () => {
      const windows = generateBookableWindows("2026-03-09", [slot], 30);

      expect(windows).toEqual([
        {
          startTime: "09:00",
          endTime: "09:30",
          isAvailable: true,
        },
        {
          startTime: "09:30",
          endTime: "10:00",
          isAvailable: true,
        },
      ]);
    });

    it("drops trailing partial windows", () => {
      const windows = generateBookableWindows(
        "2026-03-09",
        [{ startTime: "09:00", endTime: "09:45", isAvailable: true }],
        30,
      );

      expect(windows).toEqual([
        {
          startTime: "09:00",
          endTime: "09:30",
          isAvailable: true,
        },
      ]);
    });
  });

  describe("base availability", () => {
    it("setAllBaseAvailability writes and reads via prisma", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          dayOfWeek: "MONDAY",
          slots: [slot],
        },
      ]);

      const result = await AvailabilityService.setAllBaseAvailability(
        organisationId,
        userId,
        [{ dayOfWeek: "MONDAY", slots: [slot] }],
      );

      expect(prisma.baseAvailability.deleteMany).toHaveBeenCalledWith({
        where: { userId, organisationId },
      });
      expect(prisma.baseAvailability.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId,
            organisationId,
            dayOfWeek: "MONDAY",
            slots: [slot],
          },
        ],
      });
      expect(result).toEqual([{ dayOfWeek: "MONDAY", slots: [slot] }]);
    });

    it("getBaseAvailability reads via prisma", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        { dayOfWeek: "TUESDAY", slots: [slot] },
      ]);

      await expect(
        AvailabilityService.getBaseAvailability(organisationId, userId),
      ).resolves.toEqual([{ dayOfWeek: "TUESDAY", slots: [slot] }]);
    });

    it("getOrganisationBaseAvailability returns ids and metadata", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const updatedAt = new Date("2026-01-02T00:00:00Z");
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "row-1",
          userId,
          organisationId,
          dayOfWeek: "MONDAY",
          slots: [slot],
          createdAt,
          updatedAt,
        },
      ]);

      const result =
        await AvailabilityService.getOrganisationBaseAvailability(
          organisationId,
        );

      expect(result).toEqual([
        {
          _id: "row-1",
          userId,
          organisationId,
          dayOfWeek: "MONDAY",
          slots: [slot],
          createdAt,
          updatedAt,
        },
      ]);
    });

    it("deleteBaseAvailability deletes via prisma", async () => {
      await AvailabilityService.deleteBaseAvailability(organisationId, userId);

      expect(prisma.baseAvailability.deleteMany).toHaveBeenCalledWith({
        where: { organisationId, userId },
      });
    });
  });

  describe("weekly overrides", () => {
    it("creates or updates weekly overrides", async () => {
      (
        prisma.weeklyAvailabilityOverride.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        overrides: [
          {
            dayOfWeek: "MONDAY",
            slots: [slot],
          },
        ],
      });

      await AvailabilityService.addWeeklyAvailabilityOverride(
        organisationId,
        userId,
        new Date("2026-03-09T00:00:00Z"),
        { dayOfWeek: "TUESDAY", slots: [slot] },
      );

      expect(prisma.weeklyAvailabilityOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_organisationId_weekStartDate: {
              userId,
              organisationId,
              weekStartDate: new Date("2026-03-09T00:00:00.000Z"),
            },
          },
        }),
      );
    });

    it("reads and deletes weekly overrides", async () => {
      (
        prisma.weeklyAvailabilityOverride.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        overrides: [
          {
            dayOfWeek: "MONDAY",
            slots: [slot],
          },
        ],
      });

      await expect(
        AvailabilityService.getWeeklyAvailabilityOverride(
          organisationId,
          userId,
          new Date("2026-03-09T00:00:00Z"),
        ),
      ).resolves.toEqual({
        overrides: [{ dayOfWeek: "MONDAY", slots: [slot] }],
      });

      await AvailabilityService.deleteWeeklyAvailabilityOverride(
        organisationId,
        userId,
        new Date("2026-03-09T00:00:00Z"),
      );

      expect(prisma.weeklyAvailabilityOverride.deleteMany).toHaveBeenCalledWith(
        {
          where: {
            userId,
            organisationId,
            weekStartDate: new Date("2026-03-09T00:00:00.000Z"),
          },
        },
      );
    });
  });

  describe("occupancies", () => {
    it("creates occupancies", async () => {
      await AvailabilityService.addOccupancy(
        organisationId,
        userId,
        new Date("2026-03-09T09:00:00Z"),
        new Date("2026-03-09T10:00:00Z"),
        "APPOINTMENT",
        "ref-1",
      );

      expect(prisma.occupancy.create).toHaveBeenCalledWith({
        data: {
          userId,
          organisationId,
          startTime: new Date("2026-03-09T09:00:00Z"),
          endTime: new Date("2026-03-09T10:00:00Z"),
          sourceType: "APPOINTMENT",
          referenceId: "ref-1",
        },
      });
    });

    it("creates multiple occupancies and queries them", async () => {
      await AvailabilityService.addAllOccupancies(organisationId, userId, [
        {
          startTime: new Date("2026-03-09T09:00:00Z"),
          endTime: new Date("2026-03-09T10:00:00Z"),
          sourceType: "BLOCKED",
        },
      ]);

      expect(prisma.occupancy.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId,
            organisationId,
            sourceType: "BLOCKED",
          }),
        ],
      });

      (prisma.occupancy.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "occ-1" },
      ]);
      await expect(
        AvailabilityService.getOccupancy(
          organisationId,
          userId,
          new Date("2026-03-09T00:00:00Z"),
          new Date("2026-03-10T00:00:00Z"),
        ),
      ).resolves.toEqual([{ id: "occ-1" }]);
    });
  });

  describe("availability calculations", () => {
    it("merges base availability, overrides, and occupancies", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        { dayOfWeek: "MONDAY", slots: [slot] },
      ]);
      (
        prisma.weeklyAvailabilityOverride.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        overrides: [
          {
            dayOfWeek: "TUESDAY",
            slots: [slot],
          },
        ],
      });
      (prisma.occupancy.findMany as jest.Mock).mockResolvedValueOnce([
        {
          startTime: new Date("2026-03-09T09:30:00Z"),
          endTime: new Date("2026-03-09T09:45:00Z"),
        },
      ]);

      const result = await AvailabilityService.getWeeklyFinalAvailability(
        organisationId,
        userId,
        new Date("2026-03-09T00:00:00Z"),
      );

      expect(result.find((day) => day.dayOfWeek === "MONDAY")?.slots).toEqual([
        {
          startTime: "09:00",
          endTime: "09:30",
          isAvailable: true,
        },
        {
          startTime: "09:45",
          endTime: "10:00",
          isAvailable: true,
        },
      ]);
      expect(result.find((day) => day.dayOfWeek === "TUESDAY")?.slots).toEqual([
        slot,
      ]);
    });

    it("derives final availability, status, bookable windows and hours", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-09T09:15:00Z"));

      const finalSpy = jest
        .spyOn(AvailabilityService, "getFinalAvailabilityForDate")
        .mockResolvedValue({
          date: "2026-03-09",
          dayOfWeek: "MONDAY",
          slots: [slot],
        });
      (prisma.occupancy.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        AvailabilityService.getCurrentStatus(organisationId, userId),
      ).resolves.toBe("Available");

      await expect(
        AvailabilityService.getBookableSlotsForDate(
          organisationId,
          userId,
          30,
          new Date("2026-03-09T00:00:00Z"),
        ),
      ).resolves.toEqual({
        date: "2026-03-09",
        dayOfWeek: "MONDAY",
        windows: [
          {
            startTime: "09:00",
            endTime: "09:30",
            isAvailable: true,
          },
          {
            startTime: "09:30",
            endTime: "10:00",
            isAvailable: true,
          },
        ],
      });

      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        { dayOfWeek: "MONDAY", slots: [slot] },
      ]);
      (
        prisma.weeklyAvailabilityOverride.findFirst as jest.Mock
      ).mockResolvedValueOnce(null);
      (prisma.occupancy.findMany as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        AvailabilityService.getWeeklyWorkingHours(
          organisationId,
          userId,
          new Date("2026-03-09T00:00:00Z"),
        ),
      ).resolves.toBe(1);

      finalSpy.mockRestore();
      jest.useRealTimers();
    });

    it("returns consulting when occupied", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-09T09:15:00Z"));

      jest
        .spyOn(AvailabilityService, "getFinalAvailabilityForDate")
        .mockResolvedValue({
          date: "2026-03-09",
          dayOfWeek: "MONDAY",
          slots: [slot],
        });
      (prisma.occupancy.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "occ-1",
      });

      await expect(
        AvailabilityService.getCurrentStatus(organisationId, userId),
      ).resolves.toBe("Consulting");

      jest.useRealTimers();
    });
  });
});
