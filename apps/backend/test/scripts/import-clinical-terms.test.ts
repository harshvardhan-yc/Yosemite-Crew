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

describe("importClinicalTerms", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("upserts clinical terms and equivalent mappings into postgres", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clinical-terms-"));
    const filePath = path.join(dir, "yc_concepts.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        {
          ycCode: "YC-000001",
          label: "Abdominal wall rupture",
          domain: "Diagnosis",
          active: true,
          source: "VeNom",
          designations: [
            {
              term: "Abdominal wall rupture",
              lang: "en",
              source: "venom",
              preferred: true,
            },
          ],
          codes: [
            {
              system: "urn:venom",
              code: "326",
              display: "Abdominal wall rupture",
              equivalence: "equivalent",
            },
            {
              system: "urn:venom",
              code: "999",
              display: "Ignore me",
              equivalence: "related",
            },
          ],
          species: ["LA", "SA"],
        },
      ]),
    );

    const { importClinicalTerms } =
      await import("../../src/scripts/import-clinical-terms");

    const result = await importClinicalTerms(filePath);

    expect(result).toEqual({ entriesUpserted: 1, mappingsUpserted: 1 });
    expect(mockedPrisma.codeEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          system_code: { system: "YOSEMITECODE", code: "YC-000001" },
        },
        create: expect.objectContaining({
          system: "YOSEMITECODE",
          code: "YC-000001",
          display: "Abdominal wall rupture",
          type: "CLINICAL_TERM",
          active: true,
        }),
      }),
    );
    expect(mockedPrisma.codeMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceSystem_sourceCode_targetSystem_targetCode: {
            sourceSystem: "YOSEMITECODE",
            sourceCode: "YC-000001",
            targetSystem: "VENOM",
            targetCode: "326",
          },
        },
        create: expect.objectContaining({
          targetDisplay: "Abdominal wall rupture",
          active: true,
        }),
      }),
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
