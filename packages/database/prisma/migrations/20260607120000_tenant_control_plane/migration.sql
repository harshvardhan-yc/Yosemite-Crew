CREATE TABLE IF NOT EXISTS public."Enterprise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enterprise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Enterprise_slug_key" ON public."Enterprise"("slug");

CREATE TABLE IF NOT EXISTS public."Tenant" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enterpriseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Tenant_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES public."Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_tenantKey_key" ON public."Tenant"("tenantKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_schemaName_key" ON public."Tenant"("schemaName");
CREATE INDEX IF NOT EXISTS "Tenant_enterpriseId_idx" ON public."Tenant"("enterpriseId");

CREATE TABLE IF NOT EXISTS public."EnterpriseMembership" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnterpriseMembership_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES public."Enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseMembership_enterpriseId_userId_key" ON public."EnterpriseMembership"("enterpriseId", "userId");
CREATE INDEX IF NOT EXISTS "EnterpriseMembership_userId_idx" ON public."EnterpriseMembership"("userId");

CREATE TABLE IF NOT EXISTS public."TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_tenantId_userId_key" ON public."TenantMembership"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "TenantMembership_userId_idx" ON public."TenantMembership"("userId");
