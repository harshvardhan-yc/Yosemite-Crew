import type { Extension, Location as FHIRLocation } from '@yosemite-crew/fhir';

export type RoomReferenceMapping = {
  id: string;
  name: string;
};

export type OrganisationRoom = {
  id: string;
  name: string;
  organisationId: string;
  code: string;
  description?: string;
  type:
    | 'EXAM_ROOM'
    | 'TREATMENT'
    | 'SURGERY'
    | 'DENTAL'
    | 'IMAGING'
    | 'WAITING'
    | 'GROOMING'
    | 'ICU'
    | 'INPATIENT'
    | 'ISOLATION'
    | 'BOARDING'
    | 'RECEPTION'
    | 'CONSULTATION';
  assignedSpecialiteis?: RoomReferenceMapping[];
  assignedStaffs?: RoomReferenceMapping[];
  availableNow?: boolean;
  availabilityMode?: 'WORKING_HOURS' | 'ALL_DAY' | 'CUSTOM';
  availabilityDays?: string[];
  availabilityStartTime?: string;
  availabilityEndTime?: string;
  capabilities?: string[];
};

const ROOM_IDENTIFIER_SYSTEM = 'http://example.org/fhir/NamingSystem/organisation-room-id';
const ORGANISATION_IDENTIFIER_SYSTEM =
  'http://example.org/fhir/NamingSystem/organisation-room-organisation-id';
const ROOM_CODE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-code';
const ROOM_DESCRIPTION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-description';
const ROOM_TYPE_SYSTEM = 'http://example.org/fhir/CodeSystem/organisation-room-type';
const PHYSICAL_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/location-physical-type';
const PHYSICAL_TYPE_ROOM_CODE = 'ro';
const SPECIALITIES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-specialities';
const STAFFS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-staffs';
const AVAILABLE_NOW_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-available-now';
const AVAILABILITY_MODE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-availability-mode';
const AVAILABILITY_DAYS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-availability-days';
const AVAILABILITY_START_TIME_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-availability-start-time';
const AVAILABILITY_END_TIME_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-availability-end-time';
const CAPABILITIES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/organisation-room-capabilities';
const SPECIALITY_CHILD_URL = 'speciality';
const SPECIALITY_ID_CHILD_URL = 'id';
const SPECIALITY_NAME_CHILD_URL = 'name';
const STAFF_CHILD_URL = 'staff';
const STAFF_ID_CHILD_URL = 'id';
const STAFF_NAME_CHILD_URL = 'name';

const ROOM_TYPE_CODING_MAP: Record<OrganisationRoom['type'], { code: string; display: string }> = {
  EXAM_ROOM: { code: 'exam-room', display: 'Exam Room' },
  TREATMENT: { code: 'treatment', display: 'Treatment' },
  SURGERY: { code: 'surgery', display: 'Surgery Room' },
  DENTAL: { code: 'dental', display: 'Dental' },
  IMAGING: { code: 'imaging', display: 'Imaging' },
  WAITING: { code: 'waiting', display: 'Waiting Area' },
  GROOMING: { code: 'grooming', display: 'Grooming' },
  ICU: { code: 'icu', display: 'ICU' },
  INPATIENT: { code: 'inpatient', display: 'Inpatient' },
  ISOLATION: { code: 'isolation', display: 'Isolation' },
  BOARDING: { code: 'boarding', display: 'Boarding' },
  RECEPTION: { code: 'reception', display: 'Reception' },
  CONSULTATION: { code: 'consultation', display: 'Consultation Room' },
};

const REVERSE_ROOM_TYPE_CODING_MAP = Object.entries(ROOM_TYPE_CODING_MAP).reduce<
  Record<string, OrganisationRoom['type']>
>((acc, [type, coding]) => {
  acc[coding.code] = type as OrganisationRoom['type'];
  return acc;
}, {});

const ensureOrganisationReference = (organisationId: string): string => {
  if (!organisationId) {
    return '';
  }

  return organisationId.startsWith('Organization/')
    ? organisationId
    : `Organization/${organisationId}`;
};

const parseReferenceId = (reference?: string): string | undefined => {
  if (!reference) {
    return undefined;
  }

  const trimmed = reference.trim();

  if (!trimmed) {
    return undefined;
  }

  const segments = trimmed.split('/');
  return segments.length ? (segments.at(-1) ?? undefined) : undefined;
};

