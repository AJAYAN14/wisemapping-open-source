import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  ROOT,
  createDefaultMapXml,
  mintJwt,
  uniqueTitle,
} from './support/fixtures';

const caps = detectE2eCapabilities();

describe.skipIf(!caps.canRunApiRuntime)('F13 — Atomic Optimistic Locking (version) & RestErrors E2E', () => {
  let store: FakeStore;
  let oauth: FakeOAuthAdapter;

  beforeEach(() => {
    store = new FakeStore();
    oauth = new FakeOAuthAdapter();
  });

  async function authedClient() {
    const jwt = await mintJwt({ email: DEFAULT_ALLOWED_EMAIL, uid: DEFAULT_OWNER_UUID });
    return (await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) })).withAuth(jwt);
  }

  async function createMap(
    client: Awaited<ReturnType<typeof authedClient>>,
    title = uniqueTitle('LockMap'),
  ): Promise<string> {
    const res = await client.post(`/api/restful/maps?title=${encodeURIComponent(title)}`);
    expect(res.status).toBe(201);
    return res.headers.get('resourceid')!;
  }

  describe('Tier 1 — F13: Optimistic Locking Feature Coverage', () => {
    it('T1-F13-01: sequential saves increment version monotonically (1 -> 2 -> 3)', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const s1 = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('V2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(s1.status).toBe(204);
      expect(s1.headers.get('x-mindmap-version')).toBe('2');

      const s2 = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('V3'),
        properties: '{"zoom":0.8}',
        version: 2,
      });
      expect(s2.status).toBe(204);
      expect(s2.headers.get('x-mindmap-version')).toBe('3');

      const meta = await client.json<{ version: number }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(3);
    });

    it('T1-F13-02: stale version on PUT /document returns 409 Conflict without overwriting XML', async () => {
      const client = await authedClient();
      const id = await createMap(client);
      const latestXml = createDefaultMapXml('CloudLatestV2');

      expect(
        (
          await client.put(`/api/restful/maps/${id}/document?minor=false`, {
            id,
            xml: latestXml,
            properties: '{"zoom":0.8}',
            version: 1,
          })
        ).status,
      ).toBe(204);

      const stale = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('StaleOverwriteAttempt'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect(stale.headers.get('content-type') ?? '').toContain('application/json');
      const err = await client.json<{ errorCode?: string; currentVersion?: number }>(stale);
      expect(err.errorCode).toBe('MINDMAP_VERSION_CONFLICT');
      expect(err.currentVersion).toBe(2);

      const persistedXml = await (await client.get(`/api/restful/maps/${id}/document/xml`)).text();
      expect(persistedXml).toBe(latestXml);
    });

    it('T1-F13-03: stale X-Mindmap-Version header on PUT /document/xml returns 409 Conflict', async () => {
      const client = await authedClient();
      const id = await createMap(client);
      const latestXml = createDefaultMapXml('CloudV2');

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: latestXml,
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const staleXmlRes = await client.put(
        `/api/restful/maps/${id}/document/xml`,
        createDefaultMapXml('StaleXml'),
        {
          headers: {
            'content-type': 'text/plain',
            'x-mindmap-version': '1',
          },
        },
      );
      expect(staleXmlRes.status).toBe(409);
      const err = await client.json<{ currentVersion?: number }>(staleXmlRes);
      expect(err.currentVersion).toBe(2);

      const currentXml = await (await client.get(`/api/restful/maps/${id}/document/xml`)).text();
      expect(currentXml).toBe(latestXml);
    });

    it('T1-F13-04: stale version on PUT /maps/{id} returns 409 Conflict', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('V2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const res = await client.put(`/api/restful/maps/${id}`, {
        title: uniqueTitle('StaleTitle'),
        xml: createDefaultMapXml('StaleMulti'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(res.status).toBe(409);
      const err = await client.json<{ currentVersion?: number }>(res);
      expect(err.currentVersion).toBe(2);
    });

    it('T1-F13-05: concurrent Promise.all saves at version 1 yield exactly one 204 and one 409', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const [resA, resB] = await Promise.all([
        client.put(`/api/restful/maps/${id}/document?minor=false`, {
          id,
          xml: createDefaultMapXml('ConcurrentA'),
          properties: '{"zoom":0.8}',
          version: 1,
        }),
        client.put(`/api/restful/maps/${id}/document?minor=false`, {
          id,
          xml: createDefaultMapXml('ConcurrentB'),
          properties: '{"zoom":0.8}',
          version: 1,
        }),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([204, 409]);

      const meta = await client.json<{ version: number }>(
        await client.get(`/api/restful/maps/${id}/metadata`),
      );
      expect(meta.version).toBe(2);
    });
  });

  describe('Tier 2 — F13: Optimistic Locking Boundary & Error Contract Cases', () => {
    it('T2-F13-01: 409 response returns RestErrors JSON with globalSeverity, errorCode, and currentVersion', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('V2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const res = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('Stale'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(res.status).toBe(409);
      expect(res.headers.get('content-type') ?? '').toContain('application/json');
      expect(res.headers.get('x-mindmap-version')).toBe('2');
      const body = await client.json<{
        globalErrors: string[];
        fieldErrors: Record<string, string>;
        globalSeverity: string;
        errorCode: string;
        currentVersion: number;
      }>(res);
      expect(Array.isArray(body.globalErrors)).toBe(true);
      expect(body.globalErrors.length).toBeGreaterThan(0);
      expect(body.fieldErrors).toEqual({});
      expect(body.globalSeverity).toBe('WARNING');
      expect(body.errorCode).toBe('MINDMAP_VERSION_CONFLICT');
      expect(body.currentVersion).toBe(2);
      expect(res.headers.get('x-mindmap-version')).toBe(String(body.currentVersion));
    });

    it('T2-F13-02: X-Mindmap-Version, Location, and ResourceId are exposed via CORS headers', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const xmlGet = await client.get(`/api/restful/maps/${id}/document/xml`);
      const metaGet = await client.get(`/api/restful/maps/${id}/metadata`);
      const docPut = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('CorsCheck'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      for (const res of [xmlGet, metaGet, docPut]) {
        const exposed = (res.headers.get('access-control-expose-headers') ?? '').toLowerCase();
        expect(exposed).toContain('x-mindmap-version');
        expect(exposed).toContain('location');
        expect(exposed).toContain('resourceid');
      }
    });

    it('T2-F13-03: If-Match header enforces optimistic lock when version is supplied via HTTP ETag/If-Match', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('V2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const okRes = await client.put(
        `/api/restful/maps/${id}/document?minor=false`,
        {
          id,
          xml: createDefaultMapXml('V3ViaIfMatch'),
          properties: '{"zoom":0.8}',
        },
        { headers: { 'if-match': '"2"' } },
      );
      expect(okRes.status).toBe(204);
      expect(okRes.headers.get('x-mindmap-version')).toBe('3');

      const missingVer = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('NoVersionField'),
        properties: '{"zoom":0.8}',
      });
      expect([204, 400, 409]).toContain(missingVer.status);
    });

    it('T2-F13-04: negative or non-numeric version values return 400/409 RestErrors cleanly (never 500)', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const negRes = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('NegVer'),
        properties: '{"zoom":0.8}',
        version: -1,
      });
      expect([400, 409]).toContain(negRes.status);

      const nanHeaderRes = await client.put(
        `/api/restful/maps/${id}/document?minor=false`,
        {
          id,
          xml: createDefaultMapXml('NaNVer'),
          properties: '{"zoom":0.8}',
        },
        { headers: { 'x-mindmap-version': 'abc' } },
      );
      expect([400, 409]).toContain(nanHeaderRes.status);
    });

    it('T2-F13-05: minor=true autosave still increments version and enforces optimistic lock on stale retries', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const minorOk = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('AutoSaveV2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(minorOk.status).toBe(204);
      expect(minorOk.headers.get('x-mindmap-version')).toBe('2');

      const staleMinor = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('StaleAutoSave'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(staleMinor.status).toBe(409);
      const err = await client.json<{ currentVersion: number }>(staleMinor);
      expect(err.currentVersion).toBe(2);
    });
  });

  describe('Tier 3 — Cross-Feature Locking, History & Frontend Recovery Combinations', () => {
    it('T3-04: minor=false saves create history snapshots, and revert bumps version to 4 with new snapshot', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('T304Root'));

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('EditV2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('EditV3'),
        properties: '{"zoom":0.8}',
        version: 2,
      });

      const hist1 = await client.json<{ changes: Array<{ id: number }> }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist1.changes).toHaveLength(2);
      const oldestHid = hist1.changes[hist1.changes.length - 1]!.id;

      expect((await client.post(`/api/restful/maps/${id}/history/${oldestHid}`)).status).toBe(204);

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(4);
      expect(meta.xml).toContain('EditV2');

      const hist2 = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist2.count).toBe(3);
    });

    it('T3-05: minor=true bumps version to 2 with 0 history rows, then stale v1 fails 409', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const s1 = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('MinorSave'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(s1.status).toBe(204);
      expect(s1.headers.get('x-mindmap-version')).toBe('2');

      const hist = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(0);

      const stale = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('Stale'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect((await client.json<{ currentVersion: number }>(stale)).currentVersion).toBe(2);
    });

    it('T3-06: Desktop vs Mobile race -> 409 conflict -> refresh metadata?xml=true -> save v3 preserving snapshots', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('RaceMap'));

      const desktopMeta1 = await client.json<{ version: number }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      const mobileMeta1 = await client.json<{ version: number }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(desktopMeta1.version).toBe(1);
      expect(mobileMeta1.version).toBe(1);

      const mobileXml = createDefaultMapXml('MobileEdit');
      const mobileSave = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: mobileXml,
        properties: '{"zoom":0.8}',
        version: mobileMeta1.version,
      });
      expect(mobileSave.status).toBe(204);

      const desktopStale = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('DesktopStale'),
        properties: '{"zoom":0.8}',
        version: desktopMeta1.version,
      });
      expect(desktopStale.status).toBe(409);

      const dialogSrc = fs.readFileSync(
        path.join(
          ROOT,
          'frontend/packages/webapp/src/components/editor-page/version-conflict-dialog/index.tsx',
        ),
        'utf8',
      );
      expect(dialogSrc).toContain('window.location.reload()');

      const desktopRefreshed = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(desktopRefreshed.version).toBe(2);
      expect(desktopRefreshed.xml).toBe(mobileXml);

      const desktopReapplied = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('MergedEdit'),
        properties: '{"zoom":0.8}',
        version: desktopRefreshed.version,
      });
      expect(desktopReapplied.status).toBe(204);
      expect(desktopReapplied.headers.get('x-mindmap-version')).toBe('3');

      const hist = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(2);
    });

    it('T3-15: PUT /maps/{id} multi-field update bumps version + creates history, and stale retry fails atomically', async () => {
      const client = await authedClient();
      const origTitle = uniqueTitle('MultiOrig');
      const id = await createMap(client, origTitle);
      const updatedTitle = uniqueTitle('MultiUpdated');

      const ok = await client.put(`/api/restful/maps/${id}`, {
        title: updatedTitle,
        description: 'Multi-field desc',
        xml: createDefaultMapXml('MultiV2'),
        properties: '{"zoom":1.2}',
        version: 1,
      });
      expect(ok.status).toBe(204);

      const stale = await client.put(`/api/restful/maps/${id}`, {
        title: uniqueTitle('ShouldNotApply'),
        description: 'Bad desc',
        xml: createDefaultMapXml('ShouldNotApplyXml'),
        properties: '{"zoom":0.5}',
        version: 1,
      });
      expect(stale.status).toBe(409);

      const current = await client.json<{ title: string; version: number }>(
        await client.get(`/api/restful/maps/${id}`),
      );
      expect(current.title).toBe(updatedTitle);
      expect(current.version).toBe(2);
    });
  });
});
