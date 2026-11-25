import { beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import {
  BVA_STRINGS,
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  MAP_TITLE_API_MAX_LENGTH,
  XML_FIXTURES,
  createDefaultMapXml,
  generateLargeMapXml,
  mintJwt,
  uniqueExactLengthTitle,
  uniqueLabelTitle,
  uniqueTitle,
} from './support/fixtures';

const caps = detectE2eCapabilities();

describe.skipIf(!caps.canRunApiRuntime)('F10 — Mindmap CRUD, Star, Duplicate, Lock, Publish, Batch & Validate-Note E2E', () => {
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
    title = uniqueTitle('Map'),
    description = 'Initial desc',
  ): Promise<string> {
    const res = await client.post(
      `/api/restful/maps?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&theme=prism`,
    );
    expect(res.status).toBe(201);
    const id = res.headers.get('resourceid');
    expect(id).toBeTruthy();
    return id!;
  }

  describe('Tier 1 — F10: Mindmap Feature Coverage', () => {
    it('T1-F10-01: creates mindmap with Location/ResourceId headers and lists DTO shape in GET /maps', async () => {
      const client = await authedClient();
      const title = uniqueTitle('Roadmap');
      const res = await client.post(
        `/api/restful/maps?title=${encodeURIComponent(title)}&description=Q1&theme=prism`,
      );
      expect(res.status).toBe(201);
      const id = res.headers.get('resourceid');
      const location = res.headers.get('location');
      expect(id).toBeTruthy();
      expect(location).toContain(`/api/restful/maps/${id}`);

      const listRes = await client.get('/api/restful/maps');
      expect(listRes.status).toBe(200);
      const list = await client.json<{
        count: number;
        mindmapsInfo: Array<{
          id: number;
          title: string;
          public: boolean;
          role: string;
          version: number;
        }>;
      }>(listRes);
      expect(list.count).toBeGreaterThanOrEqual(1);
      const found = list.mindmapsInfo.find((m) => String(m.id) === id);
      expect(found).toBeDefined();
      expect(found?.title).toBe(title);
      expect(found?.public).toBe(false);
      expect(found?.role).toBe('owner');
      expect(found?.version).toBe(1);
    });

    it('T1-F10-02: fetches single map, metadata?xml=true, and raw /document/xml with X-Mindmap-Version', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('MetaMap'));

      const singleRes = await client.get(`/api/restful/maps/${id}`);
      expect(singleRes.status).toBe(200);
      const single = await client.json<{ id: number; version: number }>(singleRes);
      expect(String(single.id)).toBe(id);

      const metaRes = await client.get(`/api/restful/maps/${id}/metadata?xml=true`);
      expect(metaRes.status).toBe(200);
      const meta = await client.json<{
        version: number;
        xml: string;
        locked: boolean;
        role: string;
      }>(metaRes);
      expect(meta.version).toBe(1);
      expect(meta.xml).toContain('<map');
      expect(meta.locked).toBe(false);
      expect(meta.role).toBe('owner');

      const xmlRes = await client.get(`/api/restful/maps/${id}/document/xml`);
      expect(xmlRes.status).toBe(200);
      expect(xmlRes.headers.get('content-type') ?? '').toContain('xml');
      expect(xmlRes.headers.get('x-mindmap-version')).toBe('1');
      expect(await xmlRes.text()).toContain('<map');
    });

    it('T1-F10-03: saves document via PUT /document (204) and PUT /document/xml (200)', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('SaveMap'));
      const xmlV2 = createDefaultMapXml('Updated V2');
      const xmlV3 = createDefaultMapXml('Updated V3');

      const putDoc = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: xmlV2,
        properties: '{"zoom":1.0}',
        version: 1,
      });
      expect(putDoc.status).toBe(204);
      expect(putDoc.headers.get('x-mindmap-version')).toBe('2');

      const putXml = await client.put(`/api/restful/maps/${id}/document/xml`, xmlV3, {
        headers: {
          'content-type': 'text/plain',
          'x-mindmap-version': '2',
        },
      });
      expect(putXml.status).toBe(200);
      expect(putXml.headers.get('x-mindmap-version')).toBe('3');
    });

    it('T1-F10-04: renames title, updates description, toggles starred, and filters ?q=starred', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('BeforeRename'));
      const renamed = uniqueTitle('AfterRename');

      const rTitle = await client.put(`/api/restful/maps/${id}/title`, renamed, {
        headers: { 'content-type': 'text/plain' },
      });
      expect(rTitle.status).toBe(204);

      const rDesc = await client.put(`/api/restful/maps/${id}/description`, 'Updated note', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(rDesc.status).toBe(204);

      const rStar = await client.put(`/api/restful/maps/${id}/starred`, 'true', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(rStar.status).toBe(204);

      const getStar = await client.get(`/api/restful/maps/${id}/starred`);
      expect(getStar.status).toBe(200);
      expect((await getStar.text()).trim()).toBe('true');

      const qStarred = await client.get('/api/restful/maps?q=starred');
      const body = await client.json<{ mindmapsInfo: Array<{ id: number; title: string }> }>(qStarred);
      expect(body.mindmapsInfo.some((m) => String(m.id) === id && m.title === renamed)).toBe(true);
    });

    it('T1-F10-05: duplicates map, performs stateless lock no-op, and validates topic note', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('Source'));
      const copyTitle = uniqueTitle('Copy');

      const dupRes = await client.post(`/api/restful/maps/${id}`, {
        title: copyTitle,
        description: 'Cloned',
      });
      expect(dupRes.status).toBe(201);
      const copyId = dupRes.headers.get('resourceid');
      expect(copyId).toBeTruthy();
      expect(copyId).not.toBe(id);

      const lockTrue = await client.put(`/api/restful/maps/${id}/lock`, 'true', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(lockTrue.status).toBe(200);
      const lockBody = await client.json<{ email: string }>(lockTrue);
      expect(lockBody.email).toBe(DEFAULT_ALLOWED_EMAIL);

      const lockFalse = await client.put(`/api/restful/maps/${id}/lock`, 'false', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(lockFalse.status).toBe(204);

      const noteRes = await client.post('/api/restful/maps/validate-note', BVA_STRINGS.noteValid, {
        headers: { 'content-type': 'text/plain' },
      });
      expect(noteRes.status).toBe(200);
      const noteBody = await client.json<{ overLimit: boolean }>(noteRes);
      expect(noteBody.overLimit).toBe(false);
    });

    it('T1-F10-06: deletes single map and batch deletes multiple maps cleanly', async () => {
      const client = await authedClient();
      const id1 = await createMap(client, uniqueTitle('Del1'));
      const id2 = await createMap(client, uniqueTitle('Del2'));
      const id3 = await createMap(client, uniqueTitle('Del3'));

      expect((await client.del(`/api/restful/maps/${id1}`)).status).toBe(204);
      expect((await client.get(`/api/restful/maps/${id1}`)).status).toBe(403);

      const batchRes = await client.del(`/api/restful/maps/batch?ids=${id2},${id3}`);
      expect(batchRes.status).toBe(204);
      expect((await client.get(`/api/restful/maps/${id2}`)).status).toBe(403);
      expect((await client.get(`/api/restful/maps/${id3}`)).status).toBe(403);
    });
  });

  describe('Tier 2 — F10: Mindmap BVA, Adversarial Inputs & API Quirks', () => {
    it('T2-F10-01: empty and whitespace-only titles return 400 RestErrors with fieldErrors.title', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('TitleTarget'));

      const badCreates = [
        await client.post('/api/restful/maps?title='),
        await client.post('/api/restful/maps?title=%20%20%20'),
        await client.put(`/api/restful/maps/${id}/title`, '   ', {
          headers: { 'content-type': 'text/plain' },
        }),
      ];
      for (const res of badCreates) {
        expect(res.status).toBe(400);
        expect(res.headers.get('content-type') ?? '').toContain('application/json');
        const body = await client.json<{ fieldErrors?: Record<string, string> }>(res);
        expect(body.fieldErrors?.title).toBeTruthy();
      }
    });

    it('T2-F10-02: title BVA accepts 512 chars (201) and rejects 513 chars (400 fieldErrors.title)', async () => {
      const client = await authedClient();
      const title512 = uniqueExactLengthTitle(MAP_TITLE_API_MAX_LENGTH);
      const title513 = uniqueExactLengthTitle(MAP_TITLE_API_MAX_LENGTH + 1);
      expect(title512).toHaveLength(512);
      expect(title513).toHaveLength(513);

      let createdId: string | null = null;
      try {
        const okRes = await client.post(
          `/api/restful/maps?title=${encodeURIComponent(title512)}`,
        );
        expect(okRes.status).toBe(201);
        createdId = okRes.headers.get('resourceid');
        expect(createdId).toBeTruthy();

        const failRes = await client.post(
          `/api/restful/maps?title=${encodeURIComponent(title513)}`,
        );
        expect(failRes.status).toBe(400);
        const err = await client.json<{ fieldErrors?: Record<string, string> }>(failRes);
        expect(err.fieldErrors?.title).toBeTruthy();
      } finally {
        if (createdId) {
          await client.del(`/api/restful/maps/${createdId}`).catch(() => undefined);
        }
      }
    });

    it('T2-F10-03: duplicate title rejected with 400 fieldErrors.title on create, duplicate, and rename', async () => {
      const client = await authedClient();
      const alpha = uniqueTitle('Alpha');
      const beta = uniqueTitle('Beta');
      const idA = await createMap(client, alpha);
      const idB = await createMap(client, beta);

      const dupCreate = await client.post(`/api/restful/maps?title=${encodeURIComponent(alpha)}`);
      const dupClone = await client.post(`/api/restful/maps/${idA}`, { title: alpha });
      const dupRename = await client.put(`/api/restful/maps/${idB}/title`, alpha, {
        headers: { 'content-type': 'text/plain' },
      });

      for (const res of [dupCreate, dupClone, dupRename]) {
        expect(res.status).toBe(400);
        const body = await client.json<{ fieldErrors?: Record<string, string> }>(res);
        expect(body.fieldErrors?.title).toBeTruthy();
      }
    });

    it('T2-F10-04: rejects malformed XML, wrong root element, and XSS <script> payload with 400 RestErrors', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('XmlGuard'));

      for (const badXml of [
        XML_FIXTURES.wrongRoot,
        XML_FIXTURES.xssScript,
        XML_FIXTURES.malformedUnclosed,
      ]) {
        const importRes = await client.post(
          `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('BadImport'))}`,
          badXml,
          { headers: { 'content-type': 'application/xml' } },
        );
        expect(importRes.status).toBe(400);

        const putRes = await client.put(`/api/restful/maps/${id}/document`, {
          id,
          xml: badXml,
          properties: '{"zoom":0.8}',
          version: 1,
        });
        expect(putRes.status).toBe(400);
      }
    });

    it('T2-F10-05: large XML topic count BVA accepts 4000 topics (201) and rejects 4001 and 5001 topics (400 TOO_BIG_MINDMAP)', async () => {
      const client = await authedClient();
      const okXml = generateLargeMapXml(4000, 'OkExact4000');
      const boundaryOverXml = generateLargeMapXml(4001, 'Over4001');
      const tooLargeXml = generateLargeMapXml(5001, 'TooLarge5001');

      let createdId: string | null = null;
      try {
        const okRes = await client.post(
          `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('Topics4000'))}`,
          okXml,
          { headers: { 'content-type': 'application/xml' } },
        );
        expect(okRes.status).toBe(201);
        createdId = okRes.headers.get('resourceid');
        expect(createdId).toBeTruthy();

        for (const [label, oversizedXml] of [
          ['Topics4001', boundaryOverXml],
          ['Topics5001', tooLargeXml],
        ] as const) {
          const failRes = await client.post(
            `/api/restful/maps?title=${encodeURIComponent(uniqueTitle(label))}`,
            oversizedXml,
            { headers: { 'content-type': 'application/xml' } },
          );
          expect(failRes.status).toBe(400);
          const err = await client.json<{ globalErrors?: string[]; errorCode?: string }>(failRes);
          expect(Array.isArray(err.globalErrors)).toBe(true);
          expect(err.errorCode).toBe('TOO_BIG_MINDMAP');
        }
      } finally {
        if (createdId) {
          await client.del(`/api/restful/maps/${createdId}`).catch(() => undefined);
        }
      }
    });

    it('T2-F10-06: unknown map ID 999999 returns 403 RestErrors (not 404)', async () => {
      const client = await authedClient();
      const responses = await Promise.all([
        client.get('/api/restful/maps/999999'),
        client.get('/api/restful/maps/999999/metadata'),
        client.get('/api/restful/maps/999999/document/xml'),
        client.put('/api/restful/maps/999999/document', {
          id: '999999',
          xml: XML_FIXTURES.default,
          properties: '{"zoom":0.8}',
          version: 1,
        }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type') ?? '').toContain('application/json');
      }
    });

    it('T2-F10-07: properties: null on PUT /maps/{id}/document returns 400 RestErrors', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('NullProps'));
      const res = await client.put(`/api/restful/maps/${id}/document`, {
        id,
        xml: XML_FIXTURES.default,
        properties: null,
        version: 1,
      });
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type') ?? '').toContain('application/json');
    });

    it('T2-F10-08: PUT /maps/{id}/description accepts single space " " and GET /maps/ handles trailing slash', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('DescSpace'), 'Previous description');

      const putDesc = await client.put(`/api/restful/maps/${id}/description`, ' ', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(putDesc.status).toBe(204);

      const listRes = await client.get('/api/restful/maps/');
      expect(listRes.status).toBe(200);
      const list = await client.json<{ mindmapsInfo: Array<{ id: number; description: string }> }>(
        listRes,
      );
      const found = list.mindmapsInfo.find((m) => String(m.id) === id);
      expect(found).toBeDefined();
      expect((found?.description ?? '').trim()).toBe('');
    });

    it('T2-F10-09: PUT /maps/{id}/publish with { isPublic: true } is rejected with 403 (private-only app)', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('NoPublish'));
      const res = await client.put(`/api/restful/maps/${id}/publish`, { isPublic: true });
      expect(res.status).toBe(403);
      expect(res.headers.get('content-type') ?? '').toContain('application/json');

      const list = await client.json<{ mindmapsInfo: Array<{ id: number; public: boolean }> }>(
        await client.get('/api/restful/maps'),
      );
      expect(list.mindmapsInfo.find((m) => String(m.id) === id)?.public).toBe(false);
    });

    it('T2-F10-10: batch delete validates missing/blank/non-numeric ids (400) and rolls back partial unknown ids (403)', async () => {
      const client = await authedClient();
      const validId = await createMap(client, uniqueTitle('BatchKeep'));

      for (const badPath of [
        '/api/restful/maps/batch',
        '/api/restful/maps/batch?ids=%20%20%20',
        '/api/restful/maps/batch?ids=1,abc',
      ]) {
        const res = await client.del(badPath);
        expect(res.status).toBe(400);
      }

      const partialRes = await client.del(`/api/restful/maps/batch?ids=${validId},999999`);
      expect(partialRes.status).toBe(403);

      // Transactional check: validId must still exist
      expect((await client.get(`/api/restful/maps/${validId}`)).status).toBe(200);
    });

    it('T2-F10-11: validate-note reports overLimit: true when note exceeds 10000 chars', async () => {
      const client = await authedClient();
      const res = await client.post('/api/restful/maps/validate-note', BVA_STRINGS.noteOver, {
        headers: { 'content-type': 'text/plain' },
      });
      expect(res.status).toBe(200);
      const body = await client.json<{
        overLimit: boolean;
        remainingChars: number;
        usagePercentage: number;
      }>(res);
      expect(body.overLimit).toBe(true);
      expect(body.remainingChars).toBeLessThan(0);
      expect(body.usagePercentage).toBeGreaterThan(100);
    });
  });

  describe('Tier 3 — Cross-Feature Mindmap Combinations', () => {
    it('T3-07: duplicate preserves XML at version 1 without mutating source map labels or star state', async () => {
      const client = await authedClient();
      const idA = await createMap(client, uniqueTitle('SrcStar'));
      await client.put(`/api/restful/maps/${idA}/starred`, 'true', {
        headers: { 'content-type': 'text/plain' },
      });

      const lblTitle = uniqueLabelTitle('Work');
      const lblRes = await client.post('/api/restful/labels', {
        title: lblTitle,
        color: '#22aa44',
        iconName: 'star',
      });
      expect(lblRes.status).toBe(201);
      const lid = Number.parseInt(lblRes.headers.get('resourceid') ?? '0', 10);
      expect((await client.post(`/api/restful/maps/${idA}/labels`, lid)).status).toBe(200);

      const dupRes = await client.post(`/api/restful/maps/${idA}`, {
        title: uniqueTitle('DupCopy'),
      });
      expect(dupRes.status).toBe(201);
      const idB = dupRes.headers.get('resourceid')!;

      const metaB = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${idB}/metadata?xml=true`),
      );
      expect(metaB.version).toBe(1);
      expect(metaB.xml).toContain('SrcStar');

      const starred = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(
        await client.get('/api/restful/maps?q=starred'),
      );
      expect(starred.mindmapsInfo.some((m) => String(m.id) === idA)).toBe(true);

      const byLabel = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(
        await client.get(`/api/restful/maps?q=${encodeURIComponent(lblTitle)}`),
      );
      expect(byLabel.mindmapsInfo.some((m) => String(m.id) === idA)).toBe(true);
    });

    it('T3-10: XML import returns matching XML in both /metadata?xml=true and /document/xml with version 1', async () => {
      const client = await authedClient();
      const xml = generateLargeMapXml(5, 'Imported5');
      const createRes = await client.post(
        `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('Imported5'))}`,
        xml,
        { headers: { 'content-type': 'application/xml' } },
      );
      expect(createRes.status).toBe(201);
      const id = createRes.headers.get('resourceid')!;

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(1);
      expect(meta.xml).toBe(xml);

      const rawRes = await client.get(`/api/restful/maps/${id}/document/xml`);
      expect(rawRes.headers.get('x-mindmap-version')).toBe('1');
      expect(await rawRes.text()).toBe(xml);
    });

    it('T3-11: renaming title and clearing description (" ") does not create spurious history snapshots', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('MetaNoHist'), 'Initial');
      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('Edited'),
        properties: '{"zoom":1.0}',
        version: 1,
      });

      const newTitle = uniqueTitle('RenamedNoHist');
      expect(
        (
          await client.put(`/api/restful/maps/${id}/title`, newTitle, {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);
      expect(
        (
          await client.put(`/api/restful/maps/${id}/description`, ' ', {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);

      const hist = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(1);

      const maps = await client.json<{
        mindmapsInfo: Array<{ id: number; title: string; description: string }>;
      }>(await client.get('/api/restful/maps'));
      const found = maps.mindmapsInfo.find((m) => String(m.id) === id);
      expect(found?.title).toBe(newTitle);
      expect((found?.description ?? '').trim()).toBe('');
    });

    it('T3-12: partial batch delete failure leaves labeled maps intact, then valid batch delete cleans both', async () => {
      const client = await authedClient();
      const m1 = await createMap(client, uniqueTitle('B1'));
      const m2 = await createMap(client, uniqueTitle('B2'));
      const lblTitle = uniqueLabelTitle('BatchLbl');
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: lblTitle,
            color: '#9933cc',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      await client.post(`/api/restful/maps/${m1}/labels`, lid);
      await client.post(`/api/restful/maps/${m2}/labels`, lid);

      const failBatch = await client.del(`/api/restful/maps/batch?ids=${m1},999999,${m2}`);
      expect(failBatch.status).toBe(403);
      expect((await client.get(`/api/restful/maps/${m1}`)).status).toBe(200);
      expect((await client.get(`/api/restful/maps/${m2}`)).status).toBe(200);

      const okBatch = await client.del(`/api/restful/maps/batch?ids=${m1},${m2}`);
      expect(okBatch.status).toBe(204);
      expect((await client.get(`/api/restful/maps/${m1}`)).status).toBe(403);
      expect((await client.get(`/api/restful/maps/${m2}`)).status).toBe(403);
    });
  });
});
