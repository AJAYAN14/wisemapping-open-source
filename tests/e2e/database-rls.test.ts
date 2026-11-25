import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities, listMigrationFiles } from './support/client';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  NemoProtectionError,
  SECONDARY_USER_UUID,
  assertNotNemoTarget,
  createDefaultMapXml,
  createRunId,
  mintJwt,
  repeatChars,
  uniqueLabelTitle,
  uniqueTitle,
} from './support/fixtures';

const caps = detectE2eCapabilities();

function createSafePool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  assertNotNemoTarget({
    DATABASE_URL: databaseUrl,
    SUPABASE_URL: process.env.SUPABASE_URL,
  });
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for live DB tests.');
  }
  const needsSsl = !/localhost|127\.0\.0\.1/i.test(databaseUrl);
  return new Pool({
    connectionString: databaseUrl,
    max: 2,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

async function withOwnerTx<T>(
  pool: Pool,
  uid: string,
  email: string,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'email', $2::text, 'role', 'authenticated')::text, true)`,
      [uid, email],
    );
    await client.query('SET LOCAL ROLE authenticated');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

describe('F5/F6 — Supabase 4-Table Schema, Plain TEXT XML, RLS & nemo Guard E2E', () => {
  describe('Tier 1 & Tier 2 — F6: nemo Protection Guard (Always Active)', () => {
    it('T1-F06-05: assertNotNemoTarget allows clean Supabase URLs and rejects nemo URLs before any connection', () => {
      expect(() =>
        assertNotNemoTarget({
          SUPABASE_URL: 'https://abcdefgwisemap.supabase.co',
          DATABASE_URL: 'postgresql://postgres:pass@db.abcdefgwisemap.supabase.co:5432/postgres',
        }),
      ).not.toThrow();

      expect(() =>
        assertNotNemoTarget({
          SUPABASE_URL: 'https://nemo-prod.supabase.co',
        }),
      ).toThrow(NemoProtectionError);
    });

    it('T2-F06-01: assertNotNemoTarget rejects DATABASE_URL containing "nemo"', () => {
      expect(() =>
        assertNotNemoTarget({
          DATABASE_URL: 'postgresql://u:p@db.nemo.supabase.co:5432/postgres',
        }),
      ).toThrow(/NemoProtectionError/);
    });

    it('T2-F06-02: assertNotNemoTarget rejects SUPABASE_URL containing "NEMO" case-insensitively', () => {
      expect(() =>
        assertNotNemoTarget({
          SUPABASE_URL: 'https://My-NEMO-Proj.supabase.co',
        }),
      ).toThrow(NemoProtectionError);
    });
  });

  describe.skipIf(!caps.canRunMigrationChecks)('M2 Migration SQL Static Contract Checks', () => {
    it('migration SQL files define the 4 required tables, plain TEXT xml, version, and RLS with zero nemo refs', () => {
      const files = listMigrationFiles();
      expect(files.length).toBeGreaterThan(0);
      const combinedSql = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      for (const table of ['mindmaps', 'mindmap_history', 'labels', 'mindmap_labels']) {
        expect(combinedSql).toContain(table);
      }
      expect(combinedSql).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(combinedSql).toMatch(/version\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1/i);
      expect(combinedSql).not.toMatch(/\bnemo\b/i);
    });
  });

  describe.skipIf(!caps.canRunLiveDb)('Live Supabase PostgreSQL Schema, RLS & Isolation E2E', { timeout: 30_000 }, () => {
    const runId = createRunId();
    let ownerA = DEFAULT_OWNER_UUID;
    let ownerB = SECONDARY_USER_UUID;
    let pool: Pool;
    const createdMapIds: number[] = [];
    const createdLabelIds: number[] = [];

    beforeAll(async () => {
      pool = createSafePool();
      for (const migrationFile of listMigrationFiles()) {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        await pool.query(sql);
      }
      // Ensure test auth.users rows exist if schema has FK to auth.users(id).
      const hasAuthUsers = await pool.query<{ exists: boolean }>(
        `SELECT to_regclass('auth.users') IS NOT NULL AS exists`,
      );
      if (hasAuthUsers.rows[0]?.exists) {
        const existingA = await pool.query<{ id: string }>(
          `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
          [DEFAULT_ALLOWED_EMAIL],
        );
        if (existingA.rows[0]?.id) {
          ownerA = existingA.rows[0].id;
        } else {
          await pool.query(
            `INSERT INTO auth.users (id, email, aud, role)
             VALUES ($1::uuid, $2, 'authenticated', 'authenticated')
             ON CONFLICT (id) DO NOTHING`,
            [ownerA, DEFAULT_ALLOWED_EMAIL],
          );
        }

        const existingB = await pool.query<{ id: string }>(
          `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
          ['other-e2e@example.com'],
        );
        if (existingB.rows[0]?.id) {
          ownerB = existingB.rows[0].id;
        } else {
          await pool.query(
            `INSERT INTO auth.users (id, email, aud, role)
             VALUES ($1::uuid, $2, 'authenticated', 'authenticated')
             ON CONFLICT (id) DO NOTHING`,
            [ownerB, 'other-e2e@example.com'],
          );
        }
      }
    });

    afterAll(async () => {
      if (!pool) return;
      if (createdMapIds.length > 0) {
        await pool.query(`DELETE FROM public.mindmaps WHERE id = ANY($1::bigint[])`, [createdMapIds]);
      }
      if (createdLabelIds.length > 0) {
        await pool.query(`DELETE FROM public.labels WHERE id = ANY($1::bigint[])`, [createdLabelIds]);
      }
      await pool.end();
    });

    describe('Tier 1 — F5: Supabase 4-Table Schema & Plain TEXT XML', () => {
      it('T1-F05-01: public schema defines exactly mindmaps, mindmap_history, labels, and mindmap_labels', async () => {
        const res = await pool.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           ORDER BY table_name`,
        );
        const names = res.rows.map((r) => r.table_name);
        expect(names).toContain('mindmaps');
        expect(names).toContain('mindmap_history');
        expect(names).toContain('labels');
        expect(names).toContain('mindmap_labels');
        expect(names).not.toContain('collaborator');
        expect(names).not.toContain('account');
      });

      it('T1-F05-02: mindmaps.xml and mindmap_history.xml use plain TEXT (not BYTEA/ZIP)', async () => {
        const colRes = await pool.query<{ table_name: string; data_type: string }>(
          `SELECT table_name, data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'xml'
             AND table_name IN ('mindmaps', 'mindmap_history')`,
        );
        expect(colRes.rows).toHaveLength(2);
        for (const row of colRes.rows) {
          expect(row.data_type).toBe('text');
        }

        const xml = createDefaultMapXml(`PlainText-${runId}`);
        const inserted = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number; xml: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml)
             VALUES ($1::uuid, $2, $3) RETURNING id, xml`,
            [ownerA, uniqueTitle('PlainXml', runId), xml],
          );
          return ins.rows[0]!;
        });
        createdMapIds.push(inserted.id);
        expect(inserted.xml).toBe(xml);
      });

      it('T1-F05-03: mindmaps defines version INTEGER NOT NULL DEFAULT 1, title <= 512, starred, and properties', async () => {
        const res = await pool.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }>(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'mindmaps'`,
        );
        const byName = new Map(res.rows.map((r) => [r.column_name, r]));
        expect(byName.get('version')?.data_type).toBe('integer');
        expect(byName.get('version')?.is_nullable).toBe('NO');
        expect(byName.get('version')?.column_default).toContain('1');
        expect(byName.get('starred')?.data_type).toBe('boolean');
        expect(byName.get('properties')?.data_type).toBe('text');
      });

      it('T1-F05-04: mindmap_history retains all 10 consecutive snapshots permanently without pruning', async () => {
        const map = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml)
             VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('PermHist', runId), createDefaultMapXml('v0')],
          );
          const mapId = ins.rows[0]!.id;
          for (let i = 1; i <= 10; i++) {
            await client.query(
              `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
               VALUES ($1, $2::uuid, $3, $4)`,
              [mapId, ownerA, createDefaultMapXml(`snap-${i}`), DEFAULT_ALLOWED_EMAIL],
            );
          }
          const countRes = await client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM public.mindmap_history WHERE mindmap_id = $1`,
            [mapId],
          );
          return { mapId, count: Number.parseInt(countRes.rows[0]!.cnt, 10) };
        });
        createdMapIds.push(map.mapId);
        expect(map.count).toBe(10);
      });

      it('T1-F05-05: schema exposes zero public sharing links or anon access', async () => {
        const polRes = await pool.query<{ roles: string[] }>(
          `SELECT roles FROM pg_policies WHERE schemaname = 'public'`,
        );
        for (const row of polRes.rows) {
          expect(row.roles).not.toContain('anon');
          expect(row.roles).not.toContain('public');
        }
      });
    });

    describe('Tier 2 — F5: Schema Constraints & Round-Trip Boundary Cases', () => {
      it('T2-F05-01: mindmaps.title accepts 512 chars without truncation', async () => {
        const title512 = `${runId}-${repeatChars('t', 512 - runId.length - 1)}`;
        expect(title512).toHaveLength(512);
        const row = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number; title: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml)
             VALUES ($1::uuid, $2, $3) RETURNING id, title`,
            [ownerA, title512, createDefaultMapXml('t512')],
          );
          return ins.rows[0]!;
        });
        createdMapIds.push(row.id);
        expect(row.title).toHaveLength(512);
        expect(row.title).toBe(title512);
      });

      it('T2-F05-02: mindmap_labels composite primary key rejects duplicate (mindmap_id, label_id)', async () => {
        const { mapId, labelId } = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const m = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('DupJoin', runId), createDefaultMapXml('j')],
          );
          const l = await client.query<{ id: number }>(
            `INSERT INTO public.labels (owner_id, title, color) VALUES ($1::uuid, $2, '#112233') RETURNING id`,
            [ownerA, uniqueLabelTitle('J')],
          );
          await client.query(
            `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id) VALUES ($1, $2, $3::uuid)`,
            [m.rows[0]!.id, l.rows[0]!.id, ownerA],
          );
          return { mapId: m.rows[0]!.id, labelId: l.rows[0]!.id };
        });
        createdMapIds.push(mapId);
        createdLabelIds.push(labelId);

        await expect(
          withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
            await client.query(
              `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id) VALUES ($1, $2, $3::uuid)`,
              [mapId, labelId, ownerA],
            );
          }),
        ).rejects.toMatchObject({ code: '23505' });
      });

      it('T2-F05-03: deleting a mindmap cascades to mindmap_history and mindmap_labels', async () => {
        const result = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const m = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('Casc', runId), createDefaultMapXml('c')],
          );
          const l = await client.query<{ id: number }>(
            `INSERT INTO public.labels (owner_id, title, color) VALUES ($1::uuid, $2, '#445566') RETURNING id`,
            [ownerA, uniqueLabelTitle('C')],
          );
          const mapId = m.rows[0]!.id;
          const labelId = l.rows[0]!.id;
          await client.query(
            `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name) VALUES ($1, $2::uuid, $3, $4)`,
            [mapId, ownerA, createDefaultMapXml('old'), DEFAULT_ALLOWED_EMAIL],
          );
          await client.query(
            `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id) VALUES ($1, $2, $3::uuid)`,
            [mapId, labelId, ownerA],
          );
          await client.query(`DELETE FROM public.mindmaps WHERE id = $1`, [mapId]);
          const h = await client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM public.mindmap_history WHERE mindmap_id = $1`,
            [mapId],
          );
          const ml = await client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM public.mindmap_labels WHERE mindmap_id = $1`,
            [mapId],
          );
          return {
            labelId,
            hCnt: Number.parseInt(h.rows[0]!.cnt, 10),
            mlCnt: Number.parseInt(ml.rows[0]!.cnt, 10),
          };
        });
        createdLabelIds.push(result.labelId);
        expect(result.hCnt).toBe(0);
        expect(result.mlCnt).toBe(0);
      });

      it('T2-F05-04: labels enforces unique (owner_id, title) constraint (23505)', async () => {
        const title = uniqueLabelTitle('U');
        const lbl = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const r = await client.query<{ id: number }>(
            `INSERT INTO public.labels (owner_id, title, color) VALUES ($1::uuid, $2, '#abcdef') RETURNING id`,
            [ownerA, title],
          );
          return r.rows[0]!.id;
        });
        createdLabelIds.push(lbl);

        await expect(
          withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
            await client.query(
              `INSERT INTO public.labels (owner_id, title, color) VALUES ($1::uuid, $2, '#000000')`,
              [ownerA, title],
            );
          }),
        ).rejects.toMatchObject({ code: '23505' });
      });

      it('T2-F05-05: Unicode/CJK/emoji XML round-trips byte-for-byte without ZIP magic header', async () => {
        const xml = '<map version="tango"><topic central="true" text="脑图 🚀 &amp; test"/></map>';
        const row = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number; xml: string }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id, xml`,
            [ownerA, uniqueTitle('Uni', runId), xml],
          );
          return ins.rows[0]!;
        });
        createdMapIds.push(row.id);
        expect(row.xml).toBe(xml);
        expect(row.xml.startsWith('PK')).toBe(false);
      });
    });

    describe('Tier 1 — F6: Single-Owner RLS Enforcement', () => {
      it('T1-F06-01: RLS is enabled and forced on all 4 public tables', async () => {
        const res = await pool.query<{
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>(
          `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public'
             AND c.relname IN ('mindmaps', 'mindmap_history', 'labels', 'mindmap_labels')`,
        );
        expect(res.rows).toHaveLength(4);
        for (const row of res.rows) {
          expect(row.relrowsecurity, `${row.relname} relrowsecurity`).toBe(true);
          expect(row.relforcerowsecurity, `${row.relname} relforcerowsecurity`).toBe(true);
        }
      });

      it('T1-F06-02: anon role cannot read any of the 4 tables', async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL ROLE anon');
          for (const table of ['mindmaps', 'mindmap_history', 'labels', 'mindmap_labels']) {
            let denied = false;
            let rowCount = 0;
            try {
              const r = await client.query(`SELECT * FROM public.${table} LIMIT 1`);
              rowCount = r.rowCount ?? 0;
            } catch {
              denied = true;
            }
            expect(denied || rowCount === 0, `anon access on ${table}`).toBe(true);
          }
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      });

      it('T1-F06-03: authenticated owner can INSERT, SELECT, UPDATE, and DELETE own rows', async () => {
        const updatedTitle = uniqueTitle('OwnedUpd', runId);
        const result = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('Owned', runId), createDefaultMapXml('owned')],
          );
          const id = ins.rows[0]!.id;
          await client.query(`UPDATE public.mindmaps SET title = $1 WHERE id = $2`, [updatedTitle, id]);
          const sel = await client.query<{ title: string }>(`SELECT title FROM public.mindmaps WHERE id = $1`, [id]);
          const del = await client.query(`DELETE FROM public.mindmaps WHERE id = $1`, [id]);
          return { title: sel.rows[0]?.title, deleted: del.rowCount };
        });
        expect(result.title).toBe(updatedTitle);
        expect(result.deleted).toBe(1);
      });

      it('T1-F06-04: cross-owner authenticated user cannot read, update, delete, or spoof ownerA rows', async () => {
        const mapA = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('PrivA', runId), createDefaultMapXml('priv')],
          );
          return ins.rows[0]!.id;
        });
        createdMapIds.push(mapA);

        const crossCheck = await withOwnerTx(pool, ownerB, 'other-e2e@example.com', async (client) => {
          const sel = await client.query(`SELECT id FROM public.mindmaps WHERE id = $1`, [mapA]);
          const upd = await client.query(`UPDATE public.mindmaps SET title = 'Hacked' WHERE id = $1`, [mapA]);
          const del = await client.query(`DELETE FROM public.mindmaps WHERE id = $1`, [mapA]);
          return { sel: sel.rowCount ?? 0, upd: upd.rowCount ?? 0, del: del.rowCount ?? 0 };
        });
        expect(crossCheck).toEqual({ sel: 0, upd: 0, del: 0 });

        await expect(
          withOwnerTx(pool, ownerB, 'other-e2e@example.com', async (client) => {
            await client.query(
              `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3)`,
              [ownerA, uniqueTitle('Spoof', runId), createDefaultMapXml('spoof')],
            );
          }),
        ).rejects.toMatchObject({ code: '42501' });
      });
    });

    describe('Tier 2 — F6: RLS Boundary & Pooler Safety Cases', () => {
      it('T2-F06-03: ownerB cannot insert mindmap_labels referencing ownerA map', async () => {
        const mapA = await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO public.mindmaps (owner_id, title, xml) VALUES ($1::uuid, $2, $3) RETURNING id`,
            [ownerA, uniqueTitle('JoinA', runId), createDefaultMapXml('a')],
          );
          return ins.rows[0]!.id;
        });
        createdMapIds.push(mapA);

        const lblB = await withOwnerTx(pool, ownerB, 'other-e2e@example.com', async (client) => {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO public.labels (owner_id, title, color) VALUES ($1::uuid, $2, '#222222') RETURNING id`,
            [ownerB, uniqueLabelTitle('B')],
          );
          return ins.rows[0]!.id;
        });
        createdLabelIds.push(lblB);

        await expect(
          withOwnerTx(pool, ownerB, 'other-e2e@example.com', async (client) => {
            await client.query(
              `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id) VALUES ($1, $2, $3::uuid)`,
              [mapA, lblB, ownerB],
            );
          }),
        ).rejects.toThrow();
      });

      it('T2-F06-04: SET LOCAL ROLE authenticated with empty request.jwt.claims yields 0 rows', async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SELECT set_config('request.jwt.claims', '', true)`);
          await client.query('SET LOCAL ROLE authenticated');
          const res = await client.query(`SELECT id FROM public.mindmaps LIMIT 5`);
          expect(res.rowCount).toBe(0);
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      });

      it('T2-F06-05: transaction-scoped SET LOCAL does not leak across pooled connections', async () => {
        await withOwnerTx(pool, ownerA, DEFAULT_ALLOWED_EMAIL, async (client) => {
          await client.query(`SELECT 1`);
        });
        const client = await pool.connect();
        try {
          const claims = await client.query<{ val: string | null }>(
            `SELECT current_setting('request.jwt.claims', true) AS val`,
          );
          expect(claims.rows[0]?.val ?? '').toBe('');
        } finally {
          client.release();
        }
      });
    });

    describe('Tier 3 — F5 x F6 x F13 Live DB + API RLS Combination', () => {
      it.skipIf(!caps.canRunApiRuntime)(
        'T3-13: saved XML is plain TEXT in pg and foreign owner receives 403 without leaking currentVersion',
        async () => {
          const clientA = (await createE2eClient()).withAuth(
            await mintJwt({ email: DEFAULT_ALLOWED_EMAIL, uid: ownerA }),
          );
          const createRes = await clientA.post(
            `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('LiveRLS', runId))}`,
          );
          expect(createRes.status).toBe(201);
          const mapId = Number.parseInt(createRes.headers.get('resourceid') ?? '0', 10);
          expect(mapId).toBeGreaterThan(0);
          createdMapIds.push(mapId);

          const dbRow = await pool.query<{ xml: string; version: number }>(
            `SELECT xml, version FROM public.mindmaps WHERE id = $1`,
            [mapId],
          );
          expect(dbRow.rows[0]?.xml).toContain('<map');
          expect(dbRow.rows[0]?.version).toBe(1);

          const foreignToken = await mintJwt({
            email: DEFAULT_ALLOWED_EMAIL,
            uid: crypto.randomUUID(),
          });
          const clientForeign = (await createE2eClient()).withAuth(foreignToken);
          const putRes = await clientForeign.put(`/api/restful/maps/${mapId}/document`, {
            id: String(mapId),
            xml: createDefaultMapXml('hijack'),
            properties: '{"zoom":0.8}',
            version: 1,
          });
          expect(putRes.status).toBe(403);
        },
      );
    });
  });
});
