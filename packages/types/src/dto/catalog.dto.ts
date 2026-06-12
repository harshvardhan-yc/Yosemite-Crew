import type { Bundle, HealthcareService } from '@yosemite-crew/fhir';
import {
  fromFHIRCatalogHealthcareService,
  toFHIRCatalogBundle,
  toFHIRCatalogHealthcareService,
  type CatalogFHIRInput,
} from '../catalog';

export type CatalogRequestDTO = HealthcareService;
export type CatalogResponseDTO = HealthcareService;
export type CatalogBundleResponseDTO = Bundle;

export const fromCatalogRequestDTO = (dto: CatalogRequestDTO): CatalogFHIRInput =>
  fromFHIRCatalogHealthcareService(dto);

export const toCatalogResponseDTO = (
  product: Parameters<typeof toFHIRCatalogHealthcareService>[0]
): CatalogResponseDTO => toFHIRCatalogHealthcareService(product);

export const toCatalogBundleResponseDTO = (
  products: Parameters<typeof toFHIRCatalogBundle>[0],
  options?: Parameters<typeof toFHIRCatalogBundle>[1]
): CatalogBundleResponseDTO => toFHIRCatalogBundle(products, options);
