DROP INDEX IF EXISTS "Invoice_stripePaymentIntentId_idx";
DROP INDEX IF EXISTS "Invoice_stripeCheckoutSessionId_idx";

ALTER TABLE "Invoice"
  DROP COLUMN IF EXISTS "stripePaymentIntentId",
  DROP COLUMN IF EXISTS "stripePaymentLinkId",
  DROP COLUMN IF EXISTS "stripeInvoiceId",
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeChargeId",
  DROP COLUMN IF EXISTS "stripeReceiptUrl",
  DROP COLUMN IF EXISTS "stripeCheckoutSessionId",
  DROP COLUMN IF EXISTS "stripeCheckoutUrl";
