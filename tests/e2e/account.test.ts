import { beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import { DEFAULT_ALLOWED_EMAIL, DEFAULT_OWNER_UUID, mintJwt, uniqueTitle } from './support/fixtures';

const caps = detectE2eCapabilities();

describe.skipIf(!caps.canRunApiRuntime)('F9 — Account Endpoints E2E', () => {
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

  describe('Tier 1 — F9: Account Feature Coverage', () => {
    it('T1-F09-01: GET /api/restful/account returns RestUser profile with GOOGLE_OAUTH2', async () => {
      const client = await authedClient();
      const res = await client.get('/api/restful/account');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type') ?? '').toContain('application/json');
      const user = await client.json<Record<string, unknown>>(res);
      expect(user.email).toBe(DEFAULT_ALLOWED_EMAIL);
      expect(user.authenticationType).toBe('GOOGLE_OAUTH2');
      expect(user.isActive).toBe(true);
      expect(user.isSuspended).toBe(false);
      expect(user.isAdmin).toBe(false);
      expect(typeof user.firstname).toBe('string');
      expect(typeof user.lastname).toBe('string');
      expect(typeof user.fullName).toBe('string');
      expect(typeof user.locale).toBe('string');
    });

    it('T1-F09-02: PUT /api/restful/account/firstname accepts valid name (204)', async () => {
      const client = await authedClient();
      const putRes = await client.put('/api/restful/account/firstname', 'Jian', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(putRes.status).toBe(204);

      const getRes = await client.get('/api/restful/account');
      expect(getRes.status).toBe(200);
      const user = await client.json<{ email: string }>(getRes);
      expect(user.email).toBe(DEFAULT_ALLOWED_EMAIL);
    });

    it('T1-F09-03: PUT /api/restful/account/lastname accepts valid name (204)', async () => {
      const client = await authedClient();
      const putRes = await client.put('/api/restful/account/lastname', 'Lin', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(putRes.status).toBe(204);

      const getRes = await client.get('/api/restful/account');
      expect(getRes.status).toBe(200);
      const user = await client.json<{ email: string }>(getRes);
      expect(user.email).toBe(DEFAULT_ALLOWED_EMAIL);
    });

    it('T1-F09-04: PUT /api/restful/account/locale accepts valid locale code (204)', async () => {
      const client = await authedClient();
      const putRes = await client.put('/api/restful/account/locale', 'zh-CN', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(putRes.status).toBe(204);

      const getRes = await client.get('/api/restful/account');
      expect(getRes.status).toBe(200);
      const user = await client.json<{ locale: string }>(getRes);
      expect(typeof user.locale).toBe('string');
    });

    it('T1-F09-05: rejects password change for GOOGLE_OAUTH2 user and rejects unauthenticated GET /account', async () => {
      const client = await authedClient();
      const pwdRes = await client.put('/api/restful/account/password', 'newSecret123', {
        headers: { 'content-type': 'text/plain' },
      });
      expect([400, 403]).toContain(pwdRes.status);
      expect(pwdRes.headers.get('content-type') ?? '').toContain('application/json');

      const unauth = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const getRes = await unauth.get('/api/restful/account');
      expect(getRes.status).toBe(401);
      expect(await unauth.json(getRes)).toEqual({ msg: 'Unauthorized' });
    });
  });

  describe('Tier 2 — F9: Account Boundary & Corner Cases', () => {
    it('T2-F09-01: rejects empty or whitespace-only firstname and lastname with 400 RestErrors', async () => {
      const client = await authedClient();
      for (const path of ['/api/restful/account/firstname', '/api/restful/account/lastname']) {
        for (const bad of ['', '   ']) {
          const res = await client.put(path, bad, {
            headers: { 'content-type': 'text/plain' },
          });
          expect(res.status).toBe(400);
          expect(res.headers.get('content-type') ?? '').toContain('application/json');
          const err = await client.json<{ globalErrors?: string[] }>(res);
          expect(Array.isArray(err.globalErrors)).toBe(true);
        }
      }
    });

    it('T2-F09-02: rejects blank locale (400) while accepting valid locale codes ("en", "ja")', async () => {
      const client = await authedClient();
      const blankRes = await client.put('/api/restful/account/locale', '', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(blankRes.status).toBe(400);

      for (const locale of ['en', 'ja']) {
        const okRes = await client.put('/api/restful/account/locale', locale, {
          headers: { 'content-type': 'text/plain' },
        });
        expect(okRes.status).toBe(204);
      }
    });

    it('T2-F09-03: handles application/json Content-Type on PUT /account/firstname safely without 500', async () => {
      const client = await authedClient();
      const res = await client.put('/api/restful/account/firstname', '"Alice"', {
        headers: { 'content-type': 'application/json' },
      });
      expect(res.status).toBeLessThan(500);
      expect([204, 400, 415]).toContain(res.status);
    });

    it('T2-F09-04: DELETE /api/restful/account enforces single-owner safety policy without 500', async () => {
      const client = await authedClient();
      const res = await client.del('/api/restful/account');
      expect(res.status).toBeLessThan(500);
      expect([403, 204]).toContain(res.status);
    });

    it('T2-F09-05: unauthenticated PUT /api/restful/account/locale returns 401 {"msg":"Unauthorized"}', async () => {
      const unauth = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await unauth.put('/api/restful/account/locale', 'en', {
        headers: { 'content-type': 'text/plain' },
      });
      expect(res.status).toBe(401);
      expect(await unauth.json(res)).toEqual({ msg: 'Unauthorized' });
    });
  });

  describe('Tier 3 — F9 x F10 x F8: Account Profile & Mindmap Ownership Continuity', () => {
    it('T3-Account-01: updating profile fields preserves allowlisted email and existing mindmap ownership', async () => {
      const client = await authedClient();
      const title = uniqueTitle('AcctMap');
      const created = await client.post(`/api/restful/maps?title=${encodeURIComponent(title)}`);
      expect(created.status).toBe(201);

      expect(
        (
          await client.put('/api/restful/account/firstname', 'Ming', {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);
      expect(
        (
          await client.put('/api/restful/account/lastname', 'Chen', {
            headers: { 'content-type': 'text/plain' },
          })
        ).status,
      ).toBe(204);

      const acct = await client.json<{ email: string; authenticationType: string }>(
        await client.get('/api/restful/account'),
      );
      expect(acct.email).toBe(DEFAULT_ALLOWED_EMAIL);
      expect(acct.authenticationType).toBe('GOOGLE_OAUTH2');

      const mapsRes = await client.get('/api/restful/maps');
      const mapsBody = await client.json<{ mindmapsInfo: Array<{ title: string; role: string }> }>(
        mapsRes,
      );
      expect(mapsBody.mindmapsInfo.some((m) => m.title === title && m.role === 'owner')).toBe(true);
    });
  });
});
