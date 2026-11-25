import { beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  LABEL_TITLE_MAX_LENGTH,
  createDefaultMapXml,
  mintJwt,
  uniqueExactLengthLabelTitle,
  uniqueLabelTitle,
  uniqueTitle,
} from './support/fixtures';

const caps = detectE2eCapabilities();

interface HistoryItem {
  id: number;
  creator: string;
  creationTime: string;
}

describe.skipIf(!caps.canRunApiRuntime)('F11/F12 — Mindmap History, Rollback & Label Management E2E', () => {
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
    title = uniqueTitle('HistMap'),
  ): Promise<string> {
    const res = await client.post(`/api/restful/maps?title=${encodeURIComponent(title)}`);
    expect(res.status).toBe(201);
    return res.headers.get('resourceid')!;
  }

  describe('Tier 1 — F11: Mindmap History & Rollback', () => {
    it('T1-F11-01: non-minor save creates history snapshot while minor save does not', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const r1 = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('Edit1'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(r1.status).toBe(204);

      const r2 = await client.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('Minor2'),
        properties: '{"zoom":0.8}',
        version: 2,
      });
      expect(r2.status).toBe(204);

      const histRes = await client.get(`/api/restful/maps/${id}/history/`);
      expect(histRes.status).toBe(200);
      const hist = await client.json<{ count: number; changes: HistoryItem[] }>(histRes);
      expect(hist.count).toBe(1);
      expect(hist.changes).toHaveLength(1);
      expect(typeof hist.changes[0]?.id).toBe('number');
      expect(hist.changes[0]?.creator).toBeTruthy();
      expect(Date.parse(hist.changes[0]?.creationTime ?? '')).not.toBeNaN();
    });

    it('T1-F11-02: GET /maps/{id}/{hid}/document/xml returns historical revision XML', async () => {
      const client = await authedClient();
      const title = uniqueTitle('SnapXml');
      const id = await createMap(client, title);

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('SnapRevision1'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const hist = await client.json<{ changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      const hid = hist.changes[0]!.id;

      const xmlRes = await client.get(`/api/restful/maps/${id}/${hid}/document/xml`);
      expect(xmlRes.status).toBe(200);
      expect(xmlRes.headers.get('content-type') ?? '').toContain('xml');
      expect(await xmlRes.text()).toContain('SnapRevision1');
    });

    it('T1-F11-03: POST /maps/{id}/history/{hid} restores historical XML, increments version, and appends snapshot', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('RollbackRoot'));

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('SavedGoodState'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('OverwriteState'),
        properties: '{"zoom":0.8}',
        version: 2,
      });

      const histBefore = await client.json<{ changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(histBefore.changes).toHaveLength(2);
      const olderHid = histBefore.changes[histBefore.changes.length - 1]!.id;

      const revertRes = await client.post(`/api/restful/maps/${id}/history/${olderHid}`);
      expect(revertRes.status).toBe(204);

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(4);
      expect(meta.xml).toContain('SavedGoodState');

      const histAfter = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(histAfter.count).toBe(3);
    });

    it('T1-F11-04: POST /maps/{id}/history/latest completes cleanly (204) without pruning history', async () => {
      const client = await authedClient();
      const id = await createMap(client);
      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('SavedState'),
        properties: '{"zoom":0.8}',
        version: 1,
      });

      const res = await client.post(`/api/restful/maps/${id}/history/latest`);
      expect(res.status).toBe(204);

      const hist = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(1);
    });

    it('T1-F11-05: retains all 10 non-minor save snapshots permanently without legacy 4-entry cap', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      for (let version = 1; version <= 10; version++) {
        const res = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
          id,
          xml: createDefaultMapXml(`Revision-${version}`),
          properties: '{"zoom":0.8}',
          version,
        });
        expect(res.status).toBe(204);
      }

      const hist = await client.json<{ count: number; changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(10);
      expect(hist.changes).toHaveLength(10);
    });
  });

  describe('Tier 2 — F11: History Boundary & Corner Cases', () => {
    it('T2-F11-01: unknown map 999999/history/ returns 403 while owned /history and /history/ both return 200', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      expect((await client.get('/api/restful/maps/999999/history/')).status).toBe(403);
      expect((await client.get(`/api/restful/maps/${id}/history`)).status).toBe(200);
      expect((await client.get(`/api/restful/maps/${id}/history/`)).status).toBe(200);
    });

    it('T2-F11-02: unknown hid 999999 returns 400 RestErrors on both XML fetch and revert', async () => {
      const client = await authedClient();
      const id = await createMap(client);

      const xmlRes = await client.get(`/api/restful/maps/${id}/999999/document/xml`);
      const revertRes = await client.post(`/api/restful/maps/${id}/history/999999`);
      expect(xmlRes.status).toBe(400);
      expect(revertRes.status).toBe(400);
    });

    it('T2-F11-03: cross-map hid isolation rejects map A hid used against map B with 400', async () => {
      const client = await authedClient();
      const mapA = await createMap(client, uniqueTitle('MapA'));
      const mapB = await createMap(client, uniqueTitle('MapB'));

      await client.put(`/api/restful/maps/${mapA}/document?minor=false`, {
        id: mapA,
        xml: createDefaultMapXml('SecretA'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      const histA = await client.json<{ changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${mapA}/history/`),
      );
      const hidFromA = histA.changes[0]!.id;

      expect((await client.get(`/api/restful/maps/${mapB}/${hidFromA}/document/xml`)).status).toBe(400);
      expect((await client.post(`/api/restful/maps/${mapB}/history/${hidFromA}`)).status).toBe(400);
    });

    it('T2-F11-04: newly created map with zero edits returns { count: 0, changes: [] }', async () => {
      const client = await authedClient();
      const id = await createMap(client);
      const hist = await client.json<{ count: number; changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist).toEqual({ count: 0, changes: [] });
    });

    it('T2-F11-05: reverting to hid(v2) bumps version to 4 and preserves prior snapshots intact', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('V1Root'));

      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('StateV2'),
        properties: '{"zoom":0.8}',
        version: 1,
      });
      await client.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: createDefaultMapXml('StateV3'),
        properties: '{"zoom":0.8}',
        version: 2,
      });

      const hist1 = await client.json<{ changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist1.changes).toHaveLength(2);
      const oldestHid = hist1.changes[hist1.changes.length - 1]!.id;

      expect((await client.post(`/api/restful/maps/${id}/history/${oldestHid}`)).status).toBe(204);

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(4);
      expect(meta.xml).toContain('StateV2');

      const hist2 = await client.json<{ count: number; changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist2.count).toBe(3);
    });
  });

  describe('Tier 1 — F12: Label Management', () => {
    it('T1-F12-01: creates label with Location/ResourceId headers and lists it in GET /labels', async () => {
      const client = await authedClient();
      const title = uniqueLabelTitle('Work');
      const res = await client.post('/api/restful/labels', {
        title,
        color: '#ff0000',
        iconName: 'smile',
      });
      expect(res.status).toBe(201);
      const lid = res.headers.get('resourceid');
      expect(lid).toBeTruthy();
      expect(res.headers.get('location')).toContain(`/api/restful/labels/${lid}`);

      const listRes = await client.get('/api/restful/labels');
      expect(listRes.status).toBe(200);
      const body = await client.json<{
        labels: Array<{ id: number; title: string; color: string }>;
      }>(listRes);
      const found = body.labels.find((l) => String(l.id) === lid);
      expect(found?.title).toBe(title);
      expect(found?.color).toBe('#ff0000');
    });

    it('T1-F12-02: assigns label to map using raw JSON integer body (POST /maps/{id}/labels)', async () => {
      const client = await authedClient();
      const mapId = await createMap(client, uniqueTitle('LabeledMap'));
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('Assign'),
            color: '#00aa88',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );

      const assignRes = await client.post(`/api/restful/maps/${mapId}/labels`, lid);
      expect(assignRes.status).toBe(200);

      const mapsBody = await client.json<{
        mindmapsInfo: Array<{ id: number; labels: Array<{ id: number }> }>;
      }>(await client.get('/api/restful/maps'));
      const found = mapsBody.mindmapsInfo.find((m) => String(m.id) === mapId);
      expect(found?.labels.some((l) => l.id === lid)).toBe(true);
    });

    it('T1-F12-03: filters maps by label title via GET /api/restful/maps?q=<label>', async () => {
      const client = await authedClient();
      const map1 = await createMap(client, uniqueTitle('Tagged'));
      const map2 = await createMap(client, uniqueTitle('Untagged'));
      const labelTitle = uniqueLabelTitle('Sprint');
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: labelTitle,
            color: '#3366ff',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      await client.post(`/api/restful/maps/${map1}/labels`, lid);

      const res = await client.get(`/api/restful/maps?q=${encodeURIComponent(labelTitle)}`);
      expect(res.status).toBe(200);
      const body = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(res);
      expect(body.mindmapsInfo.map((m) => String(m.id))).toEqual([map1]);
      expect(body.mindmapsInfo.some((m) => String(m.id) === map2)).toBe(false);
    });

    it('T1-F12-04: DELETE /maps/{id}/labels/{lid} detaches label while keeping label entity intact', async () => {
      const client = await authedClient();
      const mapId = await createMap(client);
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('Detach'),
            color: '#aa5500',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      await client.post(`/api/restful/maps/${mapId}/labels`, lid);

      expect((await client.del(`/api/restful/maps/${mapId}/labels/${lid}`)).status).toBe(204);

      const mapsBody = await client.json<{
        mindmapsInfo: Array<{ id: number; labels: Array<{ id: number }> }>;
      }>(await client.get('/api/restful/maps'));
      expect(mapsBody.mindmapsInfo.find((m) => String(m.id) === mapId)?.labels ?? []).toHaveLength(0);

      const labelsBody = await client.json<{ labels: Array<{ id: number }> }>(
        await client.get('/api/restful/labels'),
      );
      expect(labelsBody.labels.some((l) => l.id === lid)).toBe(true);
    });

    it('T1-F12-05: DELETE /labels/{lid} deletes label and cascades map associations', async () => {
      const client = await authedClient();
      const mapId = await createMap(client);
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('DelLbl'),
            color: '#123123',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      await client.post(`/api/restful/maps/${mapId}/labels`, lid);

      expect((await client.del(`/api/restful/labels/${lid}`)).status).toBe(204);

      const labelsBody = await client.json<{ labels: Array<{ id: number }> }>(
        await client.get('/api/restful/labels'),
      );
      expect(labelsBody.labels.some((l) => l.id === lid)).toBe(false);

      const mapsBody = await client.json<{
        mindmapsInfo: Array<{ id: number; labels: Array<{ id: number }> }>;
      }>(await client.get('/api/restful/maps'));
      expect(mapsBody.mindmapsInfo.find((m) => String(m.id) === mapId)?.labels ?? []).toHaveLength(0);
    });
  });

  describe('Tier 2 — F12: Label BVA, Validation & Edge Cases', () => {
    it('T2-F12-01: empty and whitespace-only label titles return 400 RestErrors with fieldErrors.title', async () => {
      const client = await authedClient();
      for (const badTitle of ['', '   ']) {
        const res = await client.post('/api/restful/labels', {
          title: badTitle,
          color: '#123456',
          iconName: 'tag',
        });
        expect(res.status).toBe(400);
        const body = await client.json<{ fieldErrors?: Record<string, string> }>(res);
        expect(body.fieldErrors?.title).toBeTruthy();
      }
    });

    it('T2-F12-02: label.title BVA accepts 30 chars (201) and rejects 31 chars (400)', async () => {
      const client = await authedClient();
      const title30 = uniqueExactLengthLabelTitle(LABEL_TITLE_MAX_LENGTH);
      const title31 = uniqueExactLengthLabelTitle(LABEL_TITLE_MAX_LENGTH + 1);
      expect(title30).toHaveLength(30);
      expect(title31).toHaveLength(31);

      let createdLabelId: string | null = null;
      try {
        const ok = await client.post('/api/restful/labels', {
          title: title30,
          color: '#123456',
          iconName: 'tag',
        });
        expect(ok.status).toBe(201);
        createdLabelId = ok.headers.get('resourceid');
        expect(createdLabelId).toBeTruthy();

        const fail = await client.post('/api/restful/labels', {
          title: title31,
          color: '#123456',
          iconName: 'tag',
        });
        expect(fail.status).toBe(400);
        const err = await client.json<{ fieldErrors?: Record<string, string> }>(fail);
        expect(err.fieldErrors?.title).toBeTruthy();
      } finally {
        if (createdLabelId) {
          await client.del(`/api/restful/labels/${createdLabelId}`).catch(() => undefined);
        }
      }
    });

    it('T2-F12-03: duplicate label title for same owner returns 400 RestErrors', async () => {
      const client = await authedClient();
      const title = uniqueLabelTitle('Urgent');
      expect(
        (
          await client.post('/api/restful/labels', {
            title,
            color: '#111111',
            iconName: 'tag',
          })
        ).status,
      ).toBe(201);

      const dup = await client.post('/api/restful/labels', {
        title,
        color: '#222222',
        iconName: 'tag',
      });
      expect(dup.status).toBe(400);
    });

    it('T2-F12-04: blank label color returns 400 RestErrors with fieldErrors.color', async () => {
      const client = await authedClient();
      for (const badColor of ['', '   ']) {
        const res = await client.post('/api/restful/labels', {
          title: uniqueLabelTitle('NoCol'),
          color: badColor,
          iconName: 'tag',
        });
        expect(res.status).toBe(400);
        const body = await client.json<{ fieldErrors?: Record<string, string> }>(res);
        expect(body.fieldErrors?.color).toBeTruthy();
      }
    });

    it('T2-F12-05: handles trailing-slash /labels/ and validates raw int vs non-int/unknown label on POST /maps/{id}/labels', async () => {
      const client = await authedClient();
      const mapId = await createMap(client);
      const lid = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('RawInt'),
            color: '#654321',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );

      expect((await client.get('/api/restful/labels/')).status).toBe(200);
      expect((await client.post(`/api/restful/maps/${mapId}/labels`, lid)).status).toBe(200);

      for (const badBody of ['"bad"', '{}', '999999']) {
        const res = await client.post(`/api/restful/maps/${mapId}/labels`, badBody, {
          headers: { 'content-type': 'application/json' },
        });
        expect(res.status).toBe(400);
      }
    });

    it('T2-F12-06: ?q=nonexistent_label returns empty list (200) and DELETE /labels/999999 returns 400', async () => {
      const client = await authedClient();
      const qRes = await client.get('/api/restful/maps?q=nonexistent_label_xyz');
      expect(qRes.status).toBe(200);
      expect(await client.json(qRes)).toEqual({ count: 0, mindmapsInfo: [] });

      const delRes = await client.del('/api/restful/labels/999999');
      expect(delRes.status).toBe(400);
    });
  });

  describe('Tier 3 — Cross-Feature History, Labels & Map Lifecycle Combinations', () => {
    it('T3-08: multi-label assignment + ?q= filtering + deleting one label preserves remaining label on map', async () => {
      const client = await authedClient();
      const mapA = await createMap(client, uniqueTitle('MultiLblA'));
      const mapB = await createMap(client, uniqueTitle('MultiLblB'));

      const workTitle = uniqueLabelTitle('Work');
      const personalTitle = uniqueLabelTitle('Personal');
      const workId = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: workTitle,
            color: '#1111aa',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      const personalId = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: personalTitle,
            color: '#aa1111',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );

      await client.post(`/api/restful/maps/${mapA}/labels`, workId);
      await client.post(`/api/restful/maps/${mapA}/labels`, personalId);
      await client.post(`/api/restful/maps/${mapB}/labels`, workId);

      const qWork = await client.json<{ count: number; mindmapsInfo: Array<{ id: number }> }>(
        await client.get(`/api/restful/maps?q=${encodeURIComponent(workTitle)}`),
      );
      expect(qWork.count).toBe(2);

      const qPersonal = await client.json<{ count: number; mindmapsInfo: Array<{ id: number }> }>(
        await client.get(`/api/restful/maps?q=${encodeURIComponent(personalTitle)}`),
      );
      expect(qPersonal.mindmapsInfo.map((m) => String(m.id))).toEqual([mapA]);

      expect((await client.del(`/api/restful/labels/${workId}`)).status).toBe(204);

      const qWorkAfter = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps?q=${encodeURIComponent(workTitle)}`),
      );
      expect(qWorkAfter.count).toBe(0);

      const mapsAfter = await client.json<{
        mindmapsInfo: Array<{ id: number; labels: Array<{ id: number }> }>;
      }>(await client.get('/api/restful/maps'));
      expect(
        mapsAfter.mindmapsInfo.find((m) => String(m.id) === mapA)?.labels.map((l) => l.id),
      ).toEqual([personalId]);
    });

    it('T3-09: deleting a mindmap removes its history & label associations while keeping label definitions', async () => {
      const client = await authedClient();
      const mapId = await createMap(client, uniqueTitle('DelWithHistLbl'));

      for (let v = 1; v <= 3; v++) {
        await client.put(`/api/restful/maps/${mapId}/document?minor=false`, {
          id: mapId,
          xml: createDefaultMapXml(`Rev-${v}`),
          properties: '{"zoom":0.8}',
          version: v,
        });
      }

      const lid1 = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('Keep1'),
            color: '#11aa11',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      const lid2 = Number.parseInt(
        (
          await client.post('/api/restful/labels', {
            title: uniqueLabelTitle('Keep2'),
            color: '#aa11aa',
            iconName: 'tag',
          })
        ).headers.get('resourceid') ?? '0',
        10,
      );
      await client.post(`/api/restful/maps/${mapId}/labels`, lid1);
      await client.post(`/api/restful/maps/${mapId}/labels`, lid2);

      expect((await client.del(`/api/restful/maps/${mapId}`)).status).toBe(204);
      expect((await client.get(`/api/restful/maps/${mapId}/history/`)).status).toBe(403);

      const labelsAfter = await client.json<{ labels: Array<{ id: number }> }>(
        await client.get('/api/restful/labels'),
      );
      const ids = labelsAfter.labels.map((l) => l.id);
      expect(ids).toContain(lid1);
      expect(ids).toContain(lid2);
    });

    it('T3-17: PUT /document/xml with X-Mindmap-Version bumps version and archives saved XML in history', async () => {
      const client = await authedClient();
      const id = await createMap(client, uniqueTitle('RawPreEdit'));
      const nextXml = createDefaultMapXml('RawPostEdit');

      const putRes = await client.put(`/api/restful/maps/${id}/document/xml`, nextXml, {
        headers: {
          'content-type': 'text/plain',
          'x-mindmap-version': '1',
        },
      });
      expect(putRes.status).toBe(200);
      expect(putRes.headers.get('x-mindmap-version')).toBe('2');

      const hist = await client.json<{ changes: HistoryItem[] }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.changes).toHaveLength(1);
      const hid = hist.changes[0]!.id;

      const snapXml = await (
        await client.get(`/api/restful/maps/${id}/${hid}/document/xml`)
      ).text();
      expect(snapXml).toBe(nextXml);
    });
  });
});
