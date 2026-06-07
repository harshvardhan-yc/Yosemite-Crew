import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchemaScopedDatabaseUrl, isTenantSchemaName, toTenantSchemaName } from './tenant.js';

test('toTenantSchemaName derives a tenant schema from a clinic key', () => {
  assert.equal(toTenantSchemaName('Blue-Hill Clinic'), 'tenant_blue_hill_clinic');
});

test('tenant schema helpers reject invalid or reserved names', () => {
  assert.throws(() => toTenantSchemaName('123 clinic'), /Tenant key must start with a letter/);
  assert.equal(isTenantSchemaName('public'), false);
  assert.equal(isTenantSchemaName('pg_internal'), false);
});

test('buildSchemaScopedDatabaseUrl adds or replaces the schema parameter', () => {
  assert.equal(
    buildSchemaScopedDatabaseUrl('tenant_blue_hill', 'postgresql://user:pass@localhost:5432/yc'),
    'postgresql://user:pass@localhost:5432/yc?schema=tenant_blue_hill'
  );

  assert.equal(
    buildSchemaScopedDatabaseUrl(
      'tenant_green_valley',
      'postgresql://user:pass@localhost:5432/yc?schema=public&connection_limit=5'
    ),
    'postgresql://user:pass@localhost:5432/yc?schema=tenant_green_valley&connection_limit=5'
  );
});