type FHIRIdentifier = NonNullable<FHIRLocation['identifier']>[number];

const buildIdentifiers = (
  room: OrganisationRoom
): NonNullable<FHIRLocation['identifier']> | undefined => {
  const identifiers: NonNullable<FHIRLocation['identifier']> = [];

  if (room.id) {
    identifiers.push({
      system: ROOM_IDENTIFIER_SYSTEM,
      value: room.id,
    });
  }

  if (room.organisationId) {
    identifiers.push({
      system: ORGANISATION_IDENTIFIER_SYSTEM,
      value: room.organisationId,
    });
  }

  return identifiers.length ? identifiers : undefined;
};

const buildType = (room: OrganisationRoom): FHIRLocation['type'] => {
  const coding = ROOM_TYPE_CODING_MAP[room.type];

  if (!coding) {
    return undefined;
  }

  return [
    {
      coding: [
        {
          system: ROOM_TYPE_SYSTEM,
          code: coding.code,
          display: coding.display,
        },
      ],
      text: coding.display,
    },
  ];
};

const buildExtensions = (room: OrganisationRoom): Extension[] | undefined => {
  const extensions: Extension[] = [];

  if (room.assignedSpecialiteis?.length) {
    extensions.push({
      url: SPECIALITIES_EXTENSION_URL,
      extension: room.assignedSpecialiteis
        .filter((speciality): speciality is RoomReferenceMapping =>
          Boolean(speciality?.id && speciality?.name)
        )
        .map<Extension>((speciality) => ({
          url: SPECIALITY_CHILD_URL,
          extension: [
            {
              url: SPECIALITY_ID_CHILD_URL,
              valueString: speciality.id,
            },
            {
              url: SPECIALITY_NAME_CHILD_URL,
              valueString: speciality.name,
            },
          ],
        })),
    });
  }

  if (room.assignedStaffs?.length) {
    extensions.push({
      url: STAFFS_EXTENSION_URL,
      extension: room.assignedStaffs
        .filter((staff): staff is RoomReferenceMapping => Boolean(staff?.id && staff?.name))
        .map<Extension>((staff) => ({
          url: STAFF_CHILD_URL,
          extension: [
            {
              url: STAFF_ID_CHILD_URL,
              valueString: staff.id,
            },
            {
              url: STAFF_NAME_CHILD_URL,
              valueString: staff.name,
            },
          ],
        })),
    });
  }

  if (typeof room.availableNow === 'boolean') {
    extensions.push({
      url: AVAILABLE_NOW_EXTENSION_URL,
      valueBoolean: room.availableNow,
    });
  }

  if (room.availabilityMode) {
    extensions.push({
      url: AVAILABILITY_MODE_EXTENSION_URL,
      valueString: room.availabilityMode,
    });
  }

  if (room.availabilityDays?.length) {
    extensions.push({
      url: AVAILABILITY_DAYS_EXTENSION_URL,
      extension: room.availabilityDays.filter(Boolean).map<Extension>((day) => ({
        url: 'day',
        valueString: day,
      })),
    });
  }

  if (room.availabilityStartTime) {
    extensions.push({
      url: AVAILABILITY_START_TIME_EXTENSION_URL,
      valueString: room.availabilityStartTime,
    });
  }

  if (room.availabilityEndTime) {
    extensions.push({
      url: AVAILABILITY_END_TIME_EXTENSION_URL,
      valueString: room.availabilityEndTime,
    });
  }

  if (room.capabilities?.length) {
    extensions.push({
      url: CAPABILITIES_EXTENSION_URL,
      extension: room.capabilities.filter(Boolean).map<Extension>((capability) => ({
        url: 'capability',
        valueString: capability,
      })),
    });
  }

  if (room.code) {
    extensions.push({
      url: ROOM_CODE_EXTENSION_URL,
      valueString: room.code,
    });
  }

  if (room.description) {
    extensions.push({
      url: ROOM_DESCRIPTION_EXTENSION_URL,
      valueString: room.description,
    });
  }

  return extensions.length ? extensions : undefined;
};

const findIdentifierValue = (
  identifiers: FHIRLocation['identifier'],
  system: string
): string | undefined =>
  identifiers?.find((identifier: FHIRIdentifier) => identifier.system === system)?.value;

