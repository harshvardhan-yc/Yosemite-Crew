import { CodeSyncService } from "../../src/services/code-sync.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    codeSyncState: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("CodeSyncService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("gets code sync state from postgres", async () => {
    mockedPrisma.codeSyncState.findFirst.mockResolvedValueOnce({
      system: "YOSEMITECODE",
      kind: "species",
    });

    const result = await CodeSyncService.get("YOSEMITECODE", "species");

    expect(mockedPrisma.codeSyncState.findFirst).toHaveBeenCalledWith({
      where: { system: "YOSEMITECODE", kind: "species" },
    });
    expect(result).toEqual({
      system: "YOSEMITECODE",
      kind: "species",
    });
  });

  it("upserts code sync state into postgres", async () => {
    mockedPrisma.codeSyncState.upsert.mockResolvedValueOnce({
      system: "YOSEMITECODE",
      kind: "species",
    });

    const result = await CodeSyncService.upsert({
      system: "YOSEMITECODE",
      kind: "species",
      version: "v1",
      lastSyncedAt: new Date("2024-01-01T00:00:00Z"),
    });

    expect(mockedPrisma.codeSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          system_kind: { system: "YOSEMITECODE", kind: "species" },
        },
      }),
    );
    expect(result).toEqual({
      system: "YOSEMITECODE",
      kind: "species",
    });
  });
});
