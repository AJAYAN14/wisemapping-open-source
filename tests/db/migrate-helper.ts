import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const ENV_LOCAL_PATH = path.join(ROOT, '.env.local');
export const MIGRATION_FILE = path.join(ROOT, 'supabase/migrations/0001_initial_schema.sql');

export class NemoProtectionError extends Error {
  readonly targetKey: string;

  constructor(targetKey: string) {
    super(
      `Aborted: target ${targetKey} references forbidden 'nemo' resource. Never connect to or modify anything named nemo.`,
    );
    this.name = 'NemoProtectionError';
    this.targetKey = targetKey;
  }
}

export interface DbEnvStatus {
  envLocalExists: boolean;
  hasLiveEnv: boolean;
  requireLiveDb: boolean;
  databaseUrl?: string;
  supabaseUrl?: string;
}

const NEMO_PATTERN = /nemo/i;

function safeDecodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(/(?:%[0-9a-fA-F]{2})+/g, (encodedSeq) => {
      try {
        return decodeURIComponent(encodedSeq);
      } catch {
        return encodedSeq.replace(/%[0-7][0-9a-fA-F]/g, (asciiHex) => {
          try {
            return decodeURIComponent(asciiHex);
          } catch {
            return asciiHex;
          }
        });
      }
    });
  }
}

function safeDecodeURIComponent(value: string, maxPasses = 3): string {
  let current = value;
  for (let i = 0; i < maxPasses; i += 1) {
    const next = safeDecodeOnce(current);
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

function collectUrlCandidates(parsed: URL): string[] {
  const candidates: string[] = [
    parsed.hostname,
    parsed.pathname,
    parsed.search,
    parsed.hash,
    parsed.username,
    parsed.password,
  ];
  for (const [key, val] of parsed.searchParams.entries()) {
    candidates.push(key, val);
  }
  return candidates;
}

function containsNemoInValueOrUrl(rawValue: string): boolean {
  if (NEMO_PATTERN.test(rawValue) || NEMO_PATTERN.test(safeDecodeURIComponent(rawValue))) {
    return true;
  }

  const candidates: string[] = [];
  for (const parser of [
    () => new URL(rawValue),
    () => new URL(rawValue, 'postgres://base'),
    () => new URL(rawValue.replace('@/', '@___DUMMY___/'), 'postgres://base'),
  ]) {
    try {
      const parsed = parser();
      candidates.push(...collectUrlCandidates(parsed));
      break;
    } catch {
      // Try next URL parsing strategy
    }
  }

  return candidates.some(
    (part) => NEMO_PATTERN.test(part) || NEMO_PATTERN.test(safeDecodeURIComponent(part)),
  );
}

export interface NemoTargetVars {
  SUPABASE_URL?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  DATABASE_URL?: string | undefined;
  PGHOST?: string | undefined;
  PGHOSTADDR?: string | undefined;
  PGDATABASE?: string | undefined;
  PGUSER?: string | undefined;
  PGOPTIONS?: string | undefined;
  PGSERVICE?: string | undefined;
}

const NEMO_TARGET_KEYS: ReadonlyArray<keyof NemoTargetVars> = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'DATABASE_URL',
  'PGHOST',
  'PGHOSTADDR',
  'PGDATABASE',
  'PGUSER',
  'PGOPTIONS',
  'PGSERVICE',
];

function readProcessNemoEnvVars(): Omit<NemoTargetVars, 'DATABASE_URL'> {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL?.trim() || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
    PGHOST: process.env.PGHOST?.trim() || undefined,
    PGHOSTADDR: process.env.PGHOSTADDR?.trim() || undefined,
    PGDATABASE: process.env.PGDATABASE?.trim() || undefined,
    PGUSER: process.env.PGUSER?.trim() || undefined,
    PGOPTIONS: process.env.PGOPTIONS?.trim() || undefined,
    PGSERVICE: process.env.PGSERVICE?.trim() || undefined,
  };
}

export function assertNotNemoTarget(vars: NemoTargetVars): void {
  for (const key of NEMO_TARGET_KEYS) {
    const value = vars[key];
    if (value && containsNemoInValueOrUrl(value)) {
      throw new NemoProtectionError(key);
    }
  }
}

export function loadDbEnv(): DbEnvStatus {
  const envLocalExists = fs.existsSync(ENV_LOCAL_PATH);
  if (envLocalExists) {
    loadDotenv({ path: ENV_LOCAL_PATH, quiet: true });
  }

  const processVars = readProcessNemoEnvVars();
  const supabaseUrl = processVars.SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
  const requireLiveDb = process.env.REQUIRE_LIVE_DB === '1';

  assertNotNemoTarget({
    ...processVars,
    DATABASE_URL: databaseUrl,
  });

  const hasLiveEnv = Boolean(databaseUrl);

  if (requireLiveDb && !hasLiveEnv) {
    throw new Error(
      'REQUIRE_LIVE_DB=1 is set, but .env.local or DATABASE_URL is missing. Provision .env.local before running live DB verification.',
    );
  }

  return {
    envLocalExists,
    hasLiveEnv,
    requireLiveDb,
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(supabaseUrl ? { supabaseUrl } : {}),
  };
}

export function createDbPool(databaseUrl: string): Pool {
  assertNotNemoTarget({
    ...readProcessNemoEnvVars(),
    DATABASE_URL: databaseUrl,
  });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('Invalid DATABASE_URL format.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isLocalHost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();

  let ssl: false | { rejectUnauthorized: false };
  if (sslMode === 'disable') {
    ssl = false;
  } else if (isLocalHost && sslMode !== 'require') {
    ssl = false;
  } else {
    // Strip sslmode/uselibpqcompat so pg-connection-string does not emit warnings
    // or override ssl.rejectUnauthorized on Supabase direct/Supavisor connections.
    parsedUrl.searchParams.delete('sslmode');
    parsedUrl.searchParams.delete('uselibpqcompat');
    ssl = { rejectUnauthorized: false };
  }

  return new Pool({
    connectionString: parsedUrl.toString(),
    ssl,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function applyMigrationFile(
  pool: Pool,
  migrationPath = MIGRATION_FILE,
): Promise<void> {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  if (NEMO_PATTERN.test(sql)) {
    throw new NemoProtectionError('MIGRATION_SQL');
  }

  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

export type RlsContext =
  | { role: 'authenticated'; userId: string; email?: string }
  | { role: 'anon' };

export async function withRlsTransaction<T>(
  pool: Pick<Pool, 'connect'>,
  ctx: RlsContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let releaseErr: Error | undefined;
  try {
    await client.query('BEGIN');
    if (ctx.role === 'authenticated') {
      await client.query(
        "SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'email', $2::text, 'role', 'authenticated')::text, true)",
        [ctx.userId, ctx.email ?? ''],
      );
      await client.query('SET LOCAL ROLE authenticated');
    } else {
      await client.query("SELECT set_config('request.jwt.claims', '', true)");
      await client.query('SET LOCAL ROLE anon');
    }

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      releaseErr = rbErr instanceof Error ? rbErr : new Error(String(rbErr));
    }
    throw err;
  } finally {
    client.release(releaseErr);
  }
}
