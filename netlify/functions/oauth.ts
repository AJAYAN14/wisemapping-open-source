import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer, CookieOptions } from '@supabase/ssr';
import {
  extractUserDisplayName,
  isAllowedEmail,
  isEmailVerified,
  normalizeEmail,
  signSessionJwt,
} from './lib/auth';
import type { VerifiableOAuthUser } from './lib/auth';
import { getSupabaseClientConfig } from './lib/env';
import {
  buildCorsHeaders,
  isHttpsRequest,
  jsonResponse,
  normalizeOAuthPath,
  readOptionalJsonBody,
  resolveOrigin,
  restErrorResponse,
} from './lib/http';

export interface OAuthClientLike {
  auth: {
    signInWithOAuth(params: {
      provider: 'google';
      options?: {
        redirectTo?: string;
        skipBrowserRedirect?: boolean;
        queryParams?: Record<string, string>;
      };
    }): Promise<{ data: { url: string | null }; error: Error | null }>;
    exchangeCodeForSession(code: string): Promise<{
      data: { user: VerifiableOAuthUser | null; session: unknown | null };
      error: Error | null;
    }>;
    signOut?: () => Promise<unknown>;
  };
}

export interface OAuthHandlerDeps {
  createSupabaseClient?: (req: Request, resHeaders: Headers) => OAuthClientLike;
}

const OAUTH_STATE_COOKIE = 'wm_oauth_state';

