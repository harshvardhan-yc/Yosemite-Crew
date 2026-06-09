export type CatalogItemType =
  | 'CONSULTATION'
  | 'PROCEDURE'
  | 'INVENTORY'
  | 'LAB'
  | 'MEDICATION'
  | 'PACKAGE';

export type CatalogItemStatus = 'ACTIVE' | 'ARCHIVED';

export type BookingMode = 'OUTPATIENT' | 'INPATIENT' | 'EITHER';

export type ServiceRevamp = {
  id: string;
  code: string;
  name: string;
  description: string;
  type: CatalogItemType;
  specialityId: string;
  organisationId: string;
  grossAmount: number;
  currency?: string;
  defaultDiscount: number;
  maxDiscount: number;
  durationMinutes: number;
  isBookable: boolean;
  isInpatientPreferred: boolean;
  status: CatalogItemStatus;
  createdAt: string;
};

export type PackageBreakdownItem = {
  id: string;
  childItemId?: string;
  code?: string;
  type: CatalogItemType;
  name: string;
  unitPrice: number;
  currency?: string;
  quantity: number;
  discount: number;
  maxDiscount?: number;
  isBookable?: boolean;
  isInpatientPreferred?: boolean;
  nestedBreakdown?: PackageBreakdownItem[];
};

export type PackageRevamp = {
  id: string;
  code: string;
  name: string;
  description: string;
  specialityId: string;
  organisationId: string;
  durationText: string;
  isBookable: boolean;
  isInpatientPreferred: boolean;
  currency?: string;
  leadCount: number;
  supportCount: number;
  additionalDiscount: number;
  breakdown: PackageBreakdownItem[];
  status: CatalogItemStatus;
  createdAt: string;
};

export type SpecialityRevamp = {
  id: string;
  name: string;
  organisationId: string;
  headVetId?: string;
  teamMemberIds: string[];
};
