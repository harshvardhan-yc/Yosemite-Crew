import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const getStore = () => useRevampCatalogStore.getState();

const reset = () =>
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
  });

describe('revampCatalogStore', () => {
  beforeEach(reset);

  describe('specialities', () => {
    it('adds a speciality', () => {
      getStore().addSpeciality('Cardiology', 'org-1');
      const { specialities } = getStore();
      expect(specialities).toHaveLength(1);
      expect(specialities[0].name).toBe('Cardiology');
      expect(specialities[0].organisationId).toBe('org-1');
      expect(specialities[0].id).toBeTruthy();
    });

    it('renames a speciality', () => {
      getStore().addSpeciality('Old Name', 'org-1');
      const { specialities } = getStore();
      const id = specialities[0].id;
      getStore().renameSpeciality(id, 'New Name');
      expect(getStore().specialities[0].name).toBe('New Name');
    });
  });

  describe('services', () => {
    it('adds a service and assigns a code', () => {
      getStore().addService({
        name: 'Test Consult',
        description: '',
        type: 'CONSULTATION',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        grossAmount: 500,
        defaultDiscount: 5,
        maxDiscount: 10,
        durationMinutes: 30,
        isBookable: true,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
      const { services } = getStore();
      expect(services).toHaveLength(1);
      expect(services[0].code).toMatch(/^CS-\d{4}$/);
      expect(services[0].id).toBeTruthy();
    });

    it('updates a service', () => {
      const svc = getStore().addService({
        name: 'Before',
        description: '',
        type: 'CONSULTATION',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        grossAmount: 100,
        defaultDiscount: 0,
        maxDiscount: 0,
        durationMinutes: 30,
        isBookable: false,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
      getStore().updateService(svc.id, { name: 'After', grossAmount: 200 });
      const found = getStore().services.find((s) => s.id === svc.id);
      expect(found?.name).toBe('After');
      expect(found?.grossAmount).toBe(200);
    });

    it('archives and restores a service', () => {
      const svc = getStore().addService({
        name: 'Archivable',
        description: '',
        type: 'PROCEDURE',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        grossAmount: 100,
        defaultDiscount: 0,
        maxDiscount: 0,
        durationMinutes: 30,
        isBookable: false,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
      getStore().archiveService(svc.id);
      expect(getStore().services.find((s) => s.id === svc.id)?.status).toBe('ARCHIVED');
      getStore().restoreService(svc.id);
      expect(getStore().services.find((s) => s.id === svc.id)?.status).toBe('ACTIVE');
    });

    it('deletes a service', () => {
      const svc = getStore().addService({
        name: 'Gone',
        description: '',
        type: 'LAB',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        grossAmount: 100,
        defaultDiscount: 0,
        maxDiscount: 0,
        durationMinutes: 20,
        isBookable: false,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
      getStore().deleteService(svc.id);
      expect(getStore().services.find((s) => s.id === svc.id)).toBeUndefined();
    });

    it('filtering services by speciality returns only ACTIVE services', () => {
      getStore().addService({
        name: 'Active Svc',
        description: '',
        type: 'CONSULTATION',
        specialityId: 'spec-A',
        organisationId: 'org-1',
        grossAmount: 100,
        defaultDiscount: 0,
        maxDiscount: 0,
        durationMinutes: 30,
        isBookable: true,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
      const archived = getStore().addService({
        name: 'Archived Svc',
        description: '',
        type: 'CONSULTATION',
        specialityId: 'spec-A',
        organisationId: 'org-1',
        grossAmount: 100,
        defaultDiscount: 0,
        maxDiscount: 0,
        durationMinutes: 30,
        isBookable: false,
        isInpatientPreferred: false,
        status: 'ARCHIVED',
      });
      const active = getStore().services.filter(
        (s) => s.specialityId === 'spec-A' && s.status === 'ACTIVE'
      );
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('ACTIVE');
      expect(active.find((s) => s.id === archived.id)).toBeUndefined();
    });
  });

  describe('packages', () => {
    it('adds a package with PK code', () => {
      getStore().addPackage({
        name: 'Bundle',
        description: '',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        durationMinutes: 60,
        isBookable: true,
        leadCount: 1,
        supportCount: 2,
        additionalDiscount: 5,
        breakdown: [],
        status: 'ACTIVE',
      });
      const { packages } = getStore();
      expect(packages).toHaveLength(1);
      expect(packages[0].code).toMatch(/^PK-\d{4}$/);
    });

    it('adds and removes a breakdown item', () => {
      const pkg = getStore().addPackage({
        name: 'Pkg',
        description: '',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        durationMinutes: 30,
        isBookable: false,
        leadCount: 1,
        supportCount: 0,
        additionalDiscount: 0,
        breakdown: [],
        status: 'ACTIVE',
      });
      getStore().addBreakdownItem(pkg.id, {
        type: 'CONSULTATION',
        name: 'Consult',
        unitPrice: 100,
        quantity: 1,
        discount: 10,
      });
      expect(getStore().packages[0].breakdown).toHaveLength(1);
      const itemId = getStore().packages[0].breakdown[0].id;
      getStore().removeBreakdownItem(pkg.id, itemId);
      expect(getStore().packages[0].breakdown).toHaveLength(0);
    });

    it('archives and restores a package', () => {
      const pkg = getStore().addPackage({
        name: 'ArchivedPkg',
        description: '',
        specialityId: 'spec-1',
        organisationId: 'org-1',
        durationMinutes: 30,
        isBookable: false,
        leadCount: 1,
        supportCount: 0,
        additionalDiscount: 0,
        breakdown: [],
        status: 'ACTIVE',
      });
      getStore().archivePackage(pkg.id);
      expect(getStore().packages[0].status).toBe('ARCHIVED');
      getStore().restorePackage(pkg.id);
      expect(getStore().packages[0].status).toBe('ACTIVE');
    });

    it('filtering packages by speciality returns only ARCHIVED items', () => {
      const pkg = getStore().addPackage({
        name: 'Active Pkg',
        description: '',
        specialityId: 'spec-B',
        organisationId: 'org-1',
        durationMinutes: 30,
        isBookable: false,
        leadCount: 1,
        supportCount: 0,
        additionalDiscount: 0,
        breakdown: [],
        status: 'ACTIVE',
      });
      getStore().archivePackage(pkg.id);
      const archived = getStore().packages.filter(
        (p) => p.specialityId === 'spec-B' && p.status === 'ARCHIVED'
      );
      expect(archived).toHaveLength(1);
      expect(archived[0].status).toBe('ARCHIVED');
    });
  });
});
