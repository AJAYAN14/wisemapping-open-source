import crypto from 'node:crypto';
import { DatabaseError } from 'pg';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  NemoProtectionError,
  applyMigrationFile,
  assertNotNemoTarget,
  createDbPool,
  loadDbEnv,
  withRlsTransaction,
} from './migrate-helper';

const envStatus = loadDbEnv();

function requireRow<T extends QueryResultRow>(rows: T[], context: string): T {
  const first = rows[0];
  if (!first) {
    throw new Error(`Expected at least one row for ${context}`);
  }
  return first;
}

async function expectPgErrorCode(
  action: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  if (caught instanceof DatabaseError) {
    expect(caught.code).toBe(expectedCode);
    return;
  }
  if (typeof caught === 'object' && caught !== null && 'code' in caught) {
    expect((caught as { code: unknown }).code).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected PostgreSQL error code ${expectedCode}, received: ${String(caught)}`);
}

describe('M2 nemo target protection guard (offline)', () => {
  it('aborts loudly when SUPABASE_URL or DATABASE_URL references nemo without leaking secrets', () => {
    expect(() =>
      assertNotNemoTarget({
        SUPABASE_URL: 'https://nemo-project.supabase.co',
      }),
    ).toThrow(NemoProtectionError);

    let capturedError: unknown;
    try {
      assertNotNemoTarget({
        DATABASE_URL: 'postgresql://postgres:top-secret-password@db.NeMo.supabase.co:5432/postgres',
      });
    } catch (err) {
      capturedError = err;
    }
    expect(capturedError).toBeInstanceOf(NemoProtectionError);
    const message = (capturedError as Error).message;
    expect(message).not.toContain('top-secret-password');
    expect(message).not.toContain('db.NeMo.supabase.co');

    expect(() =>
      createDbPool('postgresql://postgres:secret@db.nemo.supabase.co:5432/postgres'),
    ).toThrow(NemoProtectionError);
  });

  it('allows non-nemo Supabase and PostgreSQL URLs', () => {
    expect(() =>
      assertNotNemoTarget({
        SUPABASE_URL: 'https://wisemapping-private.supabase.co',
        DATABASE_URL: 'postgresql://postgres:pw@db.wisemapping-private.supabase.co:5432/postgres',
      }),
    ).not.toThrow();

    expect(() =>
      assertNotNemoTarget({
        SUPABASE_URL: undefined,
        DATABASE_URL: undefined,
      }),
    ).not.toThrow();
  });

  it('blocks percent-encoded nemo URLs, malformed %ZZ queries, and PG* env vars without leaking passwords', () => {
    const encodedTargets = [
      {
        label: 'Supavisor tenant username postgres.%6e%65%6d%6f',
        url: 'postgresql://postgres.%6e%65%6d%6f:secret-supavisor-pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        secret: 'secret-supavisor-pw',
        expectPoolThrow: true,
      },
      {
        label: 'percent-encoded hostname %6e%65%6d%6f.supabase.co',
        url: 'postgresql://user:secret-host-pw@%6e%65%6d%6f.supabase.co:5432/postgres',
        secret: 'secret-host-pw',
        expectPoolThrow: true,
      },
      {
        label: 'percent-encoded password',
        url: 'https://user:%6e%65%6d%6f@example.supabase.co',
        secret: '%6e%65%6d%6f',
        expectPoolThrow: false,
      },
      {
        label: 'malformed %ZZ query with %6e%65%6d%6f path',
        url: 'postgresql://user:secret-malformed-pw@db.example.supabase.co:5432/%6e%65%6d%6f?bad=%ZZ',
        secret: 'secret-malformed-pw',
        expectPoolThrow: true,
      },
    ];

    for (const target of encodedTargets) {
      let capturedAssertErr: unknown;
      try {
        assertNotNemoTarget(
          target.url.startsWith('https://')
            ? { SUPABASE_URL: target.url }
            : { DATABASE_URL: target.url },
        );
      } catch (err) {
        capturedAssertErr = err;
      }
      expect(capturedAssertErr, target.label).toBeInstanceOf(NemoProtectionError);
      const msg = (capturedAssertErr as Error).message;
      expect(msg, target.label).not.toContain(target.secret);
      expect(msg, target.label).not.toContain('example.supabase.co');

      if (target.expectPoolThrow) {
        let capturedPoolErr: unknown;
        try {
          createDbPool(target.url);
        } catch (err) {
          capturedPoolErr = err;
        }
        expect(capturedPoolErr, `${target.label} createDbPool`).toBeInstanceOf(NemoProtectionError);
        expect((capturedPoolErr as Error).message, `${target.label} createDbPool`).not.toContain(
          target.secret,
        );
      }
    }

    const prevEnv = {
      PGDATABASE: process.env.PGDATABASE,
      PGHOST: process.env.PGHOST,
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_LIVE_DB: process.env.REQUIRE_LIVE_DB,
    };
    try {
      process.env.PGDATABASE = 'nemo';
      delete process.env.REQUIRE_LIVE_DB;
      expect(() =>
        createDbPool('postgresql://postgres:pw@db.example.supabase.co:5432'),
      ).toThrow(NemoProtectionError);

      process.env.DATABASE_URL = 'postgresql://postgres:pw@db.example.supabase.co:5432/postgres';
      expect(() => loadDbEnv()).toThrow(NemoProtectionError);

      delete process.env.PGDATABASE;
      process.env.PGHOST = '%6e%65%6d%6f.supabase.co';
      expect(() =>
        createDbPool('postgresql://postgres:pw@db.example.supabase.co:5432/postgres'),
      ).toThrow(NemoProtectionError);
    } finally {
      if (prevEnv.PGDATABASE === undefined) delete process.env.PGDATABASE;
      else process.env.PGDATABASE = prevEnv.PGDATABASE;
      if (prevEnv.PGHOST === undefined) delete process.env.PGHOST;
      else process.env.PGHOST = prevEnv.PGHOST;
      if (prevEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevEnv.DATABASE_URL;
      if (prevEnv.REQUIRE_LIVE_DB === undefined) delete process.env.REQUIRE_LIVE_DB;
      else process.env.REQUIRE_LIVE_DB = prevEnv.REQUIRE_LIVE_DB;
    }
  });
});

describe('M2 withRlsTransaction pool release safety (offline)', () => {
  it('destroys pooled client via client.release(err) when ROLLBACK fails and releases cleanly otherwise', async () => {
    const createMockPool = (options: { rollbackFails: boolean }) => {
      const releaseCalls: Array<Error | boolean | undefined> = [];
      const mockClient = {
        query: async (sql: string) => {
          if (sql === 'ROLLBACK' && options.rollbackFails) {
            throw new Error('rollback_socket_closed');
          }
          return { rows: [], rowCount: 0 };
        },
        release: (err?: Error | boolean) => {
          releaseCalls.push(err);
        },
      } as unknown as PoolClient;

      const mockPool: Pick<Pool, 'connect'> = {
        connect: async () => mockClient,
      };
      return { mockPool, releaseCalls };
    };

    const failCase = createMockPool({ rollbackFails: true });
    await expect(
      withRlsTransaction(
        failCase.mockPool,
        { role: 'authenticated', userId: crypto.randomUUID(), email: 'a@example.invalid' },
        async () => {
          throw new Error('query_failed');
        },
      ),
    ).rejects.toThrow('query_failed');
    expect(failCase.releaseCalls).toHaveLength(1);
    expect(failCase.releaseCalls[0]).toBeInstanceOf(Error);
    expect((failCase.releaseCalls[0] as Error).message).toBe('rollback_socket_closed');

    const okRollbackCase = createMockPool({ rollbackFails: false });
    await expect(
      withRlsTransaction(
        okRollbackCase.mockPool,
        { role: 'authenticated', userId: crypto.randomUUID(), email: 'a@example.invalid' },
        async () => {
          throw new Error('recoverable_query_error');
        },
      ),
    ).rejects.toThrow('recoverable_query_error');
    expect(okRollbackCase.releaseCalls).toEqual([undefined]);

    const commitCase = createMockPool({ rollbackFails: false });
    await expect(
      withRlsTransaction(commitCase.mockPool, { role: 'anon' }, async () => 'ok'),
    ).resolves.toBe('ok');
    expect(commitCase.releaseCalls).toEqual([undefined]);
  });
});

describe.skipIf(!envStatus.hasLiveEnv)(
  'M2 live Supabase PostgreSQL schema, RLS & optimistic locking',
  { timeout: 30_000 },
  () => {
    let pool: Pool;
    const ownerAId = crypto.randomUUID();
    const ownerBId = crypto.randomUUID();
    const ownerAEmail = `m2-test-a-${ownerAId}@example.invalid`;
    const ownerBEmail = `m2-test-b-${ownerBId}@example.invalid`;

    beforeAll(async () => {
      if (!envStatus.databaseUrl) {
        throw new Error('DATABASE_URL is required for live DB tests.');
      }
      pool = createDbPool(envStatus.databaseUrl);

      // Apply idempotent migration twice consecutively
      await applyMigrationFile(pool);
      await applyMigrationFile(pool);

      try {
        await pool.query(
          `INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
          ) VALUES
            ($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', $2, '', NOW(), '{"provider":"google","providers":["google"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
            ($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', $4, '', NOW(), '{"provider":"google","providers":["google"]}'::jsonb, '{}'::jsonb, NOW(), NOW())`,
          [ownerAId, ownerAEmail, ownerBId, ownerBEmail],
        );
      } catch (err) {
        await pool
          .query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ownerAId, ownerBId]])
          .catch(() => undefined);
        throw err;
      }
    }, 30_000);

    afterAll(async () => {
      if (pool) {
        await pool
          .query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ownerAId, ownerBId]])
          .catch(() => undefined);
        await pool.end();
      }
    });

    it('verifies idempotent schema metadata, forced RLS, FK indexes, and zero anon policies', async () => {
      await expect(applyMigrationFile(pool)).resolves.toBeUndefined();

      const tableRows = await pool.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND c.relname = ANY($1::text[])
         ORDER BY c.relname`,
        [['labels', 'mindmap_history', 'mindmap_labels', 'mindmaps']],
      );
      expect(tableRows.rows).toHaveLength(4);
      for (const row of tableRows.rows) {
        expect(row.relrowsecurity).toBe(true);
        expect(row.relforcerowsecurity).toBe(true);
      }

      const xmlColumns = await pool.query<{ table_name: string; data_type: string }>(
        `SELECT table_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND column_name = 'xml'
           AND table_name IN ('mindmaps', 'mindmap_history')`,
      );
      expect(xmlColumns.rows).toHaveLength(2);
      for (const col of xmlColumns.rows) {
        expect(col.data_type).toBe('text');
      }

      const anonPolicies = await pool.query<{ policyname: string }>(
        `SELECT policyname
         FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename IN ('mindmaps', 'mindmap_history', 'labels', 'mindmap_labels')
           AND ('anon' = ANY(roles) OR 'public' = ANY(roles))`,
      );
      expect(anonPolicies.rows).toHaveLength(0);

      const unindexedFks = await pool.query<{ table_name: string; fk_column: string }>(
        `SELECT
           n.nspname || '.' || cl.relname AS table_name,
           a.attname AS fk_column
         FROM pg_constraint c
         JOIN pg_class cl ON cl.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = cl.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
         WHERE c.contype = 'f'
           AND n.nspname = 'public'
           AND cl.relname IN ('mindmaps', 'mindmap_history', 'labels', 'mindmap_labels')
           AND NOT EXISTS (
             SELECT 1
             FROM pg_index i
             WHERE i.indrelid = c.conrelid
               AND i.indisvalid
               AND a.attnum = i.indkey[0]
           )`,
      );
      expect(unindexedFks.rows).toHaveLength(0);
    });

    it('denies anon role access (42501) on all four tables', async () => {
      const tables = ['mindmaps', 'mindmap_history', 'labels', 'mindmap_labels'] as const;
      for (const table of tables) {
        await expectPgErrorCode(
          () =>
            withRlsTransaction(pool, { role: 'anon' }, (client) =>
              client.query(`SELECT * FROM public.${table} LIMIT 1`),
            ),
          '42501',
        );
      }

      await expectPgErrorCode(
        () =>
          withRlsTransaction(pool, { role: 'anon' }, (client) =>
            client.query(
              `INSERT INTO public.mindmaps (owner_id, title, xml)
               VALUES ($1::uuid, 'Anon Blocked', '<map/>')`,
              [ownerAId],
            ),
          ),
        '42501',
      );
    });

    it('enforces authenticated single-owner RLS isolation across SELECT/INSERT/UPDATE/DELETE and cleans SET LOCAL state', async () => {
      const inserted = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
        (client) =>
          client.query<{ id: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
             VALUES ($1::uuid, 'RLS Isolation Map', '<map version="tango"><topic central="true" text="A"/></map>', $2)
             RETURNING id`,
            [ownerAId, ownerAEmail],
          ),
      );
      const mapId = Number(requireRow(inserted.rows, 'inserted map').id);

      const ownerBInserted = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
        (client) =>
          client.query<{ id: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
             VALUES ($1::uuid, 'Owner B Map', '<map version="tango"><topic central="true" text="B"/></map>', $2)
             RETURNING id`,
            [ownerBId, ownerBEmail],
          ),
      );
      const ownerBMapId = Number(requireRow(ownerBInserted.rows, 'owner B map').id);

      try {
        // Owner B cannot SELECT, UPDATE, or DELETE Owner A's map
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
          async (client) => {
            const selectRes = await client.query('SELECT id FROM public.mindmaps WHERE id = $1', [
              mapId,
            ]);
            expect(selectRes.rowCount).toBe(0);

            const updateRes = await client.query(
              'UPDATE public.mindmaps SET title = $1 WHERE id = $2',
              ['Hijacked', mapId],
            );
            expect(updateRes.rowCount).toBe(0);

            const deleteRes = await client.query('DELETE FROM public.mindmaps WHERE id = $1', [
              mapId,
            ]);
            expect(deleteRes.rowCount).toBe(0);
          },
        );

        // Owner B cannot spoof Owner A's owner_id on INSERT
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.mindmaps (owner_id, title, xml)
                   VALUES ($1::uuid, 'Spoofed', '<map/>')`,
                  [ownerAId],
                ),
            ),
          '42501',
        );

        // Owner B cannot transfer ownership of Owner B's own row to Owner A via UPDATE
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  'UPDATE public.mindmaps SET owner_id = $1::uuid WHERE id = $2',
                  [ownerAId, ownerBMapId],
                ),
            ),
          '42501',
        );

        // Verify SET LOCAL ROLE / request.jwt.claims did not leak out of transaction
        const postTx = await pool.query<{ uid: string | null }>('SELECT auth.uid()::text AS uid');
        expect(requireRow(postTx.rows, 'post-tx auth.uid()').uid).toBeNull();
      } finally {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [mapId]),
        ).catch(() => undefined);
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
          (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [ownerBMapId]),
        ).catch(() => undefined);
      }
    });

    it('supports mindmap CRUD, plain TEXT Unicode XML, 512-char title/description, and duplicate titles for duplicateMap', async () => {
      const longTitle = 'T'.repeat(512);
      const longDesc = 'D'.repeat(512);
      const unicodeXml =
        '<map name="Unicode" version="tango" theme="prism"><topic central="true" text="脑图 🚀 &amp; test" id="1"/></map>';

      const created = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
        async (client) => {
          const first = await client.query<{
            id: string;
            title: string;
            description: string;
            xml: string;
            version: number;
          }>(
            `INSERT INTO public.mindmaps (owner_id, title, description, xml, last_modification_by)
             VALUES ($1::uuid, $2, $3, $4, $5)
             RETURNING id, title, description, xml, version`,
            [ownerAId, longTitle, longDesc, unicodeXml, ownerAEmail],
          );
          const duplicate = await client.query<{ id: string; title: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, description, xml, last_modification_by)
             VALUES ($1::uuid, $2, $3, $4, $5)
             RETURNING id, title`,
            [ownerAId, longTitle, '', unicodeXml, ownerAEmail],
          );
          return {
            first: requireRow(first.rows, 'first mindmap'),
            duplicate: requireRow(duplicate.rows, 'duplicate mindmap'),
          };
        },
      );

      const firstId = Number(created.first.id);
      const duplicateId = Number(created.duplicate.id);
      try {
        expect(created.first.title).toBe(longTitle);
        expect(created.first.description).toBe(longDesc);
        expect(created.first.xml).toBe(unicodeXml);
        expect(created.first.xml.startsWith('PK')).toBe(false);
        expect(created.first.version).toBe(1);
        expect(created.duplicate.title).toBe(longTitle);
        expect(duplicateId).not.toBe(firstId);
      } finally {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) =>
            client.query('DELETE FROM public.mindmaps WHERE id = ANY($1::bigint[])', [
              [firstId, duplicateId],
            ]),
        );
      }
    });

    it('retains all mindmap_history snapshots permanently, blocks cross-owner inserts, and cascades on delete', async () => {
      const inserted = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
        (client) =>
          client.query<{ id: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
             VALUES ($1::uuid, 'History Map', '<map v="0"/>', $2)
             RETURNING id`,
            [ownerAId, ownerAEmail],
          ),
      );
      const mapId = Number(requireRow(inserted.rows, 'history map').id);

      try {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          async (client) => {
            for (let i = 1; i <= 6; i += 1) {
              await client.query(
                `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
                 VALUES ($1, $2::uuid, $3, $4)`,
                [mapId, ownerAId, `<map snapshot="${i}"/>`, ownerAEmail],
              );
            }
            const countRes = await client.query<{ count: string }>(
              'SELECT COUNT(*) AS count FROM public.mindmap_history WHERE mindmap_id = $1',
              [mapId],
            );
            expect(Number(requireRow(countRes.rows, 'history count').count)).toBe(6);
          },
        );

        // Cross-owner history insert referencing Owner A's mindmap_id must fail with 42501
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
                   VALUES ($1, $2::uuid, '<map hijack="true"/>', $3)`,
                  [mapId, ownerBId, ownerBEmail],
                ),
            ),
          '42501',
        );

        // Cross-owner history UPDATE reassigning mindmap_id to Owner A's mindmap must fail with 42501
        const ownerBMapRes = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
          async (client) => {
            const bMap = await client.query<{ id: string }>(
              `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
               VALUES ($1::uuid, 'Owner B History Map', '<map v="0"/>', $2)
               RETURNING id`,
              [ownerBId, ownerBEmail],
            );
            const bMapId = Number(requireRow(bMap.rows, 'owner B history map').id);
            const bHist = await client.query<{ id: string }>(
              `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
               VALUES ($1, $2::uuid, '<map b="1"/>', $3)
               RETURNING id`,
              [bMapId, ownerBId, ownerBEmail],
            );
            return { bMapId, bHistId: Number(requireRow(bHist.rows, 'owner B history row').id) };
          },
        );
        try {
          await expectPgErrorCode(
            () =>
              withRlsTransaction(
                pool,
                { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
                (client) =>
                  client.query(
                    'UPDATE public.mindmap_history SET mindmap_id = $1 WHERE id = $2',
                    [mapId, ownerBMapRes.bHistId],
                  ),
              ),
            '42501',
          );
        } finally {
          await withRlsTransaction(
            pool,
            { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
            (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [ownerBMapRes.bMapId]),
          ).catch(() => undefined);
        }

        // Deleting parent mindmap cascades mindmap_history rows
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [mapId]),
        );

        const remaining = await pool.query<{ count: string }>(
          'SELECT COUNT(*) AS count FROM public.mindmap_history WHERE mindmap_id = $1',
          [mapId],
        );
        expect(Number(requireRow(remaining.rows, 'cascaded history count').count)).toBe(0);
      } finally {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [mapId]),
        ).catch(() => undefined);
      }
    });

    it('supports labels with parent_label_id without 42P17 recursion, blocks cross-owner joins, and enforces uniqueness', async () => {
      const mapRes = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
        (client) =>
          client.query<{ id: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
             VALUES ($1::uuid, 'Labeled Map', '<map/>', $2)
             RETURNING id`,
            [ownerAId, ownerAEmail],
          ),
      );
      const mapId = Number(requireRow(mapRes.rows, 'labeled map').id);

      let parentLabelId = 0;
      let childLabelId = 0;
      let ownerBLabelId = 0;

      try {
        const labelsCreated = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          async (client) => {
            const p = await client.query<{ id: string }>(
              `INSERT INTO public.labels (owner_id, title, color)
               VALUES ($1::uuid, 'Work', '#0565ff')
               RETURNING id`,
              [ownerAId],
            );
            const pId = Number(requireRow(p.rows, 'parent label').id);

            // Nested parent_label_id owned by Owner A must succeed with zero 42P17 recursion
            const c = await client.query<{ id: string }>(
              `INSERT INTO public.labels (owner_id, title, color, parent_label_id)
               VALUES ($1::uuid, 'Urgent', '#ff0000', $2)
               RETURNING id`,
              [ownerAId, pId],
            );
            const cId = Number(requireRow(c.rows, 'child label').id);

            await client.query(
              `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id)
               VALUES ($1, $2, $3::uuid)`,
              [mapId, cId, ownerAId],
            );
            return { pId, cId };
          },
        );
        parentLabelId = labelsCreated.pId;
        childLabelId = labelsCreated.cId;

        // Duplicate label title for same owner fails with 23505
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.labels (owner_id, title, color)
                   VALUES ($1::uuid, 'Work', '#00b327')`,
                  [ownerAId],
                ),
            ),
          '23505',
        );

        // Self-parenting check constraint fails with 23514
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
              (client) =>
                client.query(
                  'UPDATE public.labels SET parent_label_id = id WHERE id = $1',
                  [parentLabelId],
                ),
            ),
          '23514',
        );

        // Duplicate (mindmap_id, label_id) assignment fails with 23505
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id)
                   VALUES ($1, $2, $3::uuid)`,
                  [mapId, childLabelId, ownerAId],
                ),
            ),
          '23505',
        );

        // Owner B cannot attach their own label to Owner A's mindmap or create a child under Owner A's label
        const bLblRes = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
          (client) =>
            client.query<{ id: string }>(
              `INSERT INTO public.labels (owner_id, title, color)
               VALUES ($1::uuid, 'B-Label', '#123456')
               RETURNING id`,
              [ownerBId],
            ),
        );
        ownerBLabelId = Number(requireRow(bLblRes.rows, 'owner B label').id);

        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.labels (owner_id, title, color, parent_label_id)
                   VALUES ($1::uuid, 'HijackChild', '#654321', $2)`,
                  [ownerBId, parentLabelId],
                ),
            ),
          '42501',
        );

        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id)
                   VALUES ($1, $2, $3::uuid)`,
                  [mapId, ownerBLabelId, ownerBId],
                ),
            ),
          '42501',
        );

        // Owner B cannot reparent Owner B's label under Owner A's parent label via UPDATE
        await expectPgErrorCode(
          () =>
            withRlsTransaction(
              pool,
              { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
              (client) =>
                client.query(
                  'UPDATE public.labels SET parent_label_id = $1 WHERE id = $2',
                  [parentLabelId, ownerBLabelId],
                ),
            ),
          '42501',
        );

        // Deleting parent label cascades child label and mindmap_labels join rows
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) => client.query('DELETE FROM public.labels WHERE id = $1', [parentLabelId]),
        );

        const joinCount = await pool.query<{ count: string }>(
          'SELECT COUNT(*) AS count FROM public.mindmap_labels WHERE mindmap_id = $1',
          [mapId],
        );
        expect(Number(requireRow(joinCount.rows, 'cascaded mindmap_labels count').count)).toBe(0);
      } finally {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          async (client) => {
            if (parentLabelId > 0) {
              await client.query('DELETE FROM public.labels WHERE id = $1', [parentLabelId]);
            }
            await client.query('DELETE FROM public.mindmaps WHERE id = $1', [mapId]);
          },
        ).catch(() => undefined);
        if (ownerBLabelId > 0) {
          await withRlsTransaction(
            pool,
            { role: 'authenticated', userId: ownerBId, email: ownerBEmail },
            (client) => client.query('DELETE FROM public.labels WHERE id = $1', [ownerBLabelId]),
          ).catch(() => undefined);
        }
      }
    });

    it('enforces atomic version optimistic locking sequentially and under concurrent Promise.all race', async () => {
      const inserted = await withRlsTransaction(
        pool,
        { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
        (client) =>
          client.query<{ id: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml, last_modification_by)
             VALUES ($1::uuid, 'Optimistic Lock Map', '<map v="1"/>', $2)
             RETURNING id`,
            [ownerAId, ownerAEmail],
          ),
      );
      const mapId = Number(requireRow(inserted.rows, 'optimistic lock map').id);

      try {
        // Sequential 1 -> 2 succeeds
        const update1 = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) =>
            client.query<{ version: number; xml: string }>(
              `UPDATE public.mindmaps
               SET xml = $1, version = version + 1, last_modification_time = NOW()
               WHERE id = $2 AND owner_id = $3::uuid AND version = $4
               RETURNING version, xml`,
              ['<map v="2"/>', mapId, ownerAId, 1],
            ),
        );
        expect(update1.rowCount).toBe(1);
        expect(requireRow(update1.rows, 'update1').version).toBe(2);

        // Stale version = 1 fails with rowCount === 0 and preserves version = 2 XML
        const staleUpdate = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) =>
            client.query<{ version: number }>(
              `UPDATE public.mindmaps
               SET xml = $1, version = version + 1
               WHERE id = $2 AND owner_id = $3::uuid AND version = $4
               RETURNING version`,
              ['<map stale="true"/>', mapId, ownerAId, 1],
            ),
        );
        expect(staleUpdate.rowCount).toBe(0);

        // Concurrent Promise.all race with version = 2 across two separate pool connections
        const [raceA, raceB] = await Promise.all([
          withRlsTransaction(
            pool,
            { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
            (client) =>
              client.query<{ version: number; xml: string }>(
                `UPDATE public.mindmaps
                 SET xml = $1, version = version + 1, last_modification_time = NOW()
                 WHERE id = $2 AND owner_id = $3::uuid AND version = $4
                 RETURNING version, xml`,
                ['<map winner="A"/>', mapId, ownerAId, 2],
              ),
          ),
          withRlsTransaction(
            pool,
            { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
            (client) =>
              client.query<{ version: number; xml: string }>(
                `UPDATE public.mindmaps
                 SET xml = $1, version = version + 1, last_modification_time = NOW()
                 WHERE id = $2 AND owner_id = $3::uuid AND version = $4
                 RETURNING version, xml`,
                ['<map winner="B"/>', mapId, ownerAId, 2],
              ),
          ),
        ]);

        const totalWinners = (raceA.rowCount ?? 0) + (raceB.rowCount ?? 0);
        expect(totalWinners).toBe(1);

        const finalRow = await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) =>
            client.query<{ version: number; xml: string }>(
              'SELECT version, xml FROM public.mindmaps WHERE id = $1',
              [mapId],
            ),
        );
        const current = requireRow(finalRow.rows, 'final version row');
        expect(current.version).toBe(3);
        expect(['<map winner="A"/>', '<map winner="B"/>']).toContain(current.xml);
      } finally {
        await withRlsTransaction(
          pool,
          { role: 'authenticated', userId: ownerAId, email: ownerAEmail },
          (client) => client.query('DELETE FROM public.mindmaps WHERE id = $1', [mapId]),
        );
      }
    });
  },
);
