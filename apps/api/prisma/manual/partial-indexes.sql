-- Not applied. Prisma cannot declare this partial index.
-- Add it to the initial migration when a local database is configured.
CREATE UNIQUE INDEX auth_nonces_one_active_per_wallet
  ON auth_nonces (user_wallet)
  WHERE used_at IS NULL AND retired_at IS NULL;
