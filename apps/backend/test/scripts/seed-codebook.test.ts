import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeEntry: {
      upsert: jest.fn(),
    },
    codeMapping: {
      upsert: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedPrisma = prisma as any;

describe("seedCodebook", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("seeds species and breed data into postgres", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codebook-"));
    fs.writeFileSync(
      path.join(dir, "canine_breeds.json"),
      JSON.stringify([
        {
          species: "canine",
          speciesCode: 15461,
          venomId: 12969,
          name: "Abruzzenhund",
          slug: "abruzzenhund",
          active: true,
          synonyms: [],
          type: "PUREBRED",
          flags: { isCross: false, isUnspecified: false },
        },
      ]),
    );
    fs.writeFileSync(path.join(dir, "feline_breeds.json"), "[]");
    fs.writeFileSync(path.join(dir, "equine_breeds.json"), "[]");

    const { seedCodebook } = await import("../../src/scripts/seed-codebook");
    await seedCodebook(dir);

    expect(mockedPrisma.codeEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          system_code: { system: "YOSEMITECODE", code: "YSPEC:CANINE" },
        },
        create: expect.objectContaining({
          display: "Canine",
          type: "SPECIES",
          active: true,
        }),
      }),
    );
    expect(mockedPrisma.codeEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          system_code: {
            system: "YOSEMITECODE",
            code: "YBREED:CANINE:ABRUZZENHUND",
          },
        },
        create: expect.objectContaining({
          display: "Abruzzenhund",
          type: "BREED",
        }),
      }),
    );
    expect(mockedPrisma.codeMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceSystem_sourceCode_targetSystem_targetCode: {
            sourceSystem: "YOSEMITECODE",
            sourceCode: "YBREED:CANINE:ABRUZZENHUND",
            targetSystem: "VENOM",
            targetCode: "12969",
          },
        },
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("throws when an expected seed file is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codebook-missing-"));
    fs.writeFileSync(path.join(dir, "canine_breeds.json"), "[]");
    fs.writeFileSync(path.join(dir, "feline_breeds.json"), "[]");

    const { seedCodebook } = await import("../../src/scripts/seed-codebook");

    await expect(seedCodebook(dir)).rejects.toThrow(
      /Missing seed file: .*equine_breeds\.json/,
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
