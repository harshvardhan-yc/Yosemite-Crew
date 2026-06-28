import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { createPrismaClient, getTenantPrismaCache, prisma } from './client.js';

const DEFAULT_TENANT_SCHEMA_PREFIX = 'tenant_';
const RESERVED_SCHEMA_NAMES = new Set(['public', 'information_schema', 'pg_catalog']);

export type TenantDatabaseClient = PrismaClient;

export type TenantRegistryRecord = {
  id: string;
  tenantKey: string;
  schemaName: string;
  displayName: string;
  enterpriseId: string | null;
  status: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterTenantInput = {
  tenantKey: string;
  displayName: string;
  enterpriseId?: string | null;
  metadata?: Prisma.JsonValue;
  id?: string;
  schemaName?: string;
  status?: string;
};

const sanitizeTenantKey = (tenantKey: string) =>
  tenantKey
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const isTenantSchemaName = (schemaName: string) =>
  /^[a-z][a-z0-9_]{0,62}$/.test(schemaName) &&
  !schemaName.startsWith('pg_') &&
  !RESERVED_SCHEMA_NAMES.has(schemaName);

export const toTenantSchemaName = (tenantKey: string, prefix = DEFAULT_TENANT_SCHEMA_PREFIX) => {
  const normalizedTenantKey = sanitizeTenantKey(tenantKey);
  const schemaName = `${prefix}${normalizedTenantKey}`;

  if (!normalizedTenantKey) {
    throw new Error('Tenant key is required to derive a schema name.');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(normalizedTenantKey)) {
    throw new Error(
      'Tenant key must start with a letter and contain only letters, numbers, spaces, hyphens, or underscores.'
    );
  }

  if (!isTenantSchemaName(schemaName)) {
    throw new Error(
      `Derived schema name "${schemaName}" is invalid. PostgreSQL schema names must be lowercase, not reserved, and at most 63 characters.`
    );
  }

  return schemaName;
};

export const buildSchemaScopedDatabaseUrl = (
  schemaName: string,
  baseDatabaseUrl = process.env.DATABASE_URL
) => {
  if (!baseDatabaseUrl) {
    throw new Error('DATABASE_URL is required to create a tenant Prisma client.');
  }

  if (!isTenantSchemaName(schemaName) && schemaName !== 'public') {
    throw new Error(`Invalid PostgreSQL schema name "${schemaName}".`);
  }

  const url = new URL(baseDatabaseUrl);
  url.searchParams.set('schema', schemaName);
  return url.toString();
};

export const getTenantPrismaClient = ({
  tenantKey,
  schemaName,
  baseDatabaseUrl,
}: {
  tenantKey?: string;
  schemaName?: string;
  baseDatabaseUrl?: string;
}) => {
  const resolvedSchemaName = schemaName ?? (tenantKey ? toTenantSchemaName(tenantKey) : null);

  if (!resolvedSchemaName) {
    throw new Error('Either tenantKey or schemaName is required.');
  }

  const datasourceUrl = buildSchemaScopedDatabaseUrl(resolvedSchemaName, baseDatabaseUrl);
  const cache = getTenantPrismaCache();
  const cacheKey = datasourceUrl;

  const existingClient = cache.get(cacheKey);
  if (existingClient) {
    return existingClient;
  }

  const client = createPrismaClient(datasourceUrl);
  cache.set(cacheKey, client);
  return client;
};

export const disconnectTenantPrismaClients = async () => {
  const cache = getTenantPrismaCache();

  await Promise.all([...cache.values()].map((client) => client.$disconnect()));
  cache.clear();
};

export const ensureTenantSchemaExists = async (
  schemaName: string,
  controlPlanePrisma: PrismaClient = prisma
) => {
  if (!isTenantSchemaName(schemaName)) {
    throw new Error(`Invalid PostgreSQL schema name "${schemaName}".`);
  }

  await controlPlanePrisma.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`
  );
};

export const findTenantByKey = async (
  tenantKey: string,
  controlPlanePrisma: PrismaClient = prisma
) => {
  const rows = await controlPlanePrisma.$queryRaw<TenantRegistryRecord[]>(
    Prisma.sql`
      SELECT
        id,
        "tenantKey",
        "schemaName",
        "displayName",
        "enterpriseId",
        status,
        metadata,
        "createdAt",
        "updatedAt"
      FROM public."Tenant"
      WHERE "tenantKey" = ${tenantKey}
      LIMIT 1
    `
  );

  return rows[0] ?? null;
};

export const registerTenant = async (
  input: RegisterTenantInput,
  controlPlanePrisma: PrismaClient = prisma
) => {
  const schemaName = input.schemaName ?? toTenantSchemaName(input.tenantKey);

  await ensureTenantSchemaExists(schemaName, controlPlanePrisma);

  const rows = await controlPlanePrisma.$queryRaw<TenantRegistryRecord[]>(
    Prisma.sql`
      INSERT INTO public."Tenant" (
        id,
        "tenantKey",
        "schemaName",
        "displayName",
        "enterpriseId",
        status,
        metadata,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${input.id ?? randomUUID()},
        ${input.tenantKey},
        ${schemaName},
        ${input.displayName},
        ${input.enterpriseId ?? null},
        ${input.status ?? 'ACTIVE'},
        ${input.metadata ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantKey")
      DO UPDATE SET
        "schemaName" = EXCLUDED."schemaName",
        "displayName" = EXCLUDED."displayName",
        "enterpriseId" = EXCLUDED."enterpriseId",
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        id,
        "tenantKey",
        "schemaName",
        "displayName",
        "enterpriseId",
        status,
        metadata,
        "createdAt",
        "updatedAt"
    `
  );

  return rows[0];
};
