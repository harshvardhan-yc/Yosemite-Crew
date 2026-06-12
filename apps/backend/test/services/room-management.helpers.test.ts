import { describe, expect, it } from "@jest/globals";
import {
  normalizeReferenceMappings,
  normalizeRoomOccupancyStatus,
  normalizeRoomType,
  normalizeStringList,
  normalizeStrictStringList,
  optionalNonEmptyString,
  requireNonEmptyString,
  roomTypeSupportsUnits,
  RoomValidationError,
} from "../../src/services/room-management.helpers";

describe("room-management.helpers", () => {
  it("validates required strings", () => {
    expect(requireNonEmptyString("  room  ", "roomId")).toBe("room");
    expect(() => requireNonEmptyString(123, "roomId")).toThrow(
      RoomValidationError,
    );
    expect(() => requireNonEmptyString("   ", "roomId")).toThrow(
      "roomId is required.",
    );
    expect(() => requireNonEmptyString("bad$", "roomId")).toThrow(
      "Invalid character in roomId.",
    );
  });

  it("handles optional strings", () => {
    expect(optionalNonEmptyString(undefined)).toBeUndefined();
    expect(optionalNonEmptyString("  ")).toBeUndefined();
    expect(optionalNonEmptyString("  ward ")).toBe("ward");
    expect(() => optionalNonEmptyString(123)).toThrow("Invalid string value.");
  });

  it("normalizes string lists", () => {
    expect(normalizeStringList([" a ", "", "b", "a", 1 as never])).toEqual([
      "a",
      "b",
    ]);
  });

  it("normalizes strict string lists", () => {
    expect(normalizeStrictStringList(null, "capabilities")).toEqual([]);
    expect(
      normalizeStrictStringList([" a ", "b", "a"], "capabilities"),
    ).toEqual(["a", "b"]);
    expect(() => normalizeStrictStringList("bad", "capabilities")).toThrow(
      "capabilities must be an array.",
    );
    expect(() =>
      normalizeStrictStringList([1 as never], "capabilities"),
    ).toThrow("capabilities at index 0 must be a string.");
    expect(() => normalizeStrictStringList(["   "], "capabilities")).toThrow(
      "capabilities at index 0 cannot be empty.",
    );
  });

  it("normalizes reference mappings", () => {
    expect(normalizeReferenceMappings(null, "speciesConstraints")).toEqual([]);
    expect(
      normalizeReferenceMappings(
        [
          { id: " a ", name: " Alpha " },
          { id: "a", name: "Alpha updated" },
        ],
        "speciesConstraints",
      ),
    ).toEqual([{ id: "a", name: "Alpha updated" }]);
    expect(() =>
      normalizeReferenceMappings("bad", "speciesConstraints"),
    ).toThrow("speciesConstraints must be an array.");
    expect(() =>
      normalizeReferenceMappings([null], "speciesConstraints"),
    ).toThrow("speciesConstraints at index 0 must be an object.");
    expect(() =>
      normalizeReferenceMappings([{ name: "Alpha" }], "speciesConstraints"),
    ).toThrow("speciesConstraints at index 0 must have an id.");
    expect(() =>
      normalizeReferenceMappings([{ id: "a" }], "speciesConstraints"),
    ).toThrow("speciesConstraints at index 0 must have a name.");
  });

  it("normalizes room types and occupancy statuses", () => {
    expect(normalizeRoomType("exam")).toBe("EXAM_ROOM");
    expect(normalizeRoomType("waiting area")).toBe("WAITING");
    expect(roomTypeSupportsUnits("ICU")).toBe(true);
    expect(roomTypeSupportsUnits("EXAM_ROOM")).toBe(false);
    expect(normalizeRoomOccupancyStatus("occupied")).toBe("OCCUPIED");
    expect(() => normalizeRoomType(123)).toThrow("Room type is required.");
    expect(() => normalizeRoomType("unknown")).toThrow(
      "Room type must be one of:",
    );
    expect(() => normalizeRoomOccupancyStatus(123)).toThrow(
      "Occupancy status is required.",
    );
    expect(() => normalizeRoomOccupancyStatus("unknown")).toThrow(
      "Occupancy status must be one of:",
    );
  });
});