const parseArrayExtension = (
  extensions: Extension[] | undefined,
  url: string,
  childUrl: string
): string[] | undefined => {
  const parent = extensions?.find((extension) => extension.url === url);

  if (!parent?.extension?.length) {
    return undefined;
  }

  const values = parent.extension
    .map((child) => (child.url === childUrl ? child.valueString?.trim() : undefined))
    .filter((value): value is string => value !== undefined);

  return values.length ? values : undefined;
};

const parseMappingExtension = (
  extensions: Extension[] | undefined,
  url: string
): RoomReferenceMapping[] | undefined => {
  const parent = extensions?.find((extension) => extension.url === url);

  if (!parent?.extension?.length) {
    return undefined;
  }

  const values = parent.extension
    .map((child) => {
      if (!child.extension?.length) {
        return undefined;
      }

      const id = child.extension.find((entry) => entry.url === 'id')?.valueString?.trim();
      const name = child.extension.find((entry) => entry.url === 'name')?.valueString?.trim();

      if (!id || !name) {
        return undefined;
      }

      return { id, name };
    })
    .filter((value): value is RoomReferenceMapping => value !== undefined);

  return values.length ? values : undefined;
};

const parseBooleanExtension = (
  extensions: Extension[] | undefined,
  url: string
): boolean | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueBoolean ?? undefined;

const parseStringExtension = (
  extensions: Extension[] | undefined,
  url: string
): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString ?? undefined;

const resolveOrganisationId = (resource: FHIRLocation): string | undefined => {
  const referenceId = parseReferenceId(resource.managingOrganization?.reference);

  if (referenceId) {
    return referenceId;
  }

  return findIdentifierValue(resource.identifier, ORGANISATION_IDENTIFIER_SYSTEM);
};

const parseRoomType = (resource: FHIRLocation): OrganisationRoom['type'] => {
  const coding = resource.type?.[0]?.coding?.[0];

  if (coding?.code) {
    const mapped = REVERSE_ROOM_TYPE_CODING_MAP[coding.code];
    if (mapped) {
      return mapped;
    }
  }

  return 'CONSULTATION';
};

export const toFHIROrganisationRoom = (room: OrganisationRoom): FHIRLocation => ({
  resourceType: 'Location',
  id: room.id,
  name: room.name,
  identifier: buildIdentifiers(room),
  managingOrganization: {
    reference: ensureOrganisationReference(room.organisationId),
    type: 'Organization',
  },
  type: buildType(room),
  physicalType: {
    coding: [
      {
        system: PHYSICAL_TYPE_SYSTEM,
        code: PHYSICAL_TYPE_ROOM_CODE,
        display: 'Room',
      },
    ],
    text: 'Room',
  },
  extension: buildExtensions(room),
});

export const fromFHIROrganisationRoom = (resource: FHIRLocation): OrganisationRoom => {
  const extensions = resource.extension;

  return {
    id: resource.id ?? findIdentifierValue(resource.identifier, ROOM_IDENTIFIER_SYSTEM) ?? '',
    name: resource.name ?? '',
    organisationId: resolveOrganisationId(resource) ?? '',
    code: parseStringExtension(resource.extension, ROOM_CODE_EXTENSION_URL) ?? '',
    description: parseStringExtension(resource.extension, ROOM_DESCRIPTION_EXTENSION_URL),
    type: parseRoomType(resource),
    assignedSpecialiteis: parseMappingExtension(extensions, SPECIALITIES_EXTENSION_URL),
    assignedStaffs: parseMappingExtension(extensions, STAFFS_EXTENSION_URL),
    availableNow: parseBooleanExtension(extensions, AVAILABLE_NOW_EXTENSION_URL),
    availabilityMode: parseStringExtension(extensions, AVAILABILITY_MODE_EXTENSION_URL) as
      | OrganisationRoom['availabilityMode']
      | undefined,
    availabilityDays: parseArrayExtension(extensions, AVAILABILITY_DAYS_EXTENSION_URL, 'day'),
    availabilityStartTime: parseStringExtension(extensions, AVAILABILITY_START_TIME_EXTENSION_URL),
    availabilityEndTime: parseStringExtension(extensions, AVAILABILITY_END_TIME_EXTENSION_URL),
    capabilities: parseArrayExtension(extensions, CAPABILITIES_EXTENSION_URL, 'capability'),
  };
};

export const toFHIROrganizationRoom = toFHIROrganisationRoom;
export const fromFHIROrganizationRoom = fromFHIROrganisationRoom;
