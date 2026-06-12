import { getMissingCompanionForeignKeyReason } from "../../src/scripts/migrate-all.helpers";

describe("getMissingCompanionForeignKeyReason", () => {
  const knownIds = new Set(["companion-1", "companion-2"]);

  it("returns null for unrelated models", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "Organization",
        { companionId: "companion-1" },
        knownIds,
      ),
    ).toBeNull();
  });

  it("returns null when the companion exists", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "Document",
        { companionId: "companion-1" },
        knownIds,
      ),
    ).toBeNull();
  });

  it("flags missing companionId values", () => {
    expect(getMissingCompanionForeignKeyReason("Document", {}, knownIds)).toBe(
      "missing companionId",
    );
    expect(
      getMissingCompanionForeignKeyReason(
        "Document",
        { companionId: "" },
        knownIds,
      ),
    ).toBe("missing companionId");
  });

  it("flags unknown companion references", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "CompanionOrganisation",
        { companionId: "missing-id" },
        knownIds,
      ),
    ).toBe("unknown companionId missing-id");
  });
});
