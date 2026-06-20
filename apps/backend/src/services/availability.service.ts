import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import type {
  DayOfWeek,
  AvailabilitySlotMongo,
} from "src/models/base-availability";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import type { UserAvailability } from "@yosemite-crew/types";

dayjs.extend(utc);

export class AvailabilityServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AvailabilityServiceError";
  }
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  const trimmed = asNonEmptyString(value);
  if (!trimmed) {
    throw new AvailabilityServiceError(`Invalid ${field}`);
  }
  return trimmed;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const ensureValidDate = (value: unknown, field: string): Date => {
  if (!isValidDate(value)) {
    throw new AvailabilityServiceError(`Invalid ${field}`);
  }
  return value;
};

function splitSlotAroundOccupancy(
  slot: AvailabilitySlotMongo,
  occStart: dayjs.Dayjs,
  occEnd: dayjs.Dayjs,
  dateStr: string,
): AvailabilitySlotMongo[] {
  const slotStart = dayjs.utc(`${dateStr}T${slot.startTime}:00`);
  const slotEnd = dayjs.utc(`${dateStr}T${slot.endTime}:00`);

  const overlaps = occStart.isBefore(slotEnd) && occEnd.isAfter(slotStart);
  if (!overlaps) return [slot];

  const results: AvailabilitySlotMongo[] = [];

  if (occStart.isAfter(slotStart)) {
    results.push({
      startTime: slotStart.format("HH:mm"),
      endTime: occStart.format("HH:mm"),
      isAvailable: true,
    });
  }

  if (occEnd.isBefore(slotEnd)) {
    results.push({
      startTime: occEnd.format("HH:mm"),
      endTime: slotEnd.format("HH:mm"),
      isAvailable: true,
    });
  }

  return results;
}

function getDateString(d: Date): string {
  return dayjs(d).utc().format("YYYY-MM-DD");
}

function getDayOfWeekFromDate(d: Date): DayOfWeek {
  return dayjs(d).utc().format("dddd").toUpperCase() as DayOfWeek;
}

function normalizeWeekStart(date: Date) {
  return dayjs(date)
    .utc()
    .startOf("week")
    .add(1, "day")
    .startOf("day")
    .toDate();
}

const toSlots = (value: Prisma.JsonValue): AvailabilitySlotMongo[] =>
  value as unknown as AvailabilitySlotMongo[];

const toOverrides = (
  value: Prisma.JsonValue | null,
): Array<{ dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] }> =>
  (value ?? []) as unknown as Array<{
    dayOfWeek: DayOfWeek;
    slots: AvailabilitySlotMongo[];
  }>;

const mapBaseAvailabilityRow = (row: {
  dayOfWeek: DayOfWeek;
  slots: Prisma.JsonValue;
}): { dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] } => ({
  dayOfWeek: row.dayOfWeek,
  slots: toSlots(row.slots),
});

