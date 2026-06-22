import { describe, expect, it } from "@jest/globals";
import { DEFAULT_LIBRARY_TEMPLATE_SEEDS } from "../../src/scripts/template-library-seed.data";

describe("template-library-seed", () => {
  it("defines default library templates for clinical resolution", () => {
    expect(DEFAULT_LIBRARY_TEMPLATE_SEEDS).toHaveLength(4);

    const soap = DEFAULT_LIBRARY_TEMPLATE_SEEDS.find(
      (seed) => seed.kind === "SOAP_NOTE",
    );
    expect(soap).toBeDefined();
    expect(soap).toEqual(
      expect.objectContaining({
        ownership: "YC_LIBRARY",
        scope: "ORGANISATION",
        rules: {
          appliesTo: {
            defaultForKind: true,
          },
        },
      }),
    );
    expect(soap?.schemaSnapshot.sections).toHaveLength(1);
    expect(soap?.schemaSnapshot.sections[0]?.id).toBe("soap");
    expect(
      soap?.schemaSnapshot.sections[0]?.fields.map((field) => field.key),
    ).toEqual(["subjective", "objective", "assessment", "plan"]);
    expect(
      soap?.schemaSnapshot.sections[0]?.fields.every(
        (field) => field.type === "richText",
      ),
    ).toBe(true);
  });
});
