import type { Migration } from './migrate';

/** Add new migrations at the end. Never edit one that has been applied. */
export const migrations: readonly Migration[] = [
  {
    id: '0001_identity',
    sql: `
      CREATE TABLE accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL CHECK (kind IN ('guest', 'registered')),
        display_name TEXT NOT NULL,
        age_band TEXT NOT NULL CHECK (age_band IN ('under13', '13to15', '16plus')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        authenticated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX sessions_account_id ON sessions (account_id);

      CREATE TABLE passkeys (
        id TEXT PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        public_key BYTEA NOT NULL,
        counter BIGINT NOT NULL,
        transports TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used_at TIMESTAMPTZ
      );
      CREATE INDEX passkeys_account_id ON passkeys (account_id);

      CREATE TABLE webauthn_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        challenge TEXT NOT NULL,
        purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
        account_id UUID REFERENCES accounts (id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE consents (
        account_id UUID PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
        analytics BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
];