export function parseRequestCookies(req: Request): Array<{ name: string; value: string }> {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return [];
  }
  const cookies: Array<{ name: string; value: string }> = [];
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const name = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!name) {
      continue;
    }
    try {
      cookies.push({ name, value: decodeURIComponent(rawValue) });
    } catch {
      cookies.push({ name, value: rawValue });
    }
  }
  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions & { secure: boolean },
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path || '/'}`);
  if (options.domain) {
    segments.push(`Domain=${options.domain}`);
  }
  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.expires) {
    const expiresDate =
      options.expires instanceof Date ? options.expires : new Date(options.expires);
    if (!Number.isNaN(expiresDate.getTime())) {
      segments.push(`Expires=${expiresDate.toUTCString()}`);
    }
  }
  segments.push('HttpOnly');
  const sameSite = typeof options.sameSite === 'string' ? options.sameSite : 'lax';
  const sameSiteLabel =
    sameSite.toLowerCase() === 'strict'
      ? 'Strict'
      : sameSite.toLowerCase() === 'none'
        ? 'None'
        : 'Lax';
  segments.push(`SameSite=${sameSiteLabel}`);
  if (options.secure) {
    segments.push('Secure');
  }
  return segments.join('; ');
}

export function sanitizeSafeRedirectPath(raw: string | null | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') {
    return undefined;
  }
  if (/[\x00-\x20\x7f]/.test(raw)) {
    return undefined;
  }
  if (/%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i.test(raw)) {
    return undefined;
  }
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return undefined;
  }
  try {
    const parsed = new URL(raw, 'https://wisemapping.local');
    if (
      parsed.origin !== 'https://wisemapping.local' ||
      parsed.pathname.startsWith('//') ||
      parsed.pathname.startsWith('/\\')
    ) {
      return undefined;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

function applyNoCacheHeaders(headers: Headers): void {
  headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  headers.set('Expires', '0');
  headers.set('Pragma', 'no-cache');
}

/**
 * Minimal WebSocket-like transport stub used only when `globalThis.WebSocket`
 * is absent (e.g., Node < 22) so `@supabase/ssr`'s `createServerClient` does
 * not throw eagerly inside `RealtimeClient` when only Auth PKCE is used.
 */
class NoopWebSocketTransport {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly readyState = 3;
  readonly url: string;
  readonly protocol = '';

  onopen: ((ev: unknown) => unknown) | null = null;
  onmessage: ((ev: unknown) => unknown) | null = null;
  onclose: ((ev: unknown) => unknown) | null = null;
  onerror: ((ev: unknown) => unknown) | null = null;

  constructor(address: string | URL, _subprotocols?: string | string[]) {
    this.url = typeof address === 'string' ? address : address.toString();
  }

  close(): void {}

  send(): void {
    throw new Error('WebSocket transport is unavailable in this serverless OAuth runtime.');
  }

  addEventListener(): void {}

  removeEventListener(): void {}
}

type ServerClientOptions = NonNullable<Parameters<typeof createServerClient>[2]>;
type RealtimeTransportOption = NonNullable<
  NonNullable<ServerClientOptions['realtime']>['transport']
>;

function defaultCreateSupabaseClient(req: Request, resHeaders: Headers): OAuthClientLike {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseClientConfig();
  const secure = isHttpsRequest(req);

  const cookies: CookieMethodsServer = {
    getAll() {
      return parseRequestCookies(req);
    },
    setAll(cookiesToSet, headers) {
      for (const item of cookiesToSet) {
        const serialized = serializeCookie(item.name, item.value, {
          ...item.options,
          httpOnly: true,
          sameSite: 'lax',
          path: item.options?.path ?? '/',
          secure,
        });
        resHeaders.append('Set-Cookie', serialized);
      }
      if (headers) {
        for (const [key, val] of Object.entries(headers)) {
          resHeaders.set(key, val);
        }
      }
      applyNoCacheHeaders(resHeaders);
    },
  };

  const realtimeOptions: Pick<ServerClientOptions, 'realtime'> =
    typeof globalThis.WebSocket === 'undefined'
      ? {
          realtime: {
            transport: NoopWebSocketTransport as unknown as RealtimeTransportOption,
          },
        }
      : {};

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies,
    ...realtimeOptions,
  }) as unknown as OAuthClientLike;
}

function redirectResponse(location: string, headers: Headers): Response {
  const finalHeaders = new Headers(headers);
  finalHeaders.set('Location', location);
  applyNoCacheHeaders(finalHeaders);
  return new Response(null, { status: 302, headers: finalHeaders });
}

function appendClearStateCookie(req: Request, resHeaders: Headers): void {
  resHeaders.append(
    'Set-Cookie',
    serializeCookie(OAUTH_STATE_COOKIE, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttpsRequest(req),
    }),
  );
}

function isAuthorizationRoute(path: string): boolean {
  return path === '/oauth2/authorization/google' || path === '/authorization/google';
}

function isRedirectCallbackRoute(path: string): boolean {
  return (
    path === '/api/restful/oauth2/callback' ||
    path === '/callback' ||
    path === '/login/oauth2/code/google' ||
    path === '/code/google'
  );
}

function isLegacyGoogleCallbackRoute(path: string): boolean {
  return path === '/api/restful/oauth2/googlecallback' || path === '/googlecallback';
}

export function createOAuthHandler(
  deps: OAuthHandlerDeps = {},
): (req: Request, context?: unknown) => Promise<Response> {
  const makeSupabase = deps.createSupabaseClient ?? defaultCreateSupabaseClient;

  return async (req: Request): Promise<Response> => {
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
    }

    const url = new URL(req.url);
    const path = normalizeOAuthPath(url);
    const origin = resolveOrigin(req);

    if (method === 'GET' && isAuthorizationRoute(path)) {
      const resHeaders = new Headers();
      const rawState = url.searchParams.get('state');
      const safeState = sanitizeSafeRedirectPath(rawState);

      if (safeState) {
        resHeaders.append(
          'Set-Cookie',
          serializeCookie(OAUTH_STATE_COOKIE, safeState, {
            path: '/',
            maxAge: 600,
            httpOnly: true,
            sameSite: 'lax',
            secure: isHttpsRequest(req),
          }),
        );
      }

      try {
        const supabase = makeSupabase(req, resHeaders);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${origin}/api/restful/oauth2/callback`,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
          },
        });

        if (error || !data?.url) {
          return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
        }
        return redirectResponse(data.url, resHeaders);
      } catch {
        return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
      }
    }

    if (method === 'GET' && isRedirectCallbackRoute(path)) {
      const resHeaders = new Headers();
      const cookies = parseRequestCookies(req);
      const stateCookie = cookies.find((c) => c.name === OAUTH_STATE_COOKIE)?.value;
      if (stateCookie !== undefined) {
        appendClearStateCookie(req, resHeaders);
      }

      const oauthError = url.searchParams.get('error');
      const code = url.searchParams.get('code')?.trim();
      if (oauthError || !code) {
        return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
      }

      try {
        const supabase = makeSupabase(req, resHeaders);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
          return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
        }

        const userEmail = data.user.email;
        if (!isEmailVerified(data.user) || !isAllowedEmail(userEmail)) {
          await supabase.auth.signOut?.().catch(() => {});
          return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
        }

        const normalizedEmail = normalizeEmail(userEmail!);
        const displayName = extractUserDisplayName(data.user, normalizedEmail);
        const jwtToken = await signSessionJwt({
          uid: data.user.id,
          email: normalizedEmail,
          name: displayName,
        });

        const safeState =
          sanitizeSafeRedirectPath(stateCookie) ??
          sanitizeSafeRedirectPath(url.searchParams.get('state'));

        const callbackUrl = new URL(`${origin}/c/oauth-callback`);
        callbackUrl.searchParams.set('jwtToken', jwtToken);
        callbackUrl.searchParams.set('email', normalizedEmail);
        callbackUrl.searchParams.set('oauthSync', 'true');
        callbackUrl.searchParams.set('provider', 'google');
        if (safeState) {
          callbackUrl.searchParams.set('state', safeState);
        }

        return redirectResponse(callbackUrl.toString(), resHeaders);
      } catch {
        return redirectResponse(`${origin}/c/login?error=oauth_failed`, resHeaders);
      }
    }

    if (method === 'POST' && isLegacyGoogleCallbackRoute(path)) {
      const resHeaders = new Headers();
      applyNoCacheHeaders(resHeaders);

      let code = url.searchParams.get('code')?.trim();
      if (!code) {
        try {
          const body = await readOptionalJsonBody<{ code?: string }>(req);
          if (typeof body?.code === 'string') {
            code = body.code.trim();
          }
        } catch {
          return restErrorResponse(req, 400, ['Missing OAuth authorization code.'], {
            globalSeverity: 'WARNING',
            errorCode: 'MISSING_OAUTH_CODE',
            extraHeaders: resHeaders,
          });
        }
      }

      if (!code) {
        return restErrorResponse(req, 400, ['Missing OAuth authorization code.'], {
          globalSeverity: 'WARNING',
          errorCode: 'MISSING_OAUTH_CODE',
          extraHeaders: resHeaders,
        });
      }

      try {
        const supabase = makeSupabase(req, resHeaders);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
          return restErrorResponse(req, 401, ['OAuth authentication failed.'], {
            globalSeverity: 'SEVERE',
            errorCode: 'OAUTH_FAILED',
            extraHeaders: resHeaders,
          });
        }

        const userEmail = data.user.email;
        if (!isEmailVerified(data.user) || !isAllowedEmail(userEmail)) {
          await supabase.auth.signOut?.().catch(() => {});
          return restErrorResponse(
            req,
            403,
            ['Email is not authorized to access this application.'],
            {
              globalSeverity: 'SEVERE',
              errorCode: 'EMAIL_NOT_ALLOWED',
              extraHeaders: resHeaders,
            },
          );
        }

        const normalizedEmail = normalizeEmail(userEmail!);
        const displayName = extractUserDisplayName(data.user, normalizedEmail);
        const jwtToken = await signSessionJwt({
          uid: data.user.id,
          email: normalizedEmail,
          name: displayName,
        });

        return jsonResponse(
          req,
          200,
          {
            email: normalizedEmail,
            oauthSync: true,
            jwtToken,
          },
          resHeaders,
        );
      } catch {
        return restErrorResponse(req, 500, ['OAuth authentication failed unexpectedly.'], {
          globalSeverity: 'SEVERE',
          errorCode: 'OAUTH_SERVER_ERROR',
          extraHeaders: resHeaders,
        });
      }
    }

    return restErrorResponse(req, 404, ['OAuth endpoint not found.'], {
      globalSeverity: 'WARNING',
      errorCode: 'NOT_FOUND',
    });
  };
}

export default createOAuthHandler();
