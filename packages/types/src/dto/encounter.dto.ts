import type { Encounter as FHIREncounter } from '@yosemite-crew/fhir';
import { type Encounter, fromFHIREncounter, toFHIREncounter } from '../encounter';

export type EncounterRequestDTO = FHIREncounter;
export type EncounterResponseDTO = FHIREncounter;

export const fromEncounterRequestDTO = (dto: EncounterRequestDTO): Encounter => {
  if (!dto || dto.resourceType !== 'Encounter') {
    throw new Error('Invalid payload. Expected FHIR Encounter resource.');
  }

  return fromFHIREncounter(dto);
};

export const toEncounterResponseDTO = (value: Encounter): EncounterResponseDTO =>
  toFHIREncounter(value);
