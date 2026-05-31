import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';

const CODE_PREFIXES: Record<CatalogItemType, string> = {
  CONSULTATION: 'CS',
  PROCEDURE: 'PR',
  INVENTORY: 'IN',
  LAB: 'LB',
  MEDICATION: 'ME',
  PACKAGE: 'PK',
};

let counters: Record<CatalogItemType, number> = {
  CONSULTATION: 4,
  PROCEDURE: 2,
  INVENTORY: 3,
  LAB: 2,
  MEDICATION: 1,
  PACKAGE: 4,
};

export const generateCode = (type: CatalogItemType): string => {
  counters[type] += 1;
  const padded = String(counters[type]).padStart(4, '0');
  return `${CODE_PREFIXES[type]}-${padded}`;
};

export const resetCounters = (init: Record<CatalogItemType, number>) => {
  counters = { ...init };
};

const ORG_ID = 'mock-org-001';

const SPECIALITIES: SpecialityRevamp[] = [
  { id: 'spec-001', name: 'Cardiology', organisationId: ORG_ID, teamMemberIds: ['u1', 'u2'] },
  { id: 'spec-002', name: 'Radiology', organisationId: ORG_ID, teamMemberIds: [] },
  { id: 'spec-003', name: 'Dermatology', organisationId: ORG_ID, teamMemberIds: ['u3'] },
];

const SERVICES: ServiceRevamp[] = [
  {
    id: 'svc-001',
    code: 'CS-0001',
    name: 'Canine ECG Evaluation',
    description: 'Electrocardiogram for cardiac rhythm assessment in dogs.',
    type: 'CONSULTATION',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    grossAmount: 1200,
    defaultDiscount: 5,
    maxDiscount: 15,
    durationMinutes: 30,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-01-10T08:00:00Z',
  },
  {
    id: 'svc-002',
    code: 'CS-0002',
    name: 'Feline Cardiac Consult',
    description: 'Full cardiac consultation for feline patients.',
    type: 'CONSULTATION',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    grossAmount: 1500,
    defaultDiscount: 0,
    maxDiscount: 10,
    durationMinutes: 45,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-01-12T09:00:00Z',
  },
  {
    id: 'svc-003',
    code: 'CS-0003',
    name: 'Cardiac Monitoring (IP)',
    description: 'Continuous cardiac monitoring for inpatient stays.',
    type: 'CONSULTATION',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    grossAmount: 3000,
    defaultDiscount: 0,
    maxDiscount: 5,
    durationMinutes: 60,
    isBookable: false,
    isInpatientPreferred: true,
    status: 'ARCHIVED',
    createdAt: '2025-01-05T07:00:00Z',
  },
  {
    id: 'svc-004',
    code: 'LB-0001',
    name: 'CBC - Canine',
    description: 'Complete blood count for dogs.',
    type: 'LAB',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    grossAmount: 800,
    defaultDiscount: 2,
    maxDiscount: 10,
    durationMinutes: 20,
    isBookable: false,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'svc-005',
    code: 'PR-0001',
    name: 'MRI Procedure',
    description: 'Magnetic resonance imaging for diagnostic imaging.',
    type: 'PROCEDURE',
    specialityId: 'spec-002',
    organisationId: ORG_ID,
    grossAmount: 5000,
    defaultDiscount: 0,
    maxDiscount: 5,
    durationMinutes: 90,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-02-01T08:00:00Z',
  },
  {
    id: 'svc-006',
    code: 'PR-0002',
    name: 'X-Ray Chest',
    description: 'Standard chest radiograph.',
    type: 'PROCEDURE',
    specialityId: 'spec-002',
    organisationId: ORG_ID,
    grossAmount: 1200,
    defaultDiscount: 5,
    maxDiscount: 15,
    durationMinutes: 20,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-02-05T09:00:00Z',
  },
  {
    id: 'svc-007',
    code: 'CS-0004',
    name: 'Skin Allergy Consult',
    description: 'Dermatological allergy evaluation.',
    type: 'CONSULTATION',
    specialityId: 'spec-003',
    organisationId: ORG_ID,
    grossAmount: 1100,
    defaultDiscount: 0,
    maxDiscount: 10,
    durationMinutes: 30,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2025-03-01T08:00:00Z',
  },
];

