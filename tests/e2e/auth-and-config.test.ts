import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_JWT_SECRET,
  DEFAULT_OWNER_UUID,
  ROOT,
  SEVEN_DAYS_MINUTES,
  SEVEN_DAYS_SECONDS,
  mintExpiredJwt,
  mintJwt,
  mintJwtWithoutSub,
  tamperJwtSignature,
  verifyAndDecodeJwt,
} from './support/fixtures';

const caps = detectE2eCapabilities();

describe('F7/F8 — App Config, Google OAuth PKCE, Allowlist & 7-Day JWT E2E', () => {
  let store: FakeStore;
  let oauth: FakeOAuthAdapter;
  const savedEnvUrl = process.env.URL;
  const savedAllowedEmail = process.env.ALLOWED_EMAIL;
  const savedJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    store = new FakeStore();
    oauth = new FakeOAuthAdapter();
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
    process.env.ALLOWED_EMAIL = process.env.ALLOWED_EMAIL ?? DEFAULT_ALLOWED_EMAIL;
  });

  afterEach(() => {
    if (savedEnvUrl === undefined) delete process.env.URL;
    else process.env.URL = savedEnvUrl;

    if (savedAllowedEmail === undefined) delete process.env.ALLOWED_EMAIL;
    else process.env.ALLOWED_EMAIL = savedAllowedEmail;

    if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedJwtSecret;
  });

  describe.skipIf(!caps.canRunApiRuntime)('Tier 1 — F7: /api/restful/app/config', () => {
    it.skipIf(caps.mode === 'http')(
      'T1-F07-01: unauthenticated GET /api/restful/app/config returns JSON with derived HTTPS origin',
      async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const res = await client.get('/api/restful/app/config', {
          headers: {
            host: 'my-wise.netlify.app',
            'x-forwarded-proto': 'https',
          },
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type') ?? '').toContain('application/json');
        const cfg = await client.json<{ apiBaseUrl: string; uiBaseUrl: string }>(res);
        expect(cfg.apiBaseUrl).toBe('https://my-wise.netlify.app');
        expect(cfg.uiBaseUrl).toBe('https://my-wise.netlify.app');
      },
    );

    it.skipIf(caps.mode === 'http')(
      'T1-F07-02: googleOauth2Enabled is true and googleOauth2Url matches request origin',
      async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const res = await client.get('/api/restful/app/config', {
          headers: {
            host: 'my-wise.netlify.app',
            'x-forwarded-proto': 'https',
          },
        });
        expect(res.status).toBe(200);
        const cfg = await client.json<{ googleOauth2Enabled: boolean; googleOauth2Url: string }>(res);
        expect(cfg.googleOauth2Enabled).toBe(true);
        expect(cfg.googleOauth2Url).toBe('https://my-wise.netlify.app/oauth2/authorization/google');
      },
    );

    it.skipIf(caps.mode !== 'http')(
      'Mode-B: GET /api/restful/app/config resolves origin matching E2E_BASE_URL and valid googleOauth2Url',
      async () => {
        const client = await createE2eClient();
        const res = await client.get('/api/restful/app/config');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type') ?? '').toContain('application/json');
        const cfg = await client.json<{
          apiBaseUrl: string;
          uiBaseUrl: string;
          googleOauth2Enabled: boolean;
          googleOauth2Url: string;
        }>(res);
        const expectedOrigin = new URL(caps.baseUrl!).origin;
        expect(cfg.apiBaseUrl).toBe(expectedOrigin);
        expect(cfg.uiBaseUrl).toBe(expectedOrigin);
        expect(cfg.googleOauth2Enabled).toBe(true);
        expect(cfg.googleOauth2Url.startsWith(cfg.apiBaseUrl)).toBe(true);
      },
    );

    it('T1-F07-03: non-Google auth, registration, and reCAPTCHA flags are disabled', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.get('/api/restful/app/config');
      expect(res.status).toBe(200);
      const cfg = await client.json<Record<string, unknown>>(res);
      expect(cfg.localLoginEnabled).toBe(false);
      expect(cfg.registrationEnabled).toBe(false);
      expect(cfg.facebookOauth2Enabled).toBe(false);
      expect(cfg.oidcOauth2Enabled).toBe(false);
      expect(cfg.recaptcha2Enabled).toBe(false);
    });

    it('T1-F07-04: jwtExpirationMin advertises 7-day (10080 min) lifetime', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.get('/api/restful/app/config');
      expect(res.status).toBe(200);
      const cfg = await client.json<{ jwtExpirationMin: number }>(res);
      expect(cfg.jwtExpirationMin).toBe(SEVEN_DAYS_MINUTES);
    });

    it('T1-F07-05: OPTIONS preflight exposes ResourceId, Location, and X-Mindmap-Version headers', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.options('/api/restful/app/config', {
        headers: { origin: 'https://my-wise.netlify.app' },
      });
      expect([200, 204]).toContain(res.status);
      const exposed = (res.headers.get('access-control-expose-headers') ?? '').toLowerCase();
      expect(exposed).toContain('resourceid');
      expect(exposed).toContain('location');
      expect(exposed).toContain('x-mindmap-version');
    });
  });

  describe.skipIf(!caps.canRunApiRuntime)('Tier 2 — F7: /api/restful/app/config Boundary & Corner Cases', () => {
    it.skipIf(caps.mode === 'http')(
      'T2-F07-01: falls back to http:// when X-Forwarded-Proto is absent on localhost',
      async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const res = await client.get('/api/restful/app/config', {
          headers: { host: 'localhost:8888' },
        });
        expect(res.status).toBe(200);
        const cfg = await client.json<{ apiBaseUrl: string; uiBaseUrl: string }>(res);
        expect(cfg.apiBaseUrl).toBe('http://localhost:8888');
        expect(cfg.uiBaseUrl).toBe('http://localhost:8888');
      },
    );

    it.skipIf(caps.mode === 'http')(
      'T2-F07-02: resolves request URL origin when Host is missing and ignores malformed X-Forwarded-Host',
      async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const resNoHost = await client.get('/api/restful/app/config');
        expect(resNoHost.status).toBe(200);
        const cfgNoHost = await client.json<{ apiBaseUrl: string; uiBaseUrl: string }>(resNoHost);
        expect(cfgNoHost.apiBaseUrl).toBe('https://e2e.local');
        expect(cfgNoHost.uiBaseUrl).toBe('https://e2e.local');

        const resBadXfHost = await client.get('/api/restful/app/config', {
          headers: { 'x-forwarded-host': 'bad@evil.com/path' },
        });
        expect(resBadXfHost.status).toBe(200);
        const cfgBadXfHost = await client.json<{ apiBaseUrl: string; uiBaseUrl: string }>(
          resBadXfHost,
        );
        expect(cfgBadXfHost.apiBaseUrl).toBe('https://e2e.local');
        expect(cfgBadXfHost.uiBaseUrl).toBe('https://e2e.local');
      },
    );

    it('T2-F07-03: trailing slash /api/restful/app/config/ returns identical 200 JSON config', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.get('/api/restful/app/config/');
      expect(res.status).toBe(200);
      const cfg = await client.json<{ jwtExpirationMin: number; googleOauth2Enabled: boolean }>(res);
      expect(cfg.jwtExpirationMin).toBe(SEVEN_DAYS_MINUTES);
      expect(cfg.googleOauth2Enabled).toBe(true);
    });

    it('T2-F07-04: disallowed method POST /api/restful/app/config returns 405 JSON RestErrors', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.post('/api/restful/app/config', {});
      expect(res.status).toBe(405);
      expect(res.headers.get('content-type') ?? '').toContain('application/json');
      const err = await client.json<{ globalErrors?: string[] }>(res);
      expect(Array.isArray(err.globalErrors)).toBe(true);
    });

    it('T2-F07-05: NON_NULL serialization omits null optional fields in app/config JSON', async () => {
      const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
      const res = await client.get('/api/restful/app/config');
      const cfg = await client.json<Record<string, unknown>>(res);
      for (const [key, value] of Object.entries(cfg)) {
        expect(value, `key ${key} should not be null`).not.toBeNull();
      }
    });
  });

  describe.skipIf(!caps.canRunOAuthRuntime || !caps.canRunApiRuntime)(
    'Tier 1 — F8: Google OAuth PKCE, Allowlist & 7d JWT',
    () => {
      it('T1-F08-01: GET /oauth2/authorization/google sets PKCE cookie and 302 redirects to OAuth authorize URL', async () => {
        const deps = createFakeHandlerDeps(store, oauth);
        const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
        const res = await client.get('/oauth2/authorization/google?state=/c/maps/');
        expect(res.status).toBe(302);
        const location = res.headers.get('location') ?? '';
        expect(location).toMatch(/^https?:\/\//);
        expect(client.cookies.entries().length).toBeGreaterThan(0);
        const rawSetCookie = res.headers.get('set-cookie') ?? '';
        expect(rawSetCookie.toLowerCase()).toContain('httponly');
        expect(rawSetCookie.toLowerCase()).toContain('path=/');
      });

      it.skipIf(caps.mode === 'http')(
        'T1-F08-02: allowlisted callback mints 7-day HS256 JWT and redirects to /c/oauth-callback',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.get('/api/restful/oauth2/callback?code=valid_owner_code');
          expect(res.status).toBe(302);
          const loc = new URL(res.headers.get('location') ?? '', 'https://e2e.local');
          expect(loc.pathname).toBe('/c/oauth-callback');
          expect(loc.searchParams.get('oauthSync')).toBe('true');
          expect(loc.searchParams.get('provider')).toBe('google');
          expect(loc.searchParams.get('email')).toBe(DEFAULT_ALLOWED_EMAIL);

          const token = loc.searchParams.get('jwtToken') ?? '';
          expect(token.split('.')).toHaveLength(3);
          const decoded = await verifyAndDecodeJwt(token);
          expect(decoded.header.alg).toBe('HS256');
          expect(decoded.payload.sub).toBe(DEFAULT_ALLOWED_EMAIL);
          expect(decoded.lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);
        },
      );

      it.skipIf(caps.mode === 'http')(
        'T1-F08-03: /login/oauth2/code/google Spring-compatible alias redirects with valid 7d JWT',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.get('/login/oauth2/code/google?code=valid_owner_code');
          expect(res.status).toBe(302);
          const loc = new URL(res.headers.get('location') ?? '', 'https://e2e.local');
          expect(loc.pathname).toBe('/c/oauth-callback');
          const token = loc.searchParams.get('jwtToken') ?? '';
          const decoded = await verifyAndDecodeJwt(token);
          expect(decoded.payload.sub).toBe(DEFAULT_ALLOWED_EMAIL);
        },
      );

      it.skipIf(caps.mode === 'http')(
        'T1-F08-04: POST /api/restful/oauth2/googlecallback?code=... returns 200 JSON with 7d JWT',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.post('/api/restful/oauth2/googlecallback?code=valid_owner_code');
          expect(res.status).toBe(200);
          const body = await client.json<{ email: string; oauthSync: boolean; jwtToken: string }>(res);
          expect(body.email).toBe(DEFAULT_ALLOWED_EMAIL);
          expect(body.oauthSync).toBe(true);
          const decoded = await verifyAndDecodeJwt(body.jwtToken);
          expect(decoded.lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);
        },
      );

      it('T1-F08-05: POST /api/restful/logout is idempotent across valid, expired, and missing JWTs', async () => {
        const deps = createFakeHandlerDeps(store, oauth);
        const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
        const validJwt = await mintJwt();
        const expiredJwt = await mintExpiredJwt();

        const r1 = await client.post('/api/restful/logout', undefined, { token: validJwt });
        const r2 = await client.post('/api/restful/logout', undefined, { token: expiredJwt });
        const r3 = await client.post('/api/restful/logout');
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r3.status).toBe(200);
      });
    },
  );

  describe('Tier 2 — F8: OAuth Allowlist & JWT Security Boundary Cases', () => {
    describe.skipIf(!caps.canRunOAuthRuntime || !caps.canRunApiRuntime)('OAuth Callback Rejections & Overrides', () => {
      it.skipIf(caps.mode === 'http')(
        'T2-F08-01: non-allowlisted email attacker@gmail.com redirects to /c/login?error=oauth_failed with zero JWT',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.get('/api/restful/oauth2/callback?code=attacker_code');
          expect(res.status).toBe(302);
          const loc = res.headers.get('location') ?? '';
          expect(loc).toContain('/c/login');
          expect(loc).toContain('error=oauth_failed');
          expect(loc).not.toContain('jwtToken=');
        },
      );

      it.skipIf(caps.mode === 'http')(
        'T2-F08-02: uppercase A.JIAN0629@GMAIL.COM matches allowlist case-insensitively and mints lowercase sub',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.get('/api/restful/oauth2/callback?code=uppercase_owner_code');
          expect(res.status).toBe(302);
          const loc = new URL(res.headers.get('location') ?? '', 'https://e2e.local');
          expect(loc.pathname).toBe('/c/oauth-callback');
          const token = loc.searchParams.get('jwtToken') ?? '';
          const decoded = await verifyAndDecodeJwt(token);
          expect(decoded.payload.sub).toBe(DEFAULT_ALLOWED_EMAIL);
        },
      );

      it.skipIf(caps.mode === 'http')(
        'T2-F08-03: unverified email is rejected even if email matches ALLOWED_EMAIL',
        async () => {
          const deps = createFakeHandlerDeps(store, oauth);
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const res = await client.get('/api/restful/oauth2/callback?code=unverified_owner_code');
          expect(res.status).toBe(302);
          const loc = res.headers.get('location') ?? '';
          expect(loc).toContain('/c/login');
          expect(loc).toContain('error=oauth_failed');
          expect(loc).not.toContain('jwtToken=');
        },
      );

      it('T2-F08-04: missing code or provider error=access_denied redirects to /c/login?error=oauth_failed', async () => {
        const deps = createFakeHandlerDeps(store, oauth);
        const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });

        const resDenied = await client.get('/api/restful/oauth2/callback?error=access_denied');
        expect(resDenied.status).toBe(302);
        expect(resDenied.headers.get('location') ?? '').toContain('/c/login?error=oauth_failed');

        const resMissing = await client.get('/api/restful/oauth2/callback');
        expect(resMissing.status).toBe(302);
        expect(resMissing.headers.get('location') ?? '').toContain('/c/login?error=oauth_failed');
      });

      it.skipIf(caps.mode === 'http')(
        'T2-F08-05: ALLOWED_EMAIL env override rejects default owner and permits overridden email',
        async () => {
          process.env.ALLOWED_EMAIL = 'custom@example.com';
          oauth.registerAuthCode('custom_code', {
            id: DEFAULT_OWNER_UUID,
            email: 'custom@example.com',
            emailVerified: true,
            fullName: 'Custom Owner',
          });
          const deps = createFakeHandlerDeps(store, oauth, { ALLOWED_EMAIL: 'custom@example.com' });
          const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
          await client.get('/oauth2/authorization/google');

          const denied = await client.get('/api/restful/oauth2/callback?code=valid_owner_code');
          expect(denied.status).toBe(302);
          expect(denied.headers.get('location') ?? '').toContain('error=oauth_failed');

          await client.get('/oauth2/authorization/google');
          const allowed = await client.get('/api/restful/oauth2/callback?code=custom_code');
          expect(allowed.status).toBe(302);
          const loc = new URL(allowed.headers.get('location') ?? '', 'https://e2e.local');
          expect(loc.pathname).toBe('/c/oauth-callback');
          expect(loc.searchParams.get('jwtToken')).toBeTruthy();
        },
      );
    });

    describe.skipIf(!caps.canRunApiRuntime)('JWT Validation Failures on Protected Endpoints', () => {
      it('T2-F08-06: missing, malformed, and tampered-signature JWTs all return 401 {"msg":"Unauthorized"}', async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const valid = await mintJwt();
        const tampered = tamperJwtSignature(valid);

        const responses = await Promise.all([
          client.get('/api/restful/maps'),
          client.get('/api/restful/maps', { token: 'not-a-jwt' }),
          client.get('/api/restful/maps', { token: tampered }),
        ]);

        for (const res of responses) {
          expect(res.status).toBe(401);
          expect(res.headers.get('content-type') ?? '').toContain('application/json');
          const body = await client.json<{ msg: string }>(res);
          expect(body).toEqual({ msg: 'Unauthorized' });
        }
      });

      it('T2-F08-07: expired JWT returns 401 while valid 7-day JWT has exact 604800s lifetime', async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const valid = await mintJwt();
        const decoded = await verifyAndDecodeJwt(valid);
        expect(decoded.lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);

        const expired = await mintExpiredJwt();
        const res = await client.get('/api/restful/maps', { token: expired });
        expect(res.status).toBe(401);
        expect(await client.json(res)).toEqual({ msg: 'Unauthorized' });
      });

      it('T2-F08-08: JWT missing sub or with non-allowlisted sub returns 401', async () => {
        const client = await createE2eClient({ apiDeps: createFakeHandlerDeps(store, oauth) });
        const noSub = await mintJwtWithoutSub();
        const wrongSub = await mintJwt({ email: 'other@gmail.com' });

        const r1 = await client.get('/api/restful/maps', { token: noSub });
        const r2 = await client.get('/api/restful/maps', { token: wrongSub });
        expect(r1.status).toBe(401);
        expect(r2.status).toBe(401);
      });
    });
  });

  describe('Tier 3 — Cross-Feature Auth, Config & Frontend Combinations', () => {
    it.skipIf(!caps.canRunApiRuntime || !caps.canRunOAuthRuntime || caps.mode === 'http')(
      'T3-01: app/config -> OAuth callback -> 7d JWT -> GET /account GOOGLE_OAUTH2 + app.tsx route guards',
      async () => {
        const deps = createFakeHandlerDeps(store, oauth);
        const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });

        const cfgRes = await client.get('/api/restful/app/config');
        const cfg = await client.json<{ googleOauth2Enabled: boolean; localLoginEnabled: boolean; googleOauth2Url: string }>(cfgRes);
        expect(cfg.googleOauth2Enabled).toBe(true);
        expect(cfg.localLoginEnabled).toBe(false);

        const authPath = new URL(cfg.googleOauth2Url).pathname;
        await client.get(authPath);
        const cbRes = await client.get('/api/restful/oauth2/callback?code=valid_owner_code');
        const cbUrl = new URL(cbRes.headers.get('location') ?? '', 'https://e2e.local');
        const jwt = cbUrl.searchParams.get('jwtToken') ?? '';
        expect(jwt.length).toBeGreaterThan(20);

        const acctRes = await client.withAuth(jwt).get('/api/restful/account');
        expect(acctRes.status).toBe(200);
        const acct = await client.json<{ authenticationType: string; email: string }>(acctRes);
        expect(acct.authenticationType).toBe('GOOGLE_OAUTH2');
        expect(acct.email).toBe(DEFAULT_ALLOWED_EMAIL);

        const appTsx = fs.readFileSync(
          path.join(ROOT, 'frontend/packages/webapp/src/app.tsx'),
          'utf8',
        );
        expect(appTsx).toContain('/c/forgot-password');
        expect(appTsx).toContain('/:locale/c/registration');
      },
    );

    it.skipIf(!caps.canRunApiRuntime || !caps.canRunOAuthRuntime || caps.mode === 'http')(
      'T3-02: ALLOWED_EMAIL override governs OAuth issuance and subsequent /account & /maps authorization',
      async () => {
        process.env.ALLOWED_EMAIL = 'second@gmail.com';
        oauth.registerAuthCode('second_code', {
          id: DEFAULT_OWNER_UUID,
          email: 'second@gmail.com',
          emailVerified: true,
          fullName: 'Second User',
        });
        const deps = createFakeHandlerDeps(store, oauth, { ALLOWED_EMAIL: 'second@gmail.com' });
        const client = await createE2eClient({ apiDeps: deps, oauthDeps: deps });
        await client.get('/oauth2/authorization/google');

        const rejected = await client.get('/api/restful/oauth2/callback?code=valid_owner_code');
        expect(rejected.headers.get('location') ?? '').toContain('error=oauth_failed');

        await client.get('/oauth2/authorization/google');
        const accepted = await client.get('/api/restful/oauth2/callback?code=second_code');
        const jwt =
          new URL(accepted.headers.get('location') ?? '', 'https://e2e.local').searchParams.get(
            'jwtToken',
          ) ?? '';
        const authed = client.withAuth(jwt);
        expect((await authed.get('/api/restful/account')).status).toBe(200);
        expect((await authed.get('/api/restful/maps')).status).toBe(200);
      },
    );

    it.skipIf(!caps.canRunApiRuntime)(
      'T3-03: expired JWT on PUT /maps/{id}/document returns 401 matching RESTPersistenceManager auth error contract',
      async () => {
        const deps = createFakeHandlerDeps(store, oauth);
        const validJwt = await mintJwt();
        const expiredJwt = await mintExpiredJwt();
        const client = await createE2eClient({ apiDeps: deps });

        let mapId = '';
        try {
          const created = await client
            .withAuth(validJwt)
            .post(`/api/restful/maps?title=${encodeURIComponent(`ExpireDoc-${Date.now()}`)}`);
          expect(created.status).toBe(201);
          mapId = created.headers.get('resourceid') ?? '';
          expect(mapId).toBeTruthy();

          const putRes = await client.withAuth(expiredJwt).put(`/api/restful/maps/${mapId}/document`, {
            id: mapId,
            xml: '<map version="tango"><topic central="true" text="Expired"/></map>',
            properties: '{"zoom":0.8}',
            version: 1,
          });
          expect(putRes.status).toBe(401);

          const pmSrc = fs.readFileSync(
            path.join(ROOT, 'frontend/packages/mindplot/src/components/RestPersistenceManager.ts'),
            'utf8',
          );
          expect(pmSrc).toContain('case 401:');
          expect(pmSrc).toContain("errorType: 'auth'");
        } finally {
          if (mapId) {
            await client.withAuth(validJwt).del(`/api/restful/maps/${mapId}`).catch(() => undefined);
          }
        }
      },
    );
  });
});
