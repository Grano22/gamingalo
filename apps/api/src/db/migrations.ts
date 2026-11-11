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
  {
    id: '0002_hosting',
    sql: `
      CREATE TABLE api_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used_at TIMESTAMPTZ
      );
      CREATE INDEX api_tokens_account_id ON api_tokens (account_id);

      CREATE TABLE games (
        id TEXT PRIMARY KEY,
        owner_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        production_version TEXT,
        preview_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX games_owner_id ON games (owner_id);

      CREATE TABLE signing_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ
      );

      CREATE TABLE game_versions (
        game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        entry TEXT NOT NULL,
        manifest_signature TEXT NOT NULL,
        signing_key_id UUID NOT NULL REFERENCES signing_keys (id),
        status TEXT NOT NULL CHECK (status IN ('uploading', 'ready')),
        total_bytes BIGINT NOT NULL,
        file_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (game_id, version)
      );

      CREATE TABLE game_files (
        game_id TEXT NOT NULL,
        version TEXT NOT NULL,
        path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size BIGINT NOT NULL,
        PRIMARY KEY (game_id, version, path),
        FOREIGN KEY (game_id, version) REFERENCES game_versions (game_id, version) ON DELETE CASCADE
      );

      CREATE TABLE players (
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
        player_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        PRIMARY KEY (account_id, game_id)
      );

      CREATE TABLE play_tokens (
        token_hash TEXT PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `,
  },
];
