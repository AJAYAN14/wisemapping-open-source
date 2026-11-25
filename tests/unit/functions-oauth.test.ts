import { decodeJwt } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveOrigin } from '../../netlify/functions/lib/http';
import {
  createOAuthHandler,
  sanitizeSafeRedirectPath,
} from '../../netlify/functions/oauth';
import type { OAuthClientLike } from '../../netlify/functions/oauth';

const TEST_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_UID = '11111111-2222-4333-8444-555555555555';

describe('functions oauth PKCE handler & email allowlist', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.ALLOWED_EMAIL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sanitizes relative redirect paths and blocks open redirects and encoded bypasses', () => {
    expect(sanitizeSafeRedirectPath('/c/maps/42/edit?foo=1#bar')).toBe('/c/maps/42/edit?foo=1#bar');
    expect(sanitizeSafeRedirectPath('/c/maps/42/edit?x=1#y')).toBe('/c/maps/42/edit?x=1#y');
    expect(sanitizeSafeRedirectPath('/c/maps/42/edit?title=My%20Map')).toBe(
      '/c/maps/42/edit?title=My%20Map',
    );
    expect(sanitizeSafeRedirectPath('https://evil.com/phish')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('//evil.com/phish')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/\\evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/c/maps\nLocation: evil')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%2f/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%2F/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%5c/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%5C/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%00/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%09/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%0d%0aLocation:https://evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%1f/evil.com')).toBeUndefined();
    expect(sanitizeSafeRedirectPath('/%7f/evil.com')).toBeUndefined();
  });

  it('validates X-Forwarded-Host and Host headers safely in resolveOrigin', () => {
    expect(
      resolveOrigin(
        new Request('http://localhost:8888/api/restful/app/config', {
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'maps.example.com',
          },
        }),
      ),
    ).toBe('https://maps.example.com');

    expect(
      resolveOrigin(
        new Request('http://localhost:8888/api/restful/app/config', {
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-host': '[::1]:8888',
          },
        }),
      ),
    ).toBe('https://[::1]:8888');

    const malformedHosts = [
      'evil.com/phish',
      'evil.com\\phish',
      'user@evil.com',
      'evil.com?next=1',
      'evil.com#frag',
      'evil.com bad',
      'https://evil.com',
      'http:evil.com',
    ];
    for (const badHost of malformedHosts) {
      expect(
        resolveOrigin(
          new Request('http://localhost:8888/api/restful/app/config', {
            headers: {
              'x-forwarded-proto': 'https',
              'x-forwarded-host': badHost,
              host: 'safe.example.com',
            },
          }),
        ),
      ).toBe('https://safe.example.com');

      expect(
        resolveOrigin(
          new Request('http://localhost:8888/api/restful/app/config', {
            headers: {
              'x-forwarded-proto': 'https',
              'x-forwarded-host': badHost,
              host: badHost,
            },
          }),
        ),
      ).toBe('http://localhost:8888');
    }
  });

  it('initializes unmocked createOAuthHandler cleanly on Node 20+ and sets PKCE cookies', async () => {
    process.env.SUPABASE_URL = 'https://clean-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'clean-anon-key';

    const handler = createOAuthHandler();
    const res = await handler(
      new Request('http://localhost:8888/oauth2/authorization/google?state=%2Fc%2Fmaps'),
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    expect(location?.startsWith('https://clean-project.supabase.co/auth/v1/authorize?')).toBe(
      true,
    );

    const setCookies = res.headers.getSetCookie();
    expect(
      setCookies.some(
        (c) =>
          c.startsWith('wm_oauth_state=%2Fc%2Fmaps') &&
          c.includes('HttpOnly') &&
          c.includes('SameSite=Lax'),
      ),
    ).toBe(true);
    expect(
      setCookies.some(
        (c) =>
          c.startsWith('sb-clean-project-auth-token-code-verifier=') &&
          c.includes('HttpOnly') &&
          c.includes('SameSite=Lax'),
      ),
    ).toBe(true);
  });

  it('starts Google OAuth PKCE flow with multi-cookie Set-Cookie and HttpOnly/SameSite=Lax', async () => {
    let capturedRedirectTo: string | undefined;

    const handler = createOAuthHandler({
      createSupabaseClient: (_req, resHeaders): OAuthClientLike => ({
        auth: {
          async signInWithOAuth(params) {
            capturedRedirectTo = params.options?.redirectTo;
            resHeaders.append(
              'Set-Cookie',
              'sb-proj-auth-token-code-verifier=pkce123; Path=/; HttpOnly; SameSite=Lax; Secure',
            );
            return {
              data: { url: 'https://proj.supabase.co/auth/v1/authorize?provider=google' },
              error: null,
            };
          },
          async exchangeCodeForSession() {
            throw new Error('not called');
          },
        },
      }),
    });

    const req = new Request(
      'https://my-wisemapping.netlify.app/oauth2/authorization/google?state=%2Fc%2Fmaps%2F42%2Fedit',
      {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'my-wisemapping.netlify.app',
        },
      },
    );

    const res = await handler(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://proj.supabase.co/auth/v1/authorize?provider=google',
    );
    expect(capturedRedirectTo).toBe('https://my-wisemapping.netlify.app/api/restful/oauth2/callback');
    expect(res.headers.get('cache-control')).toContain('no-store');

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBe(2);
    expect(setCookies.some((c) => c.startsWith('wm_oauth_state=') && c.includes('HttpOnly') && c.includes('Secure'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('sb-proj-auth-token-code-verifier='))).toBe(true);
  });

  it('handles rewritten /.netlify/functions/oauth/authorization/google path identically', async () => {
    const handler = createOAuthHandler({
      createSupabaseClient: (): OAuthClientLike => ({
        auth: {
          async signInWithOAuth() {
            return {
              data: { url: 'https://proj.supabase.co/auth/v1/authorize?provider=google' },
              error: null,
            };
          },
          async exchangeCodeForSession() {
            throw new Error('not called');
          },
        },
      }),
    });

    const res = await handler(
      new Request('http://localhost:8888/.netlify/functions/oauth/authorization/google'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://proj.supabase.co/auth/v1/authorize?provider=google',
    );
  });

  it('exchanges OAuth code, verifies allowlist case-insensitively, and redirects with 7d JWT', async () => {
    const handler = createOAuthHandler({
      createSupabaseClient: (): OAuthClientLike => ({
        auth: {
          async signInWithOAuth() {
            throw new Error('not called');
          },
          async exchangeCodeForSession(code) {
            expect(code).toBe('auth-code-123');
            return {
              data: {
                user: {
                  id: TEST_UID,
                  email: 'A.Jian0629@Gmail.com',
                  user_metadata: { full_name: 'AJian', email_verified: true },
                },
                session: { access_token: 'sb-access' },
              },
              error: null,
            };
          },
        },
      }),
    });

    const res = await handler(
      new Request('https://my-app.netlify.app/api/restful/oauth2/callback?code=auth-code-123', {
        headers: {
          cookie: 'wm_oauth_state=%2Fc%2Fmaps%2F7%2Fedit',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'my-app.netlify.app',
        },
      }),
    );

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin).toBe('https://my-app.netlify.app');
    expect(location.pathname).toBe('/c/oauth-callback');
    expect(location.searchParams.get('email')).toBe('a.jian0629@gmail.com');
    expect(location.searchParams.get('oauthSync')).toBe('true');
    expect(location.searchParams.get('provider')).toBe('google');
    expect(location.searchParams.get('state')).toBe('/c/maps/7/edit');

    const jwtToken = location.searchParams.get('jwtToken')!;
    expect(jwtToken).toBeTruthy();
    const payload = decodeJwt(jwtToken);
    expect(payload.sub).toBe('a.jian0629@gmail.com');
    expect(payload['uid']).toBe(TEST_UID);
    expect((payload.exp as number) - (payload.iat as number)).toBe(604800);
  });

  it('rejects non-allowlisted emails and unverified Google accounts without issuing JWT', async () => {
    let signedOut = false;

    const handler = createOAuthHandler({
      createSupabaseClient: (): OAuthClientLike => ({
        auth: {
          async signInWithOAuth() {
            throw new Error('not called');
          },
          async exchangeCodeForSession() {
            return {
              data: {
                user: {
                  id: TEST_UID,
                  email: 'intruder@gmail.com',
                  user_metadata: { email_verified: true },
                },
                session: {},
              },
              error: null,
            };
          },
          async signOut() {
            signedOut = true;
          },
        },
      }),
    });

    const res = await handler(
      new Request('http://localhost:8888/api/restful/oauth2/callback?code=bad-user'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:8888/c/login?error=oauth_failed');
    expect(signedOut).toBe(true);

    // Also test email_verified === false even for allowlisted email
    const unverifiedHandler = createOAuthHandler({
      createSupabaseClient: (): OAuthClientLike => ({
        auth: {
          async signInWithOAuth() {
            throw new Error('not called');
          },
          async exchangeCodeForSession() {
            return {
              data: {
                user: {
                  id: TEST_UID,
                  email: 'a.jian0629@gmail.com',
                  user_metadata: { email_verified: false },
                },
                session: {},
              },
              error: null,
            };
          },
        },
      }),
    });

    const res2 = await unverifiedHandler(
      new Request('http://localhost:8888/login/oauth2/code/google?code=unverified'),
    );
    expect(res2.status).toBe(302);
    expect(res2.headers.get('location')).toBe('http://localhost:8888/c/login?error=oauth_failed');

    const unverifiedCases: Array<{ label: string; user: Record<string, unknown> }> = [
      {
        label: 'identity without provider and email_verified=false',
        user: {
          id: TEST_UID,
          email: 'a.jian0629@gmail.com',
          identities: [{ identity_data: { email_verified: false } }],
        },
      },
      {
        label: 'oidc identity with verified_email=FALSE',
        user: {
          id: TEST_UID,
          email: 'a.jian0629@gmail.com',
          identities: [{ provider: 'oidc', identity_data: { verified_email: 'FALSE' } }],
        },
      },
      {
        label: 'user_metadata.email_verified="false"',
        user: {
          id: TEST_UID,
          email: 'a.jian0629@gmail.com',
          user_metadata: { email_verified: 'false' },
        },
      },
      {
        label: 'user_metadata.verified_email="False"',
        user: {
          id: TEST_UID,
          email: 'a.jian0629@gmail.com',
          user_metadata: { verified_email: 'False' },
        },
      },
    ];

    for (const testCase of unverifiedCases) {
      let caseSignedOut = false;
      const caseHandler = createOAuthHandler({
        createSupabaseClient: (): OAuthClientLike => ({
          auth: {
            async signInWithOAuth() {
              throw new Error('not called');
            },
            async exchangeCodeForSession() {
              return {
                data: {
                  user: testCase.user as never,
                  session: {},
                },
                error: null,
              };
            },
            async signOut() {
              caseSignedOut = true;
            },
          },
        }),
      });

      const caseRes = await caseHandler(
        new Request('http://localhost:8888/api/restful/oauth2/callback?code=unverified'),
      );
      expect(caseRes.status, testCase.label).toBe(302);
      expect(caseRes.headers.get('location'), testCase.label).toBe(
        'http://localhost:8888/c/login?error=oauth_failed',
      );
      expect(caseSignedOut, testCase.label).toBe(true);
    }
  });

  it('respects custom ALLOWED_EMAIL and handles legacy POST /api/restful/oauth2/googlecallback', async () => {
    process.env.ALLOWED_EMAIL = 'custom@example.com';

    const handler = createOAuthHandler({
      createSupabaseClient: (): OAuthClientLike => ({
        auth: {
          async signInWithOAuth() {
            throw new Error('not called');
          },
          async exchangeCodeForSession(code) {
            if (code === 'wrong-email') {
              return {
                data: {
                  user: { id: TEST_UID, email: 'a.jian0629@gmail.com' },
                  session: {},
                },
                error: null,
              };
            }
            return {
              data: {
                user: { id: TEST_UID, email: 'custom@example.com' },
                session: {},
              },
              error: null,
            };
          },
        },
      }),
    });

    const missingCodeRes = await handler(
      new Request('http://localhost:8888/api/restful/oauth2/googlecallback', { method: 'POST' }),
    );
    expect(missingCodeRes.status).toBe(400);

    const forbiddenRes = await handler(
      new Request('http://localhost:8888/api/restful/oauth2/googlecallback?code=wrong-email', {
        method: 'POST',
      }),
    );
    expect(forbiddenRes.status).toBe(403);

    const okRes = await handler(
      new Request('http://localhost:8888/api/restful/oauth2/googlecallback?code=valid-code', {
        method: 'POST',
      }),
    );
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as { email: string; oauthSync: boolean; jwtToken: string };
    expect(body.email).toBe('custom@example.com');
    expect(body.oauthSync).toBe(true);
    expect(decodeJwt(body.jwtToken).sub).toBe('custom@example.com');
  });
});
