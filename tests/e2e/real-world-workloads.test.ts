import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  NemoProtectionError,
  ROOT,
  SEVEN_DAYS_SECONDS,
  XML_FIXTURES,
  assertNotNemoTarget,
  createDefaultMapXml,
  generateLargeMapXml,
  mintExpiredJwt,
  mintJwt,
  repeatChars,
  uniqueLabelTitle,
  uniqueTitle,
  verifyAndDecodeJwt,
} from './support/fixtures';

const caps = detectE2eCapabilities();

describe('Tier 4 — Real-World Multi-Device Application Workloads (T4-01..T4-08)', () => {
  let store: FakeStore;
  let oauth: FakeOAuthAdapter;

  beforeEach(() => {
    store = new FakeStore();
    oauth = new FakeOAuthAdapter();
  });

  it.skipIf(!caps.canRunApiRuntime || !caps.canRunOAuthRuntime)(
    'T4-01: First-Time Private Onboarding & Google OAuth Sign-In (Desktop)',
    async () => {
      const deps = createFakeHandlerDeps(store, oauth);
      const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });

      const cfgRes = await client.get('/api/restful/app/config');
      expect(cfgRes.status).toBe(200);
      const cfg = await client.json<{
        localLoginEnabled: boolean;
        registrationEnabled: boolean;
        googleOauth2Enabled: boolean;
        googleOauth2Url: string;
      }>(cfgRes);
      expect(cfg.localLoginEnabled).toBe(false);
      expect(cfg.registrationEnabled).toBe(false);
      expect(cfg.googleOauth2Enabled).toBe(true);

      // Verify frontend guards protect recovery & registration routes
      const appTsx = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/app.tsx'),
        'utf8',
      );
      expect(appTsx).toContain('/c/forgot-password');
      expect(appTsx).toContain('/:locale/c/registration');

      let jwt: string;
      if (caps.mode !== 'http') {
        // Attacker rejected before owner logs in (Mode A FakeOAuthAdapter)
        await client.get('/oauth2/authorization/google');
        const attackerCb = await client.get('/api/restful/oauth2/callback?code=attacker_code');
        expect(attackerCb.status).toBe(302);
        expect(attackerCb.headers.get('location') ?? '').toContain('/c/login?error=oauth_failed');

        // Owner signs in via Google OAuth PKCE flow
        const authInit = await client.get('/oauth2/authorization/google?state=/c/maps/');
        expect(authInit.status).toBe(302);
        expect(client.cookies.entries().length).toBeGreaterThan(0);

        const ownerCb = await client.get('/api/restful/oauth2/callback?code=valid_owner_code');
        expect(ownerCb.status).toBe(302);
        const cbUrl = new URL(ownerCb.headers.get('location') ?? '', 'https://e2e.local');
        expect(cbUrl.pathname).toBe('/c/oauth-callback');
        jwt = cbUrl.searchParams.get('jwtToken') ?? '';
        expect((await verifyAndDecodeJwt(jwt)).lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);
      } else {
        // Mode B live HTTP: verify OAuth initiation returns 302 + PKCE/state cookie; authenticate via mintJwt()
        const authInit = await client.get('/oauth2/authorization/google?state=/c/maps/');
        expect(authInit.status).toBe(302);
        expect(client.cookies.entries().length).toBeGreaterThan(0);
        jwt = await mintJwt();
      }

      const authed = client.withAuth(jwt);
      const acct = await authed.json<{ authenticationType: string; email: string }>(
        await authed.get('/api/restful/account'),
      );
      expect(acct.authenticationType).toBe('GOOGLE_OAUTH2');
      expect(acct.email).toBe(DEFAULT_ALLOWED_EMAIL);

      const mapsRes = await authed.get('/api/restful/maps/');
      expect(mapsRes.status).toBe(200);
      const maps = await authed.json<{ count: number; mindmapsInfo: unknown[] }>(mapsRes);
      expect(Array.isArray(maps.mindmapsInfo)).toBe(true);
      if (client.mode === 'handler') {
        expect(maps.count).toBe(0);
        expect(maps.mindmapsInfo).toEqual([]);
      }
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-02: Create, Structure, Label & Star Library (Desktop)',
    async () => {
      const jwt = await mintJwt();
      const client = (await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) })).withAuth(
        jwt,
      );

      const tArch = uniqueTitle('Architecture');
      const tSprint = uniqueTitle('SprintNotes');
      const tReading = uniqueTitle('ReadingList');

      let idArch: string | undefined;
      let idSprint: string | undefined;
      let idReading: string | undefined;
      let workId: number | undefined;
      let personalId: number | undefined;

      try {
        idArch = (
          await client.post(`/api/restful/maps?title=${encodeURIComponent(tArch)}&description=System`)
        ).headers.get('resourceid')!;
        idSprint = (
          await client.post(`/api/restful/maps?title=${encodeURIComponent(tSprint)}&description=Notes`)
        ).headers.get('resourceid')!;
        idReading = (
          await client.post(`/api/restful/maps?title=${encodeURIComponent(tReading)}&description=Books`)
        ).headers.get('resourceid')!;

        const workTitle = uniqueLabelTitle('Work');
        const personalTitle = uniqueLabelTitle('Personal');
        workId = Number.parseInt(
          (
            await client.post('/api/restful/labels', {
              title: workTitle,
              color: '#1976d2',
              iconName: 'work',
            })
          ).headers.get('resourceid')!,
          10,
        );
        personalId = Number.parseInt(
          (
            await client.post('/api/restful/labels', {
              title: personalTitle,
              color: '#2e7d32',
              iconName: 'home',
            })
          ).headers.get('resourceid')!,
          10,
        );

        await client.post(`/api/restful/maps/${idArch}/labels`, workId);
        await client.post(`/api/restful/maps/${idSprint}/labels`, workId);
        await client.post(`/api/restful/maps/${idReading}/labels`, personalId);

        await client.put(`/api/restful/maps/${idArch}/starred`, 'true', {
          headers: { 'content-type': 'text/plain' },
        });
        await client.put(`/api/restful/maps/${idReading}/description`, ' ', {
          headers: { 'content-type': 'text/plain' },
        });

        const starred = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(
          await client.get('/api/restful/maps?q=starred'),
        );
        const starredIds = starred.mindmapsInfo.map((m) => String(m.id));
        expect(starredIds).toContain(idArch);
        expect(starredIds).not.toContain(idSprint);
        expect(starredIds).not.toContain(idReading);

        const byWork = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(
          await client.get(`/api/restful/maps?q=${encodeURIComponent(workTitle)}`),
        );
        const workIds = byWork.mindmapsInfo.map((m) => String(m.id));
        expect(workIds).toContain(idArch);
        expect(workIds).toContain(idSprint);
        expect(workIds).not.toContain(idReading);

        const byPersonal = await client.json<{ mindmapsInfo: Array<{ id: number }> }>(
          await client.get(`/api/restful/maps?q=${encodeURIComponent(personalTitle)}`),
        );
        const personalIds = byPersonal.mindmapsInfo.map((m) => String(m.id));
        expect(personalIds).toContain(idReading);
        expect(personalIds).not.toContain(idArch);
        expect(personalIds).not.toContain(idSprint);

        const noteRes = await client.json<{ overLimit: boolean }>(
          await client.post('/api/restful/maps/validate-note', repeatChars('x', 1500), {
            headers: { 'content-type': 'text/plain' },
          }),
        );
        expect(noteRes.overLimit).toBe(false);
      } finally {
        const mapIdsToDelete = [idArch, idSprint, idReading].filter(Boolean) as string[];
        if (mapIdsToDelete.length > 0) {
          await client.del(`/api/restful/maps/batch?ids=${mapIdsToDelete.join(',')}`).catch(() => undefined);
        }
        if (workId !== undefined && Number.isFinite(workId)) {
          await client.del(`/api/restful/labels/${workId}`).catch(() => undefined);
        }
        if (personalId !== undefined && Number.isFinite(personalId)) {
          await client.del(`/api/restful/labels/${personalId}`).catch(() => undefined);
        }
      }
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-03: Multi-Device Edit & 409 Conflict Recovery Without Data Loss (Desktop + Mobile)',
    async () => {
      const jwt = await mintJwt();
      const deps = createFakeHandlerDeps(store, oauth);
      const desktop = (await createE2eClient({ apiDeps: deps })).withAuth(jwt);
      const mobile = (await createE2eClient({ apiDeps: deps })).withAuth(jwt);

      const id = (
        await desktop.post(`/api/restful/maps?title=${encodeURIComponent(uniqueTitle('SyncArch'))}`)
      ).headers.get('resourceid')!;

      // Desktop saves v1 -> v2
      const desktopV2Xml = generateLargeMapXml(4, 'DesktopBranches');
      const dSave1 = await desktop.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: desktopV2Xml,
        properties: '{"zoom":0.8}',
        version: 1,
      });
      expect(dSave1.status).toBe(204);
      expect(dSave1.headers.get('x-mindmap-version')).toBe('2');

      // Mobile opens v2 and saves v2 -> v3
      const mobileMeta = await mobile.json<{ version: number }>(
        await mobile.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(mobileMeta.version).toBe(2);
      const mobileV3Xml = generateLargeMapXml(5, 'MobileAddedTopic');
      const mSave = await mobile.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: mobileV3Xml,
        properties: '{"zoom":0.8}',
        version: mobileMeta.version,
      });
      expect(mSave.status).toBe(204);

      // Desktop still holds stale v2 and fires 15s autosave (minor=true)
      const staleAutoSave = await desktop.put(`/api/restful/maps/${id}/document?minor=true`, {
        id,
        xml: createDefaultMapXml('DesktopStaleAuto'),
        properties: '{"zoom":0.8}',
        version: 2,
      });
      expect(staleAutoSave.status).toBe(409);
      const conflictBody = await desktop.json<{ errorCode: string; currentVersion: number }>(
        staleAutoSave,
      );
      expect(conflictBody.errorCode).toBe('MINDMAP_VERSION_CONFLICT');
      expect(conflictBody.currentVersion).toBe(3);

      // Desktop refreshes metadata, receives v3 + mobile XML, merges, and saves v3 -> v4
      const refreshed = await desktop.json<{ version: number; xml: string }>(
        await desktop.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(refreshed.version).toBe(3);
      expect(refreshed.xml).toBe(mobileV3Xml);

      const finalSave = await desktop.put(`/api/restful/maps/${id}/document?minor=false`, {
        id,
        xml: generateLargeMapXml(6, 'MergedDesktopMobile'),
        properties: '{"zoom":0.8}',
        version: refreshed.version,
      });
      expect(finalSave.status).toBe(204);
      expect(finalSave.headers.get('x-mindmap-version')).toBe('4');

      // All 3 non-minor snapshots preserved permanently
      const hist = await desktop.json<{ count: number }>(
        await desktop.get(`/api/restful/maps/${id}/history/`),
      );
      expect(hist.count).toBe(3);
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-04: Tablet Bad-Edit Rollback via Permanent History (6+ Saves)',
    async () => {
      const jwt = await mintJwt();
      const client = (await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) })).withAuth(
        jwt,
      );
      const id = (
        await client.post(`/api/restful/maps?title=${encodeURIComponent(uniqueTitle('TabletHist'))}`)
      ).headers.get('resourceid')!;

      // 6 consecutive non-minor saves (v1 -> v7)
      for (let v = 1; v <= 6; v++) {
        const xml =
          v === 6 ? createDefaultMapXml('AccidentalDeleteV7') : createDefaultMapXml(`SaveStepV${v + 1}`);
        const res = await client.put(`/api/restful/maps/${id}/document?minor=false`, {
          id,
          xml,
          properties: '{"zoom":0.8}',
          version: v,
        });
        expect(res.status).toBe(204);
      }

      const histBefore = await client.json<{ count: number; changes: Array<{ id: number }> }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(histBefore.count).toBe(6);

      // Find snapshot containing SaveStepV5 and preview it
      let targetHid: number | undefined;
      for (const ch of histBefore.changes) {
        const snapXml = await (
          await client.get(`/api/restful/maps/${id}/${ch.id}/document/xml`)
        ).text();
        if (snapXml.includes('SaveStepV5')) {
          targetHid = ch.id;
          break;
        }
      }
      expect(targetHid).toBeDefined();

      // Revert to SaveStepV5 -> version advances to 8, accidental edit remains in history
      expect((await client.post(`/api/restful/maps/${id}/history/${targetHid}`)).status).toBe(204);

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(8);
      expect(meta.xml).toContain('SaveStepV5');

      const histAfter = await client.json<{ count: number }>(
        await client.get(`/api/restful/maps/${id}/history/`),
      );
      expect(histAfter.count).toBe(7);
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-05: Import Large Map (250+ Topics), Edit XML, Duplicate & Raw Export',
    async () => {
      const jwt = await mintJwt();
      const client = (await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) })).withAuth(
        jwt,
      );

      const bigXml = generateLargeMapXml(255, 'BigMap');
      const importRes = await client.post(
        `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('BigMap'))}`,
        bigXml,
        { headers: { 'content-type': 'application/xml' } },
      );
      expect(importRes.status).toBe(201);
      const id = importRes.headers.get('resourceid')!;

      const meta = await client.json<{ version: number; xml: string }>(
        await client.get(`/api/restful/maps/${id}/metadata?xml=true`),
      );
      expect(meta.version).toBe(1);
      expect(meta.xml).toBe(bigXml);

      const dupRes = await client.post(`/api/restful/maps/${id}`, {
        title: uniqueTitle('BigMapV2'),
      });
      expect(dupRes.status).toBe(201);
      const id2 = dupRes.headers.get('resourceid')!;

      const editedXml = generateLargeMapXml(260, 'BigMapV2Edited');
      expect(
        (
          await client.put(`/api/restful/maps/${id2}/document?minor=false`, {
            id: id2,
            xml: editedXml,
            properties: '{"zoom":0.9}',
            version: 1,
          })
        ).status,
      ).toBe(204);

      const exportRes = await client.get(`/api/restful/maps/${id2}/document/xml`);
      expect(exportRes.status).toBe(200);
      expect(exportRes.headers.get('x-mindmap-version')).toBe('2');
      expect(await exportRes.text()).toBe(editedXml);
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-06: 7-Day Session Continuity, Boundary Expiry & Explicit Logout (Mobile + Desktop)',
    async () => {
      const deps = createFakeHandlerDeps(store, oauth);
      const baseClient = await createE2eClient({ apiDeps: deps });

      // Token issued 6d23h ago (1 hour left) is still valid
      const nearExpiryJwt = await mintJwt({
        iatOffsetSeconds: -(SEVEN_DAYS_SECONDS - 3600),
      });
      const decoded = await verifyAndDecodeJwt(nearExpiryJwt);
      expect(decoded.lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);

      const activeClient = baseClient.withAuth(nearExpiryJwt);
      expect(
        (
          await activeClient.put('/api/restful/account/firstname', 'MobileUser', {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);
      expect(
        (
          await activeClient.put('/api/restful/account/locale', 'en', {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);

      // Logout succeeds
      expect((await activeClient.post('/api/restful/logout')).status).toBe(200);

      // Expired token (7d + 60s) and unauthenticated requests are rejected with 401
      const expiredJwt = await mintExpiredJwt();
      expect((await baseClient.withAuth(expiredJwt).get('/api/restful/maps')).status).toBe(401);
      const unauthRes = await baseClient.get('/api/restful/maps');
      expect(unauthRes.status).toBe(401);
      expect(await baseClient.json(unauthRes)).toEqual({ msg: 'Unauthorized' });
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-07: Workspace Cleanup, Transactional Batch Delete & Cascade Integrity',
    async () => {
      const jwt = await mintJwt();
      const client = (await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) })).withAuth(
        jwt,
      );

      const m1 = (
        await client.post(`/api/restful/maps?title=${encodeURIComponent(uniqueTitle('Clean1'))}`)
      ).headers.get('resourceid')!;
      const m2 = (
        await client.post(`/api/restful/maps?title=${encodeURIComponent(uniqueTitle('Clean2'))}`)
      ).headers.get('resourceid')!;
      const m3 = (
        await client.post(`/api/restful/maps?title=${encodeURIComponent(uniqueTitle('Clean3'))}`)
      ).headers.get('resourceid')!;

      let workId: number | undefined;
      try {
        workId = Number.parseInt(
          (
            await client.post('/api/restful/labels', {
              title: uniqueLabelTitle('WorkClean'),
              color: '#445566',
              iconName: 'tag',
            })
          ).headers.get('resourceid')!,
          10,
        );
        const personalId = Number.parseInt(
          (
            await client.post('/api/restful/labels', {
              title: uniqueLabelTitle('PersClean'),
              color: '#778899',
              iconName: 'tag',
            })
          ).headers.get('resourceid')!,
          10,
        );

        await client.post(`/api/restful/maps/${m1}/labels`, workId);
        await client.post(`/api/restful/maps/${m2}/labels`, personalId);
        await client.put(`/api/restful/maps/${m1}/document?minor=false`, {
          id: m1,
          xml: createDefaultMapXml('SnapBeforeDelete'),
          properties: '{"zoom":0.8}',
          version: 1,
        });

        expect((await client.del(`/api/restful/maps/${m1}/labels/${workId}`)).status).toBe(204);
        expect((await client.del(`/api/restful/maps/${m3}`)).status).toBe(204);
        expect((await client.del(`/api/restful/maps/batch?ids=${m1},${m2}`)).status).toBe(204);
        expect((await client.del(`/api/restful/labels/${personalId}`)).status).toBe(204);

        const mapsAfter = await client.json<{ count: number; mindmapsInfo: Array<{ id: number }> }>(
          await client.get('/api/restful/maps'),
        );
        const deletedIds = new Set([m1, m2, m3]);
        expect(mapsAfter.mindmapsInfo.some((m) => deletedIds.has(String(m.id)))).toBe(false);
        expect((await client.get(`/api/restful/maps/${m1}`)).status).toBe(403);
        expect((await client.get(`/api/restful/maps/${m2}`)).status).toBe(403);
        expect((await client.get(`/api/restful/maps/${m3}`)).status).toBe(403);
        expect((await client.get(`/api/restful/maps/${m1}/history/`)).status).toBe(403);
        const labelsAfter = await client.json<{ labels: Array<{ id: number }> }>(
          await client.get('/api/restful/labels'),
        );
        expect(labelsAfter.labels.some((l) => l.id === personalId)).toBe(false);
        if (client.mode === 'handler') {
          expect(store.countHistoryRows()).toBe(0);
          expect(store.countMindmapLabelRows()).toBe(0);
        }
      } finally {
        if (workId !== undefined && Number.isFinite(workId)) {
          await client.del(`/api/restful/labels/${workId}`).catch(() => undefined);
        }
      }
    },
  );

  it.skipIf(!caps.canRunApiRuntime)(
    'T4-08: Security, Private Isolation, Input Rejection & nemo Untouched Audit',
    async () => {
      const deps = createFakeHandlerDeps(store, oauth);
      const ownerJwt = await mintJwt({ email: DEFAULT_ALLOWED_EMAIL, uid: DEFAULT_OWNER_UUID });
      const foreignUidToken = await mintJwt({
        email: DEFAULT_ALLOWED_EMAIL,
        uid: '00000000-0000-4000-8000-000000000777',
      });
      const baseClient = await createE2eClient({ apiDeps: deps });
      const ownerClient = baseClient.withAuth(ownerJwt);
      const foreignClient = baseClient.withAuth(foreignUidToken);

      const id = (
        await ownerClient.post(
          `/api/restful/maps?title=${encodeURIComponent(uniqueTitle('SecAudit'))}`,
        )
      ).headers.get('resourceid')!;

      // Public sharing disabled
      expect(
        (await ownerClient.put(`/api/restful/maps/${id}/publish`, { isPublic: true })).status,
      ).toBe(403);

      // Unauthenticated XML read blocked
      expect((await baseClient.get(`/api/restful/maps/${id}/document/xml`)).status).toBe(401);

      // Foreign UID cannot read owner's map
      expect((await foreignClient.get(`/api/restful/maps/${id}`)).status).toBe(403);

      // XSS & oversized XML rejected
      expect(
        (
          await ownerClient.put(`/api/restful/maps/${id}/document`, {
            id,
            xml: XML_FIXTURES.xssScript,
            properties: '{"zoom":0.8}',
            version: 1,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await ownerClient.put(`/api/restful/maps/${id}/document`, {
            id,
            xml: generateLargeMapXml(5001, 'Oversized'),
            properties: '{"zoom":0.8}',
            version: 1,
          })
        ).status,
      ).toBe(400);

      // Fail-closed nemo guard verified
      expect(() =>
        assertNotNemoTarget({
          DATABASE_URL: 'postgresql://postgres:pw@db.nemo.supabase.co:5432/postgres',
        }),
      ).toThrow(NemoProtectionError);
    },
  );
});
