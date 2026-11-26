import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NemoProtectionError,
  buildPoolConfig,
  getDbPool,
  withUserDb,
} from '../../api/_core/lib/db';
import type { PoolLike } from '../../api/_core/lib/db';

const TEST_UID = '11111111-2222-4333-8444-555555555555';

describe('functions db pool config & RLS transaction wrapper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('normalizes remote Supavisor URLs with max: 1 and allowExitOnIdle: true', () => {
    const remote = buildPoolConfig(
      'postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
    );
    expect(remote.max).toBe(1);
    expect(remote.allowExitOnIdle).toBe(true);
    expect(remote.ssl).toEqual({ rejectUnauthorized: false });
    expect(remote.connectionString).not.toContain('sslmode=require');

    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'true';
    const strictRemote = buildPoolConfig(
      'postgresql://postgres:secret@db.wisemapping.supabase.co:5432/postgres',
    );
    expect(strictRemote.ssl).toEqual({ rejectUnauthorized: true });

    const local = buildPoolConfig('postgresql://postgres:postgres@localhost:5432/wisemapping');
    expect(local.ssl).toBe(false);
  });

  it('blocks pool creation when DATABASE_URL or SUPABASE_URL targets nemo', () => {
    expect(() =>
      getDbPool('postgresql://postgres:pw@db.nemo-app.supabase.co:5432/postgres'),
    ).toThrowError(NemoProtectionError);

    process.env.SUPABASE_URL = 'https://NEMO.supabase.co';
    expect(() =>
      getDbPool('postgresql://postgres:pw@db.wisemapping.supabase.co:5432/postgres'),
    ).toThrowError(NemoProtectionError);
  });

  it('wraps queries in BEGIN -> set_config(request.jwt.claims) -> SET LOCAL ROLE authenticated -> COMMIT', async () => {
    const executed: Array<{ text: string; values?: unknown[] }> = [];
    let released = false;

    const fakePool: PoolLike = {
      async connect() {
        return {
          async query(text: string, values?: unknown[]) {
            executed.push({ text, values });
            return { rows: [{ ok: true }], rowCount: 1 } as never;
          },
          release() {
            released = true;
          },
        } as never;
      },
    };

    const result = await withUserDb(
      { uid: TEST_UID, email: '  A.Jian0629@Gmail.com ' },
      async (client) => {
        const res = await client.query<{ ok: boolean }>('SELECT 1 AS ok');
        return res.rows[0]?.ok;
      },
      fakePool,
    );

    expect(result).toBe(true);
    expect(released).toBe(true);
    expect(executed.map((q) => q.text)).toEqual([
      'BEGIN',
      `SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'email', $2::text, 'role', 'authenticated')::text, true)`,
      'SET LOCAL ROLE authenticated',
      'SELECT 1 AS ok',
      'COMMIT',
    ]);
    expect(executed[1]?.values).toEqual([TEST_UID, 'a.jian0629@gmail.com']);
  });

  it('rolls back transaction and releases client on callback error', async () => {
    const executed: string[] = [];
    let released = false;

    const fakePool: PoolLike = {
      async connect() {
        return {
          async query(text: string) {
            executed.push(text);
            return { rows: [], rowCount: 0 } as never;
          },
          release() {
            released = true;
          },
        } as never;
      },
    };

    await expect(
      withUserDb(
        { uid: TEST_UID, email: 'a.jian0629@gmail.com' },
        async () => {
          throw new Error('simulated query failure');
        },
        fakePool,
      ),
    ).rejects.toThrow('simulated query failure');

    expect(released).toBe(true);
    expect(executed).toEqual([
      'BEGIN',
      `SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'email', $2::text, 'role', 'authenticated')::text, true)`,
      'SET LOCAL ROLE authenticated',
      'ROLLBACK',
    ]);
  });

  it('rejects invalid UUIDs before connecting to pool', async () => {
    let connected = false;
    const fakePool: PoolLike = {
      async connect() {
        connected = true;
        throw new Error('should not connect');
      },
    };

    await expect(
      withUserDb({ uid: 'not-a-uuid', email: 'a.jian0629@gmail.com' }, async () => {}, fakePool),
    ).rejects.toThrow(/UUID/);
    expect(connected).toBe(false);
  });
});
