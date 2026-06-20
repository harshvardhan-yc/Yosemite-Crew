import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    observationToolDefinition: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  observationToolDefinition: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe("ObservationToolDefinitionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates required fields", async () => {
    await expect(
      ObservationToolDefinitionService.create({
        name: "",
        category: "",
        fields: [],
      }),
    ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
  });

  it("creates a definition in postgres", async () => {
    mockedPrisma.observationToolDefinition.create.mockResolvedValue({
      id: "tool-1",
    });

    const result = await ObservationToolDefinitionService.create({
      name: "Tool",
      description: "Desc",
      category: "Cat",
      fields: [
        {
          key: "a",
          label: "A",
          type: "TEXT",
          required: true,
          options: ["x"],
          scoring: { points: 2 },
        },
      ],
      scoringRules: { sumFields: ["a"] },
    });

    expect(mockedPrisma.observationToolDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Tool",
        description: "Desc",
        category: "Cat",
        isActive: true,
      }),
    });
    expect(result).toEqual({ id: "tool-1" });
  });

  it("updates a definition in postgres", async () => {
    mockedPrisma.observationToolDefinition.findFirst.mockResolvedValue({
      id: "tool-1",
      name: "Old",
      description: "Old",
      category: "Old",
      fields: [],
      scoringRules: null,
      isActive: true,
    });
    mockedPrisma.observationToolDefinition.update.mockResolvedValue({
      id: "tool-1",
      name: "New",
    });

    const result = await ObservationToolDefinitionService.update("tool-1", {
      name: "New",
    });

    expect(mockedPrisma.observationToolDefinition.update).toHaveBeenCalled();
    expect(result).toEqual({ id: "tool-1", name: "New" });
  });

  it("archives a definition in postgres", async () => {
    mockedPrisma.observationToolDefinition.findFirst.mockResolvedValue({
      id: "tool-1",
    });

    await ObservationToolDefinitionService.archive("tool-1");

    expect(mockedPrisma.observationToolDefinition.update).toHaveBeenCalledWith({
      where: { id: "tool-1" },
      data: { isActive: false },
    });
  });

  it("lists definitions with filters", async () => {
    mockedPrisma.observationToolDefinition.findMany.mockResolvedValue([
      { id: "tool-1" },
    ]);

    const result = await ObservationToolDefinitionService.list({
      category: "cat",
      onlyActive: true,
    });

    expect(
      mockedPrisma.observationToolDefinition.findMany,
    ).toHaveBeenCalledWith({
      where: { category: "cat", isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    expect(result).toEqual([{ id: "tool-1" }]);
  });

  it("returns tool by id", async () => {
    mockedPrisma.observationToolDefinition.findFirst.mockResolvedValue({
      id: "tool-1",
    });

    await expect(
      ObservationToolDefinitionService.getById("tool-1"),
    ).resolves.toEqual({ id: "tool-1" });
  });

  it("throws when tool missing", async () => {
    mockedPrisma.observationToolDefinition.findFirst.mockResolvedValue(null);

    await expect(
      ObservationToolDefinitionService.getById("tool-1"),
    ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
  });
});