const mapBaseAvailabilityOrgRow = (row: {
  id: string;
  userId: string;
  organisationId: string;
  dayOfWeek: DayOfWeek;
  slots: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): UserAvailability & { organisationId: string } => ({
  _id: row.id,
  userId: row.userId,
  organisationId: row.organisationId,
  dayOfWeek: row.dayOfWeek,
  slots: toSlots(row.slots),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureDaySlots = (
  availability: Array<{ dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] }>,
) => {
  for (const entry of availability) {
    if (!entry.dayOfWeek) {
      throw new AvailabilityServiceError("Invalid dayOfWeek");
    }
    if (!entry.slots || !Array.isArray(entry.slots) || !entry.slots.length) {
      throw new AvailabilityServiceError("Invalid slots");
    }
  }
};

function generateBookableWindows(
  date: string,
  slots: AvailabilitySlotMongo[],
  windowMinutes: number,
): AvailabilitySlotMongo[] {
  const results: AvailabilitySlotMongo[] = [];

  for (const slot of slots) {
    const start = dayjs.utc(`${date}T${slot.startTime}:00`);
    const end = dayjs.utc(`${date}T${slot.endTime}:00`);

    let cursor = start;

    while (
      cursor.add(windowMinutes, "minute").isSame(end) ||
      cursor.add(windowMinutes, "minute").isBefore(end)
    ) {
      const windowStart = cursor;
      const windowEnd = cursor.add(windowMinutes, "minute");

      results.push({
        startTime: windowStart.format("HH:mm"),
        endTime: windowEnd.format("HH:mm"),
        isAvailable: true,
      });

      cursor = windowEnd;
    }
  }

  return results;
}

export const AvailabilityService = {
  async setAllBaseAvailability(
    organisationId: string,
    userId: string,
    availabilities: {
      dayOfWeek: DayOfWeek;
      slots: AvailabilitySlotMongo[];
    }[],
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    ensureDaySlots(availabilities);

    const rows = availabilities.map((a) => ({
      organisationId: safeOrganisationId,
      userId: safeUserId,
      dayOfWeek: a.dayOfWeek,
      slots: a.slots,
    }));

    await prisma.baseAvailability.deleteMany({
      where: { userId: safeUserId, organisationId: safeOrganisationId },
    });

    if (rows.length) {
      await prisma.baseAvailability.createMany({
        data: rows.map((row) => ({
          userId: row.userId,
          organisationId: row.organisationId,
          dayOfWeek: row.dayOfWeek,
          slots: row.slots as unknown as Prisma.InputJsonValue,
        })),
      });
    }

    const created = await prisma.baseAvailability.findMany({
      where: { userId: safeUserId, organisationId: safeOrganisationId },
      orderBy: { dayOfWeek: "asc" },
    });

    return created.map(mapBaseAvailabilityRow);
  },

  async getBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    const rows = await prisma.baseAvailability.findMany({
      where: { organisationId: safeOrganisationId, userId: safeUserId },
      orderBy: { dayOfWeek: "asc" },
    });

    return rows.map(mapBaseAvailabilityRow);
  },

  async getOrganisationBaseAvailability(organisationId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );

    const rows = await prisma.baseAvailability.findMany({
      where: { organisationId: safeOrganisationId },
      orderBy: [{ userId: "asc" }, { dayOfWeek: "asc" }],
    });

    return rows.map(mapBaseAvailabilityOrgRow);
  },

  async deleteBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    await prisma.baseAvailability.deleteMany({
      where: { organisationId: safeOrganisationId, userId: safeUserId },
    });
  },

  async addWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
    override: { dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] },
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");
    const weekStartDate = normalizeWeekStart(safeWeekDate);

    const existing = await prisma.weeklyAvailabilityOverride.findFirst({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate,
      },
    });

    const overrides = toOverrides(existing?.overrides ?? null);
    const idx = overrides.findIndex((o) => o.dayOfWeek === override.dayOfWeek);

    if (idx >= 0) {
      overrides[idx] = override;
    } else {
      overrides.push(override);
    }

    await prisma.weeklyAvailabilityOverride.upsert({
      where: {
        userId_organisationId_weekStartDate: {
          userId: safeUserId,
          organisationId: safeOrganisationId,
          weekStartDate,
        },
      },
      create: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate,
        overrides: overrides as unknown as Prisma.InputJsonValue,
      },
      update: {
        overrides: overrides as unknown as Prisma.InputJsonValue,
      },
    });
  },

  async getWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");

    const override = await prisma.weeklyAvailabilityOverride.findFirst({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate: normalizeWeekStart(safeWeekDate),
      },
    });

    if (!override) return null;

    return {
      overrides: toOverrides(override.overrides),
    };
  },

  async deleteWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");

    await prisma.weeklyAvailabilityOverride.deleteMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate: normalizeWeekStart(safeWeekDate),
      },
    });
  },

  async addOccupancy(
    organisationId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
    sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY",
    referenceId?: string,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeStartTime = ensureValidDate(startTime, "startTime");
    const safeEndTime = ensureValidDate(endTime, "endTime");

    await prisma.occupancy.create({
      data: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: safeStartTime,
        endTime: safeEndTime,
        sourceType,
        referenceId: referenceId ?? undefined,
      },
    });
  },

  async addAllOccupancies(
    organisationId: string,
    userId: string,
    items: {
      startTime: Date;
      endTime: Date;
      sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY";
      referenceId?: string;
    }[],
  ): Promise<void> {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    if (!items.length) return;

    await prisma.occupancy.createMany({
      data: items.map((item) => ({
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: ensureValidDate(item.startTime, "startTime"),
        endTime: ensureValidDate(item.endTime, "endTime"),
        sourceType: item.sourceType,
        referenceId: item.referenceId ?? undefined,
      })),
    });
  },

  async getOccupancy(
    organisationId: string,
    userId: string,
    from: Date,
    to: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeFrom = ensureValidDate(from, "from");
    const safeTo = ensureValidDate(to, "to");

    return prisma.occupancy.findMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: { lt: safeTo },
        endTime: { gt: safeFrom },
      },
    });
  },

  async getWeeklyFinalAvailability(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const weekStart = dayjs(safeReferenceDate)
      .utc()
      .startOf("week")
      .add(1, "day")
      .startOf("day")
      .toDate();

    const weekDates = Array.from({ length: 7 }).map((_, i) => {
      const d = dayjs(weekStart).add(i, "day").toDate();
      return {
        date: d,
        dateStr: getDateString(d),
        dayOfWeek: getDayOfWeekFromDate(d),
      };
    });

    const base = await this.getBaseAvailability(safeOrganisationId, safeUserId);
    const map = new Map<DayOfWeek, AvailabilitySlotMongo[]>();

    for (const row of base) {
      map.set(row.dayOfWeek, row.slots);
    }

    const override = await this.getWeeklyAvailabilityOverride(
      safeOrganisationId,
      safeUserId,
      weekStart,
    );

    if (override) {
      for (const ov of override.overrides) {
        map.set(ov.dayOfWeek, ov.slots);
      }
    }

    const weekEnd = dayjs(weekStart).add(7, "day").endOf("day").toDate();

    const occupancies = await prisma.occupancy.findMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: { lte: weekEnd },
        endTime: { gte: weekStart },
      },
    });

    for (const occ of occupancies) {
      const occStart = dayjs(occ.startTime).utc();
      const occEnd = dayjs(occ.endTime).utc();
      const occDayStr = occStart.format("dddd").toUpperCase() as DayOfWeek;
      const slots = map.get(occDayStr) || [];
      const dateStr = occStart.format("YYYY-MM-DD");

      const newSlots: AvailabilitySlotMongo[] = [];

      for (const slot of slots) {
        const split = splitSlotAroundOccupancy(slot, occStart, occEnd, dateStr);
        newSlots.push(...split);
      }

      map.set(occDayStr, newSlots);
    }

    return weekDates.map((w) => ({
      date: w.dateStr,
      dayOfWeek: w.dayOfWeek,
      slots: map.get(w.dayOfWeek) || [],
    }));
  },

  async getFinalAvailabilityForDate(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ) {
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const week = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      safeReferenceDate,
    );

    const dayOfWeek = getDayOfWeekFromDate(safeReferenceDate);
    const dateStr = getDateString(safeReferenceDate);

    const dayEntry = week.find((d) => d.dayOfWeek === dayOfWeek);

    return {
      date: dateStr,
      dayOfWeek,
      slots: dayEntry?.slots ?? [],
    };
  },

  async getCurrentStatus(
    organisationId: string,
    userId: string,
  ): Promise<"Consulting" | "Available" | "Off-Duty" | "Unavailable"> {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    const nowUtc = dayjs.utc();
    const today = nowUtc.toDate();

    const { slots, date } = await this.getFinalAvailabilityForDate(
      safeOrganisationId,
      safeUserId,
      today,
    );

    const occupied = await prisma.occupancy.findFirst({
      where: {
        organisationId: safeOrganisationId,
        userId: safeUserId,
        startTime: { lte: nowUtc.toDate() },
        endTime: { gte: nowUtc.toDate() },
      },
      select: { id: true },
    });

    if (occupied) return "Consulting";

    const activeSlot = slots.find((s) => {
      const slotStart = dayjs.utc(`${date}T${s.startTime}:00`);
      const slotEnd = dayjs.utc(`${date}T${s.endTime}:00`);
      const startsNowOrEarlier =
        nowUtc.isSame(slotStart) || nowUtc.isAfter(slotStart);
      return startsNowOrEarlier && nowUtc.isBefore(slotEnd);
    });

    if (activeSlot) return "Available";
    if (slots.length === 0) return "Off-Duty";

    return "Unavailable";
  },

  async getBookableSlotsForDate(
    organisationId: string,
    userId: string,
    windowMinutes: number,
    referenceDate: Date,
  ) {
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const finalForDate = await this.getFinalAvailabilityForDate(
      organisationId,
      userId,
      safeReferenceDate,
    );

    const dateStr = finalForDate.date;
    const slots = finalForDate.slots;
    const windows = generateBookableWindows(dateStr, slots, windowMinutes);

    return {
      date: dateStr,
      dayOfWeek: finalForDate.dayOfWeek,
      windows,
    };
  },

  async getWeeklyWorkingHours(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ): Promise<number> {
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const weekly = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      safeReferenceDate,
    );

    let totalMinutes = 0;

    for (const day of weekly) {
      for (const slot of day.slots) {
        const start = dayjs.utc(`${day.date}T${slot.startTime}:00`);
        const end = dayjs.utc(`${day.date}T${slot.endTime}:00`);
        const diff = end.diff(start, "minute");
        if (diff > 0) totalMinutes += diff;
      }
    }

    return totalMinutes / 60;
  },
};

export { generateBookableWindows };
