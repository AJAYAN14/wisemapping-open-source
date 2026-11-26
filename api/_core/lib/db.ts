import { Pool } from 'pg';
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import {
  NemoProtectionError,
  assertNotNemoTarget,
  getDatabaseSslRejectUnauthorized,
} from './env.js';

export { NemoProtectionError, assertNotNemoTarget };

export interface DbUserContext {
  uid: string;
  email: string;
}

export interface DbClient {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildPoolConfig(rawDatabaseUrl: string): PoolConfig {
  let hostname = '';
  let normalizedUrl = rawDatabaseUrl;
  try {
    const parsed = new URL(rawDatabaseUrl);
    hostname = parsed.hostname.toLowerCase();
    // Normalize sslmode for pg@8.23+ so Supavisor (port 6543) & direct Supabase connections
    // use explicit ssl config without pg-connection-string verify-full overrides/warnings.
    const sslmode = parsed.searchParams.get('sslmode')?.toLowerCase();
    if (sslmode && sslmode !== 'disable' && sslmode !== 'verify-full') {
      parsed.searchParams.delete('sslmode');
      normalizedUrl = parsed.toString();
    }
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URI.');
  }

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const rejectUnauthorized = getDatabaseSslRejectUnauthorized();

  return {
    connectionString: normalizedUrl,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    ssl: isLocal ? false : { rejectUnauthorized },
  };
}

let cachedPool: Pool | undefined;
let cachedConnectionString: string | undefined;

export function getDbPool(databaseUrl?: string): Pool {
  const effectiveDatabaseUrl = databaseUrl ?? process.env.DATABASE_URL;
  assertNotNemoTarget({
    DATABASE_URL: effectiveDatabaseUrl,
    SUPABASE_URL: process.env.SUPABASE_URL,
  });

  const connStr = effectiveDatabaseUrl?.trim();
  if (!connStr) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  if (cachedPool && cachedConnectionString === connStr) {
    return cachedPool;
  }

  if (cachedPool) {
    void cachedPool.end().catch(() => {});
  }

  const pool = new Pool(buildPoolConfig(connStr));
  pool.on('error', (err) => {
    console.error('[db] Unexpected idle pg pool error:', err.message);
  });

  cachedPool = pool;
  cachedConnectionString = connStr;
  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (cachedPool) {
    const poolToClose = cachedPool;
    cachedPool = undefined;
    cachedConnectionString = undefined;
    await poolToClose.end();
  }
}

export interface PoolLike {
  connect(): Promise<
    Pick<PoolClient, 'query' | 'release'>
  >;
}

export async function withUserDb<T>(
  user: DbUserContext,
  fn: (client: DbClient) => Promise<T>,
  poolOverride?: PoolLike,
): Promise<T> {
  if (!UUID_REGEX.test(user.uid)) {
    throw new Error('Invalid user UUID for RLS transaction context.');
  }
  const normalizedEmail = user.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('User email is required for RLS transaction context.');
  }

  const pool: PoolLike = poolOverride ?? getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // Transaction-scoped claims (is_local = true) + SET LOCAL ROLE authenticated:
    // Resets automatically on COMMIT/ROLLBACK; safe on Supavisor port 6543 transaction pooling.
    // Always use unnamed parameterized queries (compatible with transaction pooling).
    await client.query(
      `SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'email', $2::text, 'role', 'authenticated')::text, true)`,
      [user.uid, normalizedEmail],
    );
    await client.query('SET LOCAL ROLE authenticated');

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve original error
    }
    throw err;
  } finally {
    client.release();
  }
}