const breakdown001: PackageBreakdownItem[] = [
  {
    id: 'bi-001',
    type: 'CONSULTATION',
    name: 'Radiographic Consultation',
    unitPrice: 100,
    quantity: 1,
    discount: 10,
  },
  {
    id: 'bi-002',
    type: 'MEDICATION',
    name: 'Amoxicillin Tablet',
    unitPrice: 10,
    quantity: 1,
    discount: 2,
  },
  { id: 'bi-003', type: 'INVENTORY', name: 'Syringe', unitPrice: 10, quantity: 2, discount: 2 },
  {
    id: 'bi-004',
    type: 'PROCEDURE',
    name: 'MRI Procedure',
    unitPrice: 100,
    quantity: 1,
    discount: 10,
  },
  { id: 'bi-005', type: 'LAB', name: 'CBC - Canine', unitPrice: 1200, quantity: 1, discount: 10 },
];

const breakdown002: PackageBreakdownItem[] = [
  {
    id: 'bi-006',
    type: 'CONSULTATION',
    name: 'Feline Cardiac Consult',
    unitPrice: 1500,
    quantity: 1,
    discount: 5,
  },
  {
    id: 'bi-007',
    type: 'LAB',
    name: 'Blood Panel - Feline',
    unitPrice: 800,
    quantity: 1,
    discount: 5,
  },
];

const PACKAGES: PackageRevamp[] = [
  {
    id: 'pkg-001',
    code: 'PK-0001',
    name: 'Canine Cardio Assessment',
    description:
      'This consultation focuses on evaluating canine radiographs to assess the health and condition of dogs. Our experts analyse the images to provide insights into potential issues.',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    durationMinutes: 30,
    isBookable: true,
    leadCount: 1,
    supportCount: 2,
    additionalDiscount: 5,
    breakdown: breakdown001,
    status: 'ACTIVE',
    createdAt: '2025-01-20T08:00:00Z',
  },
  {
    id: 'pkg-002',
    code: 'PK-0002',
    name: 'Feline Cardio Assessment',
    description:
      'This consultation focuses on evaluating canine radiographs to assess the health and condition of dogs.',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    durationMinutes: 30,
    isBookable: true,
    leadCount: 1,
    supportCount: 2,
    additionalDiscount: 0,
    breakdown: breakdown002,
    status: 'ACTIVE',
    createdAt: '2025-01-22T09:00:00Z',
  },
  {
    id: 'pkg-003',
    code: 'PK-0003',
    name: 'Derma Allergy Bundle',
    description: 'Complete dermatology allergy workup bundle.',
    specialityId: 'spec-003',
    organisationId: ORG_ID,
    durationMinutes: 60,
    isBookable: false,
    leadCount: 1,
    supportCount: 1,
    additionalDiscount: 0,
    breakdown: [],
    status: 'ACTIVE',
    createdAt: '2025-03-10T08:00:00Z',
  },
  {
    id: 'pkg-004',
    code: 'PK-0004',
    name: 'Cardio Annual Check (Archived)',
    description: 'Legacy annual cardio checkup package.',
    specialityId: 'spec-001',
    organisationId: ORG_ID,
    durationMinutes: 45,
    isBookable: false,
    leadCount: 1,
    supportCount: 0,
    additionalDiscount: 0,
    breakdown: [],
    status: 'ARCHIVED',
    createdAt: '2024-12-01T08:00:00Z',
  },
];

export const MOCK_SPECIALITIES = SPECIALITIES;
export const MOCK_SERVICES = SERVICES;
export const MOCK_PACKAGES = PACKAGES;

export const computePackageBreakdownItem = (item: PackageBreakdownItem) => {
  const gross = item.unitPrice * item.quantity;
  const discountAmt = (gross * item.discount) / 100;
  return { gross, discountAmt, net: gross - discountAmt };
};

export const computePackageTotals = (pkg: PackageRevamp) => {
  const grossTotal = pkg.breakdown.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);
  const afterItemDiscounts = pkg.breakdown.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const additionalDiscountAmt = (afterItemDiscounts * pkg.additionalDiscount) / 100;
  const totalCost = afterItemDiscounts - additionalDiscountAmt;
  return { grossTotal, afterItemDiscounts, additionalDiscountAmt, totalCost };
};

export const computeServiceTotal = (service: ServiceRevamp) => {
  const defaultDiscountAmt = (service.grossAmount * service.defaultDiscount) / 100;
  const total = service.grossAmount - defaultDiscountAmt;
  return { defaultDiscountAmt, total };
};
