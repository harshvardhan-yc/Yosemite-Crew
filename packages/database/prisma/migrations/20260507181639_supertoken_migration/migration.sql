-- CreateEnum
CREATE TYPE "AuthIdentityProvider" AS ENUM ('SUPERTOKENS');

-- CreateEnum
CREATE TYPE "AuthUserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthSessionClient" AS ENUM ('WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "AuthFactorType" AS ENUM ('TOTP', 'PASSKEY', 'RECOVERY_CODES');

-- CreateEnum
CREATE TYPE "AuthChallengeType" AS ENUM ('LOGIN_MFA', 'STEP_UP');

-- CreateEnum
CREATE TYPE "AuthChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "primaryEmail" TEXT,
    "primaryEmailLower" TEXT,
    "primaryEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "AuthUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "emailLower" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "rawClaims" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL,
    "providerSessionHandle" TEXT,
    "client" "AuthSessionClient" NOT NULL,
    "deviceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_factors" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "type" "AuthFactorType" NOT NULL,
    "label" TEXT,
    "secretEnc" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "auth_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "type" "AuthChallengeType" NOT NULL,
    "status" "AuthChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "meta" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_accounts_primaryEmailLower_idx" ON "auth_accounts"("primaryEmailLower");

-- CreateIndex
CREATE INDEX "auth_identities_authAccountId_idx" ON "auth_identities"("authAccountId");

-- CreateIndex
CREATE INDEX "auth_identities_emailLower_idx" ON "auth_identities"("emailLower");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerUserId_key" ON "auth_identities"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "auth_sessions_authAccountId_idx" ON "auth_sessions"("authAccountId");

-- CreateIndex
CREATE INDEX "auth_sessions_providerSessionHandle_idx" ON "auth_sessions"("providerSessionHandle");

-- CreateIndex
CREATE INDEX "auth_sessions_revokedAt_idx" ON "auth_sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "auth_factors_authAccountId_idx" ON "auth_factors"("authAccountId");

-- CreateIndex
CREATE INDEX "auth_factors_type_idx" ON "auth_factors"("type");

-- CreateIndex
CREATE INDEX "auth_challenges_authAccountId_idx" ON "auth_challenges"("authAccountId");

-- CreateIndex
CREATE INDEX "auth_challenges_status_idx" ON "auth_challenges"("status");

-- CreateIndex
CREATE INDEX "auth_challenges_expiresAt_idx" ON "auth_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_factors" ADD CONSTRAINT "auth_factors_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
