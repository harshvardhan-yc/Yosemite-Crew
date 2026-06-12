import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma";
import { RoomUnitGroupService } from "../../src/services/room-unit-group.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organisationRoom: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("RoomUnitGroupService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue({
      id: "room_1",
      organisationId: "org_1",
      type: "INPATIENT",
    });
  });

  it("creates a room unit group for supported room types", async () => {
    mockedPrisma.roomUnitGroup.create.mockResolvedValue({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Dog ward",
      size: "Medium",
      unitCount: 2,
      speciesConstraints: ["dog"],
      capabilities: ["oxygen"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitGroupService.create({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Dog ward",
      size: "Medium",
      unitCount: 2,
      speciesConstraints: ["dog"],
      capabilities: ["oxygen"],
      isActive: true,
    });

    expect(mockedPrisma.roomUnitGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org_1",
          roomId: "room_1",
          unitCount: 2,
        }),
      }),
    );
    expect(result.unitCount).toBe(2);
  });

  it("rejects unit groups with unsupported room types", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
      id: "room_1",
      organisationId: "org_1",
      type: "EXAM_ROOM",
    });

    await expect(
      RoomUnitGroupService.create({
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Dog ward",
        unitCount: 2,
      }),
    ).rejects.toMatchObject({
      message:
        "Units are only supported for ICU, Inpatient, Isolation and Boarding rooms.",
      statusCode: 409,
    });
  });

  it("lists room unit groups", async () => {
    mockedPrisma.roomUnitGroup.findMany.mockResolvedValue([
      {
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Dog ward",
        size: "Medium",
        unitCount: 2,
        speciesConstraints: ["dog"],
        capabilities: ["oxygen"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await RoomUnitGroupService.list({
      organisationId: "org_1",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.unitCount).toBe(2);
  });

  it("deletes a room unit group within the same organisation", async () => {
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Dog ward",
      size: "Medium",
      unitCount: 2,
      speciesConstraints: ["dog"],
      capabilities: ["oxygen"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnitGroup.delete.mockResolvedValue({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Dog ward",
      size: "Medium",
      unitCount: 2,
      speciesConstraints: ["dog"],
      capabilities: ["oxygen"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitGroupService.delete("group_1", "org_1");

    expect(mockedPrisma.roomUnitGroup.delete).toHaveBeenCalledWith({
      where: { id: "group_1" },
    });
    expect(result.id).toBe("group_1");
  });
});
