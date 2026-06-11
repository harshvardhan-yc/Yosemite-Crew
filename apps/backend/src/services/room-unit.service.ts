import { prisma } from "src/config/prisma";
import type { RoomUnit } from "@yosemite-crew/types";

type RoomRow = {
  id: string;
  organisationId: string;
};

type RoomUnitRow = {
  id: string;
  organisationId: string;
  roomId: string;
  code: string;
  displayName: string;
  size: string | null;
  speciesConstraints: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RoomUnitDelegate = {
  create(args: {
    data: {
      organisationId: string;
      roomId: string;
      code: string;
      displayName: string;
      size: string | null;
      speciesConstraints: unknown;
      isActive: boolean;
    };
  }): Promise<RoomUnitRow>;
  findUnique(args: { where: { id: string } }): Promise<RoomUnitRow | null>;
  findMany(args: {
    where: {
      organisationId?: string;
      roomId?: string;
      isActive?: boolean;
    };
    orderBy: { displayName: "asc" };
  }): Promise<RoomUnitRow[]>;
  update(args: {
    where: { id: string };
    data: {
      roomId?: string;
      code?: string;
      displayName?: string;
      size?: string | null;
      speciesConstraints?: unknown;
      isActive?: boolean;
    };
  }): Promise<RoomUnitRow>;
  delete(args: { where: { id: string } }): Promise<RoomUnitRow>;
};

export class RoomUnitServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "RoomUnitServiceError";
  }
}

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requireString = (value: string | undefined, field: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new RoomUnitServiceError(`${field} is required.`, 400);
  }

  return trimmed;
};

const toDomain = (row: RoomUnitRow): RoomUnit => ({
  id: row.id,
  organisationId: row.organisationId,
  roomId: row.roomId,
  code: row.code,
  displayName: row.displayName,
  size: row.size ?? undefined,
  speciesConstraints: Array.isArray(row.speciesConstraints)
    ? row.speciesConstraints.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : undefined,
  isActive: row.isActive,
});

const getRoomUnitDelegate = (): RoomUnitDelegate =>
  (prisma as unknown as { roomUnit: RoomUnitDelegate }).roomUnit;

const assertRoomExists = async (roomId: string, organisationId: string) => {
  const room = (await prisma.organisationRoom.findUnique({
    where: { id: roomId },
    select: { id: true, organisationId: true },
  })) as RoomRow | null;

  if (!room) {
    throw new RoomUnitServiceError("Organisation room not found.", 404);
  }

  if (room.organisationId !== organisationId) {
    throw new RoomUnitServiceError("Room organisation mismatch.", 409);
  }
};

export const RoomUnitService = {
  async create(input: RoomUnit): Promise<RoomUnit> {
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const roomId = requireString(input.roomId, "roomId");
    const code = requireString(input.code, "code");
    const displayName = requireString(input.displayName, "displayName");
    await assertRoomExists(roomId, organisationId);

    const created = await getRoomUnitDelegate().create({
      data: {
        organisationId,
        roomId,
        code,
        displayName,
        size: normalizeOptionalString(input.size) ?? null,
        speciesConstraints: input.speciesConstraints ?? [],
        isActive: input.isActive ?? true,
      },
    });

    return toDomain(created);
  },

  async update(id: string, input: Partial<RoomUnit>): Promise<RoomUnit> {
    const unitId = requireString(id, "unitId");
    const current = await getRoomUnitDelegate().findUnique({
      where: { id: unitId },
    });

    if (!current) {
      throw new RoomUnitServiceError("Room unit not found.", 404);
    }

    const roomId = normalizeOptionalString(input.roomId) ?? current.roomId;
    const organisationId = current.organisationId;
    await assertRoomExists(roomId, organisationId);

    const updated = await getRoomUnitDelegate().update({
      where: { id: unitId },
      data: {
        roomId,
        code: input.code ? requireString(input.code, "code") : undefined,
        displayName: input.displayName
          ? requireString(input.displayName, "displayName")
          : undefined,
        size:
          input.size === undefined
            ? undefined
            : (normalizeOptionalString(input.size) ?? null),
        speciesConstraints: input.speciesConstraints ?? undefined,
        isActive: input.isActive,
      },
    });

    return toDomain(updated);
  },

  async list(filters: {
    organisationId?: string;
    roomId?: string;
    isActive?: boolean;
  }): Promise<RoomUnit[]> {
    const rows = await getRoomUnitDelegate().findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        roomId: normalizeOptionalString(filters.roomId),
        isActive: filters.isActive,
      },
      orderBy: { displayName: "asc" },
    });

    return rows.map(toDomain);
  },

  async delete(id: string): Promise<RoomUnit> {
    const unitId = requireString(id, "unitId");
    const existing = await getRoomUnitDelegate().findUnique({
      where: { id: unitId },
    });

    if (!existing) {
      throw new RoomUnitServiceError("Room unit not found.", 404);
    }

    const deleted = await getRoomUnitDelegate().delete({
      where: { id: unitId },
    });

    return toDomain(deleted);
  },
};
