import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

type BreedSeedItem = {
  species: "canine" | "feline" | "equine";
  speciesCode: number;
  venomId: number;
  name: string;
  slug: string;
  active: boolean;
  synonyms: string[];
  type: "PUREBRED" | "CROSS" | "UNSPECIFIED";
  flags: { isCross: boolean; isUnspecified: boolean };
};

type CodeSystem = "YOSEMITECODE" | "VENOM";
type CodeType = "SPECIES" | "BREED";

const SPECIES_DISPLAY: Record<BreedSeedItem["species"], string> = {
  canine: "Canine",
  feline: "Feline",
  equine: "Equine",
};

const buildSpeciesCode = (species: BreedSeedItem["species"]) =>
  `YSPEC:${species.toUpperCase()}`;

const buildBreedCode = (species: BreedSeedItem["species"], slug: string) =>
  `YBREED:${species.toUpperCase()}:${slug.toUpperCase()}`;

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const upsertCodeEntry = async (input: {
  system: CodeSystem;
  code: string;
  display: string;
  type: CodeType;
  active: boolean;
  synonyms: string[];
  meta: Prisma.InputJsonValue;
}) => {
  await prisma.codeEntry.upsert({
    where: {
      system_code: {
        system: input.system,
        code: input.code,
      },
    },
    create: input,
    update: {
      display: input.display,
      type: input.type,
      active: input.active,
      synonyms: input.synonyms as Prisma.InputJsonValue,
      meta: input.meta,
    },
  });
};

const upsertCodeMapping = async (input: {
  sourceSystem: CodeSystem;
  sourceCode: string;
  targetSystem: Exclude<CodeSystem, "YOSEMITECODE">;
  targetCode: string;
  targetDisplay: string | null;
  targetVersion: string | null;
  active: boolean;
}) => {
  await prisma.codeMapping.upsert({
    where: {
      sourceSystem_sourceCode_targetSystem_targetCode: {
        sourceSystem: input.sourceSystem,
        sourceCode: input.sourceCode,
        targetSystem: input.targetSystem,
        targetCode: input.targetCode,
      },
    },
    create: input,
    update: {
      targetDisplay: input.targetDisplay,
      targetVersion: input.targetVersion,
      active: input.active,
    },
  });
};

const seedSpecies = async (species: BreedSeedItem["species"]) => {
  const code = buildSpeciesCode(species);
  const display = SPECIES_DISPLAY[species];

  await upsertCodeEntry({
    system: "YOSEMITECODE",
    code,
    display,
    type: "SPECIES",
    active: true,
    synonyms: [],
    meta: { source: "seed" },
  });
};

const seedBreedsFromFile = async (filePath: string) => {
  const items = readJson<BreedSeedItem[]>(filePath);

  for (const item of items) {
    const speciesCode = buildSpeciesCode(item.species);
    const breedCode = buildBreedCode(item.species, item.slug);

    await upsertCodeEntry({
      system: "YOSEMITECODE",
      code: breedCode,
      display: item.name,
      type: "BREED",
      active: item.active,
      synonyms: item.synonyms,
      meta: {
        species: item.species,
        speciesCode,
        breedType: item.type,
        flags: item.flags,
      },
    });

    await upsertCodeMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode: breedCode,
      targetSystem: "VENOM",
      targetCode: String(item.venomId),
      targetDisplay: item.name,
      targetVersion: null,
      active: true,
    });
  }
};

export const seedCodebook = async (inputDir: string) => {
  const files = [
    "canine_breeds.json",
    "feline_breeds.json",
    "equine_breeds.json",
  ];

  for (const species of ["canine", "feline", "equine"] as const) {
    await seedSpecies(species);
  }

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing seed file: ${filePath}`);
    }
    await seedBreedsFromFile(filePath);
  }
};

const main = async () => {
  const inputDir =
    process.argv[2] ??
    process.env.CODEBOOK_INPUT_DIR ??
    path.join(process.cwd(), "data");

  try {
    await seedCodebook(inputDir);
    logger.info("Codebook seed complete");
  } finally {
    await prisma.$disconnect();
  }
};

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    logger.error("Codebook seed failed", error);
    process.exit(1);
  });
}
