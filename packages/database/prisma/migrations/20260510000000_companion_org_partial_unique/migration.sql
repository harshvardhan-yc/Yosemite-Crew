-- Align Postgres uniqueness with prior MongoDB behavior:
-- Mongo enforced uniqueness only for ACTIVE links (partial unique index),
-- allowing historical links in other statuses.
--
-- Previously created by initial migration:
--   CREATE UNIQUE INDEX "companion_org_unique_active"
--   ON "CompanionOrganisation"("companionId", "organisationId", "organisationType");
--
-- Replace with a partial unique index matching `status = 'ACTIVE'`.

DROP INDEX IF EXISTS "companion_org_unique_active";

CREATE UNIQUE INDEX "companion_org_unique_active"
ON "CompanionOrganisation"("companionId", "organisationId", "organisationType")
WHERE "status" = 'ACTIVE';

