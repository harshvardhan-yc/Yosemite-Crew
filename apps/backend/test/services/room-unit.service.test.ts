import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma";
import { RoomUnitService } from "../../src/services/room-unit.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organisationRoom: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("RoomUnitService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a room unit", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue({
      id: "room_1",
      organisationId: "org_1",
    });
    mockedPrisma.roomUnit.create.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitService.create({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
    });

    expect(mockedPrisma.roomUnit.create).toHaveBeenCalled();
    expect(result.code).toBe("KEN-01");
  });

  it("lists room units", async () => {
    mockedPrisma.roomUnit.findMany.mockResolvedValue([
      {
        id: "unit_1",
        organisationId: "org_1",
        roomId: "room_1",
        code: "KEN-01",
        displayName: "Kennel 1",
        size: "M",
        speciesConstraints: ["dog"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await RoomUnitService.list({ organisationId: "org_1" });

    expect(results).toHaveLength(1);
    expect(results[0]?.displayName).toBe("Kennel 1");
  });
});
