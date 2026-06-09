import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const getStore = () => useRevampCatalogStore.getState();

const reset = () =>
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
  });

const packageDraft = {
  name: 'Pkg',
  description: '',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  durationText: 'Approx. 30 mins',
  isBookable: false,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 0,
  additionalDiscount: 0,
  breakdown: [],
  status: 'ACTIVE' as const,
};

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
      const id = getStore().specialities[0].id;
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

    it('archives, restores, and deletes a service', () => {
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
      getStore().deleteService(svc.id);
      expect(getStore().services.find((s) => s.id === svc.id)).toBeUndefined();
    });
  });

  describe('packages', () => {
    it('adds a package with PK code', () => {
      getStore().addPackage({ ...packageDraft, name: 'Bundle', isBookable: true });
      const { packages } = getStore();
      expect(packages).toHaveLength(1);
      expect(packages[0].code).toMatch(/^PK-\d{4}$/);
      expect(packages[0].durationText).toBe('Approx. 30 mins');
    });

    it('updates a package', () => {
      const pkg = getStore().addPackage({ ...packageDraft, name: 'Before' });
      getStore().updatePackage(pkg.id, { name: 'After', durationText: 'Approx. 2 hours' });
      const found = getStore().packages.find((p) => p.id === pkg.id);
      expect(found?.name).toBe('After');
      expect(found?.durationText).toBe('Approx. 2 hours');
    });

    it('archives, restores, and deletes a package', () => {
      const pkg = getStore().addPackage(packageDraft);
      getStore().archivePackage(pkg.id);
      expect(getStore().packages[0].status).toBe('ARCHIVED');
      getStore().restorePackage(pkg.id);
      expect(getStore().packages[0].status).toBe('ACTIVE');
      getStore().deletePackage(pkg.id);
      expect(getStore().packages.find((p) => p.id === pkg.id)).toBeUndefined();
    });

    it('adds, updates, and removes a breakdown item', () => {
      const pkg = getStore().addPackage(packageDraft);
      getStore().addBreakdownItem(pkg.id, {
        type: 'CONSULTATION',
        name: 'Consult',
        unitPrice: 100,
        quantity: 1,
        discount: 10,
        isBookable: true,
        isInpatientPreferred: true,
      });
      expect(getStore().packages[0].breakdown).toHaveLength(1);
      const itemId = getStore().packages[0].breakdown[0].id;
      getStore().updateBreakdownItem(pkg.id, itemId, { quantity: 3, discount: 15 });
      expect(getStore().packages[0].breakdown[0].quantity).toBe(3);
      expect(getStore().packages[0].breakdown[0].discount).toBe(15);
      getStore().removeBreakdownItem(pkg.id, itemId);
      expect(getStore().packages[0].breakdown).toHaveLength(0);
    });

    it('updateBreakdownItem ignores non-matching packageId', () => {
      const pkg = getStore().addPackage(packageDraft);
      getStore().addBreakdownItem(pkg.id, {
        type: 'CONSULTATION',
        name: 'Consult',
        unitPrice: 100,
        quantity: 1,
        discount: 0,
      });
      const itemId = getStore().packages[0].breakdown[0].id;
      getStore().updateBreakdownItem('wrong-pkg-id', itemId, { quantity: 99 });
      expect(getStore().packages[0].breakdown[0].quantity).toBe(1);
    });
  });

  describe('generateItemCode', () => {
    it('generates service and package codes', () => {
      expect(getStore().generateItemCode('CONSULTATION')).toMatch(/^CS-\d{4}$/);
      expect(getStore().generateItemCode('PACKAGE')).toMatch(/^PK-\d{4}$/);
      expect(getStore().generateItemCode('PROCEDURE')).toMatch(/^PR-\d{4}$/);
    });
  });
});
