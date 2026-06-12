export const modelsRequiringCompanionId = new Set([
  "CompanionOrganisation",
  "Document",
  "ParentCompanion",
]);

export const getMissingCompanionForeignKeyReason = (
  prismaName: string,
  data: Record<string, unknown>,
  existingCompanionIds: Set<string>,
): string | null => {
  if (!modelsRequiringCompanionId.has(prismaName)) {
    return null;
  }

  const companionId = data.companionId;
  if (typeof companionId !== "string" || companionId.trim().length === 0) {
    return "missing companionId";
  }

  if (!existingCompanionIds.has(companionId)) {
    return `unknown companionId ${companionId}`;
  }

  return null;
};
