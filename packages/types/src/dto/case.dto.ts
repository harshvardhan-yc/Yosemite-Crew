import type { EpisodeOfCare } from '@yosemite-crew/fhir';
import { type Case, fromFHIRCase, toFHIRCase } from '../case';

export type CaseRequestDTO = EpisodeOfCare;
export type CaseResponseDTO = EpisodeOfCare;

export const fromCaseRequestDTO = (dto: CaseRequestDTO): Case => {
  if (!dto || dto.resourceType !== 'EpisodeOfCare') {
    throw new Error('Invalid payload. Expected FHIR EpisodeOfCare resource.');
  }

  return fromFHIRCase(dto);
};

export const toCaseResponseDTO = (value: Case): CaseResponseDTO => toFHIRCase(value);
