import { create } from 'zustand';
import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';
import {
  generateCode,
  MOCK_PACKAGES,
  MOCK_SERVICES,
  MOCK_SPECIALITIES,
} from '@/app/features/organization/services/revampMockData';

type RevampCatalogState = {
  specialities: SpecialityRevamp[];
  services: ServiceRevamp[];
  packages: PackageRevamp[];

  addSpeciality: (name: string, organisationId: string) => SpecialityRevamp;
  renameSpeciality: (id: string, name: string) => void;

  addService: (draft: Omit<ServiceRevamp, 'id' | 'code' | 'createdAt'>) => ServiceRevamp;
  updateService: (id: string, patch: Partial<ServiceRevamp>) => void;
  archiveService: (id: string) => void;
  restoreService: (id: string) => void;
  deleteService: (id: string) => void;

  addPackage: (draft: Omit<PackageRevamp, 'id' | 'code' | 'createdAt'>) => PackageRevamp;
  updatePackage: (id: string, patch: Partial<PackageRevamp>) => void;
  archivePackage: (id: string) => void;
  restorePackage: (id: string) => void;
  deletePackage: (id: string) => void;

  addBreakdownItem: (packageId: string, item: Omit<PackageBreakdownItem, 'id'>) => void;
  updateBreakdownItem: (
    packageId: string,
    itemId: string,
    patch: Partial<PackageBreakdownItem>
  ) => void;
  removeBreakdownItem: (packageId: string, itemId: string) => void;

  generateItemCode: (type: CatalogItemType) => string;
};

export const useRevampCatalogStore = create<RevampCatalogState>()((set, _get) => ({
  specialities: MOCK_SPECIALITIES,
  services: MOCK_SERVICES,
  packages: MOCK_PACKAGES,

  addSpeciality: (name, organisationId) => {
    const newSpec: SpecialityRevamp = {
      id: crypto.randomUUID(),
      name,
      organisationId,
      teamMemberIds: [],
    };
    set((state) => ({ specialities: [...state.specialities, newSpec] }));
    return newSpec;
  },

  renameSpeciality: (id, name) =>
    set((state) => ({
      specialities: state.specialities.map((s) => (s.id === id ? { ...s, name } : s)),
    })),

  addService: (draft) => {
    const newSvc: ServiceRevamp = {
      ...draft,
      id: crypto.randomUUID(),
      code: generateCode(draft.type),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ services: [...state.services, newSvc] }));
    return newSvc;
  },

  updateService: (id, patch) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  archiveService: (id) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, status: 'ARCHIVED' } : s)),
    })),

  restoreService: (id) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, status: 'ACTIVE' } : s)),
    })),

  deleteService: (id) => set((state) => ({ services: state.services.filter((s) => s.id !== id) })),

  addPackage: (draft) => {
    const newPkg: PackageRevamp = {
      ...draft,
      id: crypto.randomUUID(),
      code: generateCode('PACKAGE'),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ packages: [...state.packages, newPkg] }));
    return newPkg;
  },

  updatePackage: (id, patch) =>
    set((state) => ({
      packages: state.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  archivePackage: (id) =>
    set((state) => ({
      packages: state.packages.map((p) => (p.id === id ? { ...p, status: 'ARCHIVED' } : p)),
    })),

  restorePackage: (id) =>
    set((state) => ({
      packages: state.packages.map((p) => (p.id === id ? { ...p, status: 'ACTIVE' } : p)),
    })),

  deletePackage: (id) => set((state) => ({ packages: state.packages.filter((p) => p.id !== id) })),

  addBreakdownItem: (packageId, item) => {
    const newItem: PackageBreakdownItem = { ...item, id: crypto.randomUUID() };
    set((state) => ({
      packages: state.packages.map((p) =>
        p.id === packageId ? { ...p, breakdown: [...p.breakdown, newItem] } : p
      ),
    }));
  },

  updateBreakdownItem: (packageId, itemId, patch) =>
    set((state) => ({
      packages: state.packages.map((p) =>
        p.id === packageId
          ? {
              ...p,
              breakdown: p.breakdown.map((bi) => (bi.id === itemId ? { ...bi, ...patch } : bi)),
            }
          : p
      ),
    })),

  removeBreakdownItem: (packageId, itemId) =>
    set((state) => ({
      packages: state.packages.map((p) =>
        p.id === packageId ? { ...p, breakdown: p.breakdown.filter((bi) => bi.id !== itemId) } : p
      ),
    })),

  generateItemCode: (type) => generateCode(type),
}));
