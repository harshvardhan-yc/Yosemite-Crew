import {clusterClinics} from '@/features/appointments/utils/clusterClinics';
import type {
  ClinicMapItem,
  ClusterMapItem,
} from '@/features/appointments/utils/clusterClinics';
import type {VetBusiness} from '@/features/appointments/types';

const makeClinic = (overrides: Partial<VetBusiness> = {}): VetBusiness => ({
  id: 'c1',
  name: 'Test Clinic',
  category: 'hospital',
  address: '123 Main St',
  lat: 37.7,
  lng: -122.4,
  ...overrides,
});

describe('clusterClinics', () => {
  describe('when latitudeDelta is below the cluster threshold (< 0.08)', () => {
    it('returns each clinic as an individual ClinicMapItem', () => {
      const clinics = [makeClinic({id: 'a'}), makeClinic({id: 'b'})];
      const result = clusterClinics(clinics, 0.05);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({type: 'clinic', clinic: clinics[0]});
      expect(result[1]).toEqual({type: 'clinic', clinic: clinics[1]});
    });

    it('returns single clinic as individual item even at delta exactly 0', () => {
      const clinics = [makeClinic()];
      const result = clusterClinics(clinics, 0);
      expect(result).toHaveLength(1);
      expect((result[0] as ClinicMapItem).type).toBe('clinic');
    });
  });

  describe('when fewer than 2 clinics are provided', () => {
    it('returns single clinic as individual item regardless of latitudeDelta', () => {
      const clinic = makeClinic();
      const result = clusterClinics([clinic], 0.5);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({type: 'clinic', clinic});
    });

    it('returns empty array for zero clinics', () => {
      const result = clusterClinics([], 0.5);
      expect(result).toEqual([]);
    });
  });

  describe('when latitudeDelta >= 0.08 and 2+ clinics', () => {
    it('clusters clinics in the same grid cell into a ClusterMapItem', () => {
      // cellSize = 0.5 / 5 = 0.1; both clinics fall in the same row/col
      const clinics = [
        makeClinic({id: 'a', lat: 37.05, lng: -122.05}),
        makeClinic({id: 'b', lat: 37.06, lng: -122.06}),
      ];
      const result = clusterClinics(clinics, 0.5);
      expect(result).toHaveLength(1);
      const cluster = result[0] as ClusterMapItem;
      expect(cluster.type).toBe('cluster');
      expect(cluster.count).toBe(2);
      expect(cluster.id).toMatch(/^cluster_/);
    });

    it('calculates cluster lat/lng as the average of grouped clinics', () => {
      const clinics = [
        makeClinic({id: 'a', lat: 37.0, lng: -122.0}),
        makeClinic({id: 'b', lat: 37.0, lng: -122.0}),
      ];
      const result = clusterClinics(clinics, 0.5);
      const cluster = result[0] as ClusterMapItem;
      expect(cluster.lat).toBeCloseTo(37.0, 5);
      expect(cluster.lng).toBeCloseTo(-122.0, 5);
    });

    it('returns individual ClinicMapItem for clinics in different cells', () => {
      // cellSize = 0.5 / 5 = 0.1
      // clinic A: row = floor(37.0/0.1), col = floor(-122.0/0.1) → one cell
      // clinic B: row = floor(38.0/0.1), col = floor(-121.0/0.1) → different cell
      const clinics = [
        makeClinic({id: 'a', lat: 37.0, lng: -122.0}),
        makeClinic({id: 'b', lat: 38.0, lng: -121.0}),
      ];
      const result = clusterClinics(clinics, 0.5);
      expect(result).toHaveLength(2);
      result.forEach(item => expect(item.type).toBe('clinic'));
    });

    it('mixes clusters and individual clinics from the same call', () => {
      // Two clinics cluster in one cell; one clinic is alone in another cell
      const clinics = [
        makeClinic({id: 'a', lat: 37.01, lng: -122.01}), // same cell as b
        makeClinic({id: 'b', lat: 37.02, lng: -122.02}), // same cell as a
        makeClinic({id: 'c', lat: 38.0, lng: -121.0}), // own cell
      ];
      const result = clusterClinics(clinics, 0.5);
      const clusters = result.filter(
        r => r.type === 'cluster',
      ) as ClusterMapItem[];
      const individuals = result.filter(
        r => r.type === 'clinic',
      ) as ClinicMapItem[];
      expect(clusters).toHaveLength(1);
      expect(clusters[0].count).toBe(2);
      expect(individuals).toHaveLength(1);
    });

    it('skips clinics whose lat or lng is null/undefined', () => {
      const clinics = [
        makeClinic({id: 'x', lat: undefined, lng: undefined}),
        makeClinic({id: 'a', lat: 37.01, lng: -122.01}),
        makeClinic({id: 'b', lat: 37.02, lng: -122.02}),
      ];
      const result = clusterClinics(clinics, 0.5);
      // x is skipped; a and b may cluster
      const totalCount = result.reduce(
        (sum, item) =>
          sum + (item.type === 'cluster' ? (item as ClusterMapItem).count : 1),
        0,
      );
      expect(totalCount).toBe(2); // only the 2 valid clinics count
    });

    it('handles latitudeDelta exactly at the threshold (0.08) — should cluster', () => {
      // 0.08 is NOT below threshold (condition is latitudeDelta < 0.08)
      const clinics = [
        makeClinic({id: 'a', lat: 37.01, lng: -122.01}),
        makeClinic({id: 'b', lat: 37.01, lng: -122.01}),
      ];
      const result = clusterClinics(clinics, 0.08);
      // delta = 0.08 → NOT less than threshold → clustering applies
      const hasCluster = result.some(r => r.type === 'cluster');
      expect(hasCluster).toBe(true);
    });
  });
});
