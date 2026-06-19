import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

const SUPPORTED_SPECIES = [
  "SA",
  "LA",
  "FARM",
  "EXOTICS",
  "EQUINE",
  "AVIAN",
] as const;

const SUPPORTED_DOMAINS = [
  "ReasonForVisit",
  "PresentingComplaint",
  "DiagnosticTest",
  "Diagnosis",
  "Procedure",
] as const;

const ClinicalCodeSchema = z.object({
  system: z.string().trim().min(1),
  code: z.string().trim().min(1),
  display: z.string().trim().optional(),
  equivalence: z
    .enum(["equivalent", "related", "narrower", "broader", "inexact"])
    .default("equivalent"),
});

const ClinicalDesignationSchema = z.object({
  term: z.string().trim().min(1),
  lang: z.string().trim().default("en"),
  source: z.enum(["venom", "snomed", "local"]).default("local"),
  preferred: z.boolean().default(false),
});

const ClinicalConceptSchema = z.object({
  ycCode: z.string().trim().min(1),
  label: z.string().trim().min(1),
  domain: z.enum(SUPPORTED_DOMAINS),
  active: z.boolean().default(true),
  source: z.enum(["VeNom", "SNOMED", "local"]),
  designations: z.array(ClinicalDesignationSchema).default([]),
  codes: z.array(ClinicalCodeSchema).default([]),
  species: z.array(z.enum(SUPPORTED_SPECIES)).default([]),
});

const ClinicalConceptListSchema = z.array(ClinicalConceptSchema);

type ClinicalConcept = z.infer<typeof ClinicalConceptSchema>;

type CodeSystem = "YOSEMITECODE" | "VENOM" | "SNOMED";
type CodeType = "CLINICAL_TERM";
type ClinicalMappingInput = {
  sourceSystem: CodeSystem;
  sourceCode: string;
  targetSystem: Exclude<CodeSystem, "YOSEMITECODE">;
  targetCode: string;
  targetDisplay: string;
  targetVersion: null;
  active: boolean;
};

type ClinicalTermMeta = {
  domain?: ClinicalConcept["domain"];
  species?: ClinicalConcept["species"];
  source?: ClinicalConcept["source"];
  preferredTerm?: string | null;
  designations?: ClinicalConcept["designations"];
  codes?: ClinicalConcept["codes"];
};

const EXTERNAL_CODE_SYSTEM_MAP: Record<
  string,
  Exclude<CodeSystem, "YOSEMITECODE">
> = {
  "urn:venom": "VENOM",
  venom: "VENOM",
  "http://snomed.info/sct": "SNOMED",
  "https://snomed.info/sct": "SNOMED",
  snomed: "SNOMED",
};

const normalizeCodeSystem = (
  system: string,
): Exclude<CodeSystem, "YOSEMITECODE"> | null =>
  EXTERNAL_CODE_SYSTEM_MAP[system.trim().toLowerCase()] ?? null;

const toUniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(trimmed);
  }

  return items;
};

const getPreferredDesignation = (concept: ClinicalConcept) =>
  concept.designations.find((designation) => designation.preferred)?.term ??
  null;

const parseConcepts = (raw: unknown): ClinicalConcept[] =>
  ClinicalConceptListSchema.parse(raw);

const buildEntryData = (concept: ClinicalConcept) => ({
  system: "YOSEMITECODE" as CodeSystem,
  code: concept.ycCode,
  display: concept.label,
  type: "CLINICAL_TERM" as CodeType,
  active: concept.active,
  synonyms: toUniqueStrings([
    concept.label,
    ...concept.designations.map((designation) => designation.term),
  ]) as Prisma.InputJsonValue,
  meta: {
    domain: concept.domain,
    species: concept.species,
    source: concept.source,
    preferredTerm: getPreferredDesignation(concept),
    designations: concept.designations,
    codes: concept.codes,
  } satisfies ClinicalTermMeta as Prisma.InputJsonValue,
});

const buildMappingData = (concept: ClinicalConcept) =>
  concept.codes.flatMap((code): ClinicalMappingInput[] => {
    const targetSystem = normalizeCodeSystem(code.system);
    if (!targetSystem || code.equivalence !== "equivalent") return [];

    return [
      {
        sourceSystem: "YOSEMITECODE" as CodeSystem,
        sourceCode: concept.ycCode,
        targetSystem,
        targetCode: code.code,
        targetDisplay: code.display ?? concept.label,
        targetVersion: null,
        active: concept.active,
      },
    ];
  });

export const importClinicalTerms = async (filePath: string) => {
  const absolutePath = path.resolve(filePath);
  const rawText = fs.readFileSync(absolutePath, "utf-8");
  const concepts = parseConcepts(JSON.parse(rawText));

  let entriesUpserted = 0;
  let mappingsUpserted = 0;

  for (const concept of concepts) {
    const entry = buildEntryData(concept);

    await prisma.codeEntry.upsert({
      where: {
        system_code: {
          system: entry.system,
          code: entry.code,
        },
      },
      create: entry,
      update: {
        display: entry.display,
        type: entry.type,
        active: entry.active,
        synonyms: entry.synonyms,
        meta: entry.meta,
      },
    });
    entriesUpserted += 1;

    for (const mapping of buildMappingData(concept)) {
      await prisma.codeMapping.upsert({
        where: {
          sourceSystem_sourceCode_targetSystem_targetCode: {
            sourceSystem: mapping.sourceSystem,
            sourceCode: mapping.sourceCode,
            targetSystem: mapping.targetSystem,
            targetCode: mapping.targetCode,
          },
        },
        create: mapping,
        update: {
          targetDisplay: mapping.targetDisplay,
          targetVersion: mapping.targetVersion,
          active: mapping.active,
        },
      });
      mappingsUpserted += 1;
    }
  }

  return { entriesUpserted, mappingsUpserted };
};

const main = async () => {
  const inputPath =
    process.argv[2] ??
    process.env.CLINICAL_TERMS_INPUT ??
    path.resolve(process.cwd(), "data", "yc_concepts.json");

  try {
    const result = await importClinicalTerms(inputPath);
    logger.info("Clinical terms import complete", result);
  } finally {
    await prisma.$disconnect();
  }
};

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    logger.error("Clinical terms import failed", error);
    process.exit(1);
  });
}
