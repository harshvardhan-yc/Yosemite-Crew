import type { Location as FHIRLocation } from '@yosemite-crew/fhir';
import { fromFHIRRoomUnit, toFHIRRoomUnit, type RoomUnit } from '../roomUnit';

export type RoomUnitRequestDTO = FHIRLocation;
export type RoomUnitResponseDTO = FHIRLocation;

export const fromRoomUnitRequestDTO = (dto: RoomUnitRequestDTO): RoomUnit => {
  if (!dto || dto.resourceType !== 'Location') {
    throw new Error('Invalid payload. Expected FHIR Location resource.');
  }

  return fromFHIRRoomUnit(dto);
};

export const toRoomUnitResponseDTO = (value: RoomUnit): RoomUnitResponseDTO =>
  toFHIRRoomUnit(value);
