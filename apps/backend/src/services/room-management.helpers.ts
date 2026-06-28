import { RoomOccupancyStatus, RoomType } from "@yosemite-crew/database";
import type { RoomReferenceMapping } from "@yosemite-crew/types";

const normalizeToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/__+/g, "_");

export class RoomValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomValidationError";
  }
}

const normalizeReferenceMapping = (
  value: unknown,
  fieldName: string,
  index: number,
): RoomReferenceMapping => {
  if (!value || typeof value !== "object") {
    throw new RoomValidationError(
      `${fieldName} at index ${index} must be an object.`,
    );
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";

  if (!id) {
    throw new RoomValidationError(
      `${fieldName} at index ${index} must have an id.`,
    );
  }

  if (!name) {
    throw new RoomValidationError(
      `${fieldName} at index ${index} must have a name.`,
    );
  }

  return { id, name };
};

const ROOM_TYPE_ALIASES: Record<string, RoomType> = {
  EXAM: "EXAM_ROOM",
  EXAM_ROOM: "EXAM_ROOM",
  EXAMROOM: "EXAM_ROOM",
  TREATMENT: "TREATMENT",
  SURGERY: "SURGERY",
  DENTAL: "DENTAL",
  IMAGING: "IMAGING",
  WAITING: "WAITING",
  WAITING_AREA: "WAITING",
  WAITINGAREA: "WAITING",
  GROOMING: "GROOMING",
  ICU: "ICU",
  INPATIENT: "INPATIENT",
  ISOLATION: "ISOLATION",
  BOARDING: "BOARDING",
  RECEPTION: "RECEPTION",
  CONSULTATION: "CONSULTATION",
};

export const ROOM_TYPES = new Set<RoomType>([
  "EXAM_ROOM",
  "TREATMENT",
  "SURGERY",
  "DENTAL",
  "IMAGING",
  "WAITING",
  "GROOMING",
  "ICU",
  "INPATIENT",
  "ISOLATION",
  "BOARDING",
  "RECEPTION",
  "CONSULTATION",
]);

export const UNIT_SUPPORTED_ROOM_TYPES = new Set<RoomType>([
  "ICU",
  "INPATIENT",
  "ISOLATION",
  "BOARDING",
]);

export const ROOM_OCCUPANCY_STATUSES = new Set<RoomOccupancyStatus>([
  "VACANT",
  "OCCUPIED",
]);

export const requireNonEmptyString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new RoomValidationError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new RoomValidationError(`${fieldName} is required.`);
  }

  if (trimmed.includes("$")) {
    throw new RoomValidationError(`Invalid character in ${fieldName}.`);
  }

  return trimmed;
};

export const optionalNonEmptyString = (value: unknown) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RoomValidationError("Invalid string value.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0),
    ),
  ];
};

export const normalizeStrictStringList = (
  value: unknown,
  fieldName: string,
): string[] => {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RoomValidationError(`${fieldName} must be an array.`);
  }

  const cleaned = value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new RoomValidationError(
        `${fieldName} at index ${index} must be a string.`,
      );
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      throw new RoomValidationError(
        `${fieldName} at index ${index} cannot be empty.`,
      );
    }

    return trimmed;
  });

  return [...new Set(cleaned)];
};

export const normalizeReferenceMappings = (
  value: unknown,
  fieldName: string,
): RoomReferenceMapping[] => {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RoomValidationError(`${fieldName} must be an array.`);
  }

  const cleaned = value.map((entry, index) =>
    normalizeReferenceMapping(entry, fieldName, index),
  );

  const deduped = new Map<string, RoomReferenceMapping>();
  for (const entry of cleaned) {
    deduped.set(entry.id, entry);
  }

  return [...deduped.values()];
};

export const normalizeRoomType = (value: unknown): RoomType => {
  if (typeof value !== "string") {
    throw new RoomValidationError("Room type is required.");
  }

  const normalized = normalizeToken(value);
  const roomType = ROOM_TYPE_ALIASES[normalized];

  if (!roomType || !ROOM_TYPES.has(roomType)) {
    throw new RoomValidationError(
      `Room type must be one of: ${Array.from(ROOM_TYPES).join(", ")}.`,
    );
  }

  return roomType;
};

export const normalizeRoomOccupancyStatus = (
  value: unknown,
): RoomOccupancyStatus => {
  if (typeof value !== "string") {
    throw new RoomValidationError("Occupancy status is required.");
  }

  const normalized = normalizeToken(value);

  if (!ROOM_OCCUPANCY_STATUSES.has(normalized as RoomOccupancyStatus)) {
    throw new RoomValidationError(
      `Occupancy status must be one of: ${Array.from(
        ROOM_OCCUPANCY_STATUSES,
      ).join(", ")}.`,
    );
  }

  return normalized as RoomOccupancyStatus;
};

export const roomTypeSupportsUnits = (value: RoomType) =>
  UNIT_SUPPORTED_ROOM_TYPES.has(value);
