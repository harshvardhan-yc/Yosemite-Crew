import { TemplateKind } from "@prisma/client";
import {
  buildClinicalTemplateSchemaSnapshot,
  getClinicalTemplateBlueprint,
  validateClinicalTemplateBlueprint,
} from "../../src/services/clinical-template-blueprints";

describe("clinical template blueprints", () => {
  it("builds a SOAP note blueprint with the required sections", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");

    expect(snapshot.sections.map((section) => section.id)).toEqual([
      "subjective",
      "objective",
      "assessment",
      "plan",
    ]);
  });

  it("returns the prescription blueprint with medication and instruction sections", () => {
    const blueprint = getClinicalTemplateBlueprint("PRESCRIPTION");

    expect(blueprint.sections.map((section) => section.id)).toEqual([
      "medications",
      "instructions",
      "notes",
    ]);
    expect(blueprint.sections[0].fields[0].type).toBe("medicationLine");
  });

  it("accepts a valid vital-record schema and rejects missing sections", () => {
    const valid = validateClinicalTemplateBlueprint(TemplateKind.VITAL_RECORD, {
      sections: [
        { id: "measured_at" },
        { id: "vitals" },
        { id: "notes" },
        { id: "metadata" },
      ],
    });

    expect(valid.missingSectionIds).toHaveLength(0);

    const invalid = validateClinicalTemplateBlueprint(
      TemplateKind.VITAL_RECORD,
      {
        sections: [{ id: "measured_at" }],
      },
    );

    expect(invalid.missingSectionIds).toEqual(["vitals", "notes", "metadata"]);
  });

  it("ignores non-clinical template kinds", () => {
    const result = validateClinicalTemplateBlueprint(TemplateKind.FORM, {
      sections: [],
    });

    expect(result.missingSectionIds).toHaveLength(0);
    expect(result.requiredSectionIds).toHaveLength(0);
  });
});
