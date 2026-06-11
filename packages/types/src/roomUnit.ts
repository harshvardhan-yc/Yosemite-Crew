import type { Extension, Location as FHIRLocation } from '@yosemite-crew/fhir';

export type RoomUnit = {
  id: string;
  organisationId: string;
  roomId: string;
  code: string;
  displayName: string;
  size?: string;
  speciesConstraints?: string[];
  isActive?: boolean;
};

const UNIT_IDENTIFIER_SYSTEM = 'http://example.org/fhir/NamingSystem/room-unit-id';
const ROOM_UNIT_CODE_SYSTEM = 'http://example.org/fhir/CodeSystem/room-unit';
const EXT_ROOM_UNIT_CODE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-code';
const EXT_ROOM_UNIT_SIZE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-size';
const EXT_ROOM_UNIT_SPECIES = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-species';
const EXT_ROOM_UNIT_ACTIVE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-active';

const parseReferenceId = (reference?: string): string | undefined => {
  const trimmed = reference?.trim();
  if (!trimmed) return undefined;
  const segments = trimmed.split('/');
  return segments.at(-1) ?? undefined;
};

const getStringExtension = (extensions: Extension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString ?? undefined;

const getBooleanExtension = (
  extensions: Extension[] | undefined,
  url: string
): boolean | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueBoolean ?? undefined;

const getStringArrayExtension = (
  extensions: Extension[] | undefined,
  url: string
): string[] | undefined => {
  const values = extensions
    ?.filter((extension) => extension.url === url)
    .map((extension) => extension.valueString?.trim())
    .filter((value): value is string => Boolean(value));

  return values?.length ? values : undefined;
};

export const toFHIRRoomUnit = (unit: RoomUnit): FHIRLocation => ({
  resourceType: 'Location',
  id: unit.id,
  identifier: [
    {
      system: UNIT_IDENTIFIER_SYSTEM,
      value: unit.id,
    },
  ],
  name: unit.displayName,
  managingOrganization: {
    reference: `Organization/${unit.organisationId}`,
  },
  partOf: {
    reference: `Location/${unit.roomId}`,
  },
  physicalType: {
    coding: [
      {
        system: ROOM_UNIT_CODE_SYSTEM,
        code: 'unit',
        display: 'Unit',
      },
    ],
    text: 'Unit',
  },
  extension: [
    {
      url: EXT_ROOM_UNIT_CODE,
      valueString: unit.code,
    },
    ...(unit.size
      ? [
          {
            url: EXT_ROOM_UNIT_SIZE,
            valueString: unit.size,
          },
        ]
      : []),
    ...(unit.speciesConstraints?.map<Extension>((species) => ({
      url: EXT_ROOM_UNIT_SPECIES,
      valueString: species,
    })) ?? []),
    {
      url: EXT_ROOM_UNIT_ACTIVE,
      valueBoolean: unit.isActive ?? true,
    },
  ],
});

export const fromFHIRRoomUnit = (resource: FHIRLocation): RoomUnit => ({
  id: resource.id ?? '',
  organisationId: parseReferenceId(resource.managingOrganization?.reference) ?? '',
  roomId: parseReferenceId(resource.partOf?.reference) ?? '',
  code: getStringExtension(resource.extension, EXT_ROOM_UNIT_CODE) ?? '',
  displayName: resource.name ?? '',
  size: getStringExtension(resource.extension, EXT_ROOM_UNIT_SIZE),
  speciesConstraints: getStringArrayExtension(resource.extension, EXT_ROOM_UNIT_SPECIES),
  isActive: getBooleanExtension(resource.extension, EXT_ROOM_UNIT_ACTIVE) ?? true,
});
