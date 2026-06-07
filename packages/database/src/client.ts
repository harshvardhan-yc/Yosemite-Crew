import { PrismaClient } from '@prisma/client';

type GlobalPrismaCache = {
  controlPlanePrisma?: PrismaClient;
  tenantPrismaClients?: Map<string, PrismaClient>;
};

const globalForPrisma = globalThis as unknown as GlobalPrismaCache;

export const createPrismaClient = (databaseUrl?: string) =>
  new PrismaClient({
    log: ['error'],
    ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
  });

export const prisma = globalForPrisma.controlPlanePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.controlPlanePrisma = prisma;
}

export const getTenantPrismaCache = () => {
  globalForPrisma.tenantPrismaClients ??= new Map<string, PrismaClient>();

  return globalForPrisma.tenantPrismaClients;
};
