import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_JWT_SECRET,
  ROOT,
  assertNotNemoTarget,
} from './fixtures';
import type { FakeHandlerDeps, RepoErrorConstructors } from './fake-repo';

export type WebHandler = (req: Request, context?: unknown) => Promise<Response>;

export interface E2eCapabilities {
  mode: 'http' | 'handler' | 'unavailable';
  baseUrl: string | null;
  apiEntry: string | null;
  oauthEntry: string | null;
  hasVercelJson: boolean;
  hasMigrations: boolean;
  hasDocsDeploymentGuide: boolean;
  hasEnvLocal: boolean;
  hasDatabaseUrl: boolean;
  canRunApiRuntime: boolean;
  canRunOAuthRuntime: boolean;
  canRunVercelJson: boolean;
  canRunMigrationChecks: boolean;
  canRunLiveDb: boolean;
}

const ENTRY_EXTENSIONS = ['.ts', '.js', '.mts', '.mjs'] as const;

export function resolveFunctionEntry(name: 'api' | 'oauth'): string | null {
  for (const ext of ENTRY_EXTENSIONS) {
    const candidate = path.join(ROOT, 'api', '_core', `${name}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function listMigrationFiles(): string[] {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(migrationsDir, file));
}

export function detectE2eCapabilities(): E2eCapabilities {
  const envLocalPath = path.join(ROOT, '.env.local');
  const hasEnvLocal = fs.existsSync(envLocalPath);
  if (hasEnvLocal) {
    loadDotenv({ path: envLocalPath, quiet: true });
  }

  const rawBaseUrl = process.env.E2E_BASE_URL?.trim();
  const baseUrl = rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl.replace(/\/+$/, '') : null;

  assertNotNemoTarget({
    E2E_BASE_URL: baseUrl ?? undefined,
    SUPABASE_URL: process.env.SUPABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  });

  const apiEntry = resolveFunctionEntry('api');
  const oauthEntry = resolveFunctionEntry('oauth');
  const hasVercelJson = fs.existsSync(path.join(ROOT, 'vercel.json'));
  const hasMigrations = listMigrationFiles().length > 0;
  const hasDocsDeploymentGuide = fs.existsSync(path.join(ROOT, 'docs', 'deployment-guide.md'));
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  const canRunApiRuntime = Boolean(baseUrl || apiEntry);
  const canRunOAuthRuntime = Boolean(baseUrl || oauthEntry);

  return {
    mode: baseUrl ? 'http' : apiEntry ? 'handler' : 'unavailable',
    baseUrl,
    apiEntry,
    oauthEntry,
    hasVercelJson,
    hasMigrations,
    hasDocsDeploymentGuide,
    hasEnvLocal,
    hasDatabaseUrl,
    canRunApiRuntime,
    canRunOAuthRuntime,
    canRunVercelJson: hasVercelJson,
    canRunMigrationChecks: hasMigrations,
    canRunLiveDb: hasMigrations && hasDatabaseUrl,
  };
}

export function requireRuntimeGate(caps = detectE2eCapabilities()): void {
  if (process.env.E2E_REQUIRE_RUNTIME === '1') {
    if (!caps.canRunApiRuntime || !caps.canRunOAuthRuntime) {
      throw new Error(
        `E2E_REQUIRE_RUNTIME=1 is set, but runtime handlers are unavailable (api=${String(caps.apiEntry)}, oauth=${String(caps.oauthEntry)}, baseUrl=${String(caps.baseUrl)}).`,
      );
    }
  }
  if (process.env.E2E_REQUIRE_DB === '1' && !caps.canRunLiveDb) {
    throw new Error(
      `E2E_REQUIRE_DB=1 is set, but live database verification prerequisites are missing (hasMigrations=${String(caps.hasMigrations)}, hasDatabaseUrl=${String(caps.hasDatabaseUrl)}).`,
    );
  }
}

async function importDynamicModule(absPath: string): Promise<Record<string, unknown>> {
  const specifier = process.env.VITEST
    ? `/@fs/${absPath.replace(/\\/g, '/')}`
    : pathToFileURL(absPath).href;
  return (await import(specifier)) as Record<string, unknown>;
}

export async function loadApiHandler(
  name: 'api' | 'oauth',
  deps?: unknown,
): Promise<WebHandler> {
  const entry = resolveFunctionEntry(name);
  if (!entry) {
    throw new Error(`API function entry "${name}" does not exist under api/_core/`);
  }

  const mod = await importDynamicModule(entry);
  const factoryName = name === 'api' ? 'createApiHandler' : 'createOAuthHandler';
  const factory = mod[factoryName];

  if (typeof factory === 'function') {
    const handler = (factory as (d?: unknown) => unknown)(deps);
    if (typeof handler === 'function') {
      return handler as WebHandler;
    }
  }

  if (typeof mod.default === 'function') {
    return mod.default as WebHandler;
  }

  throw new Error(
    `Module ${entry} must export "${factoryName}" or a default Web handler function.`,
  );
}

export interface StoredCookie {
  name: string;
  value: string;
  attributes: string;
}

export class CookieJar {
  private cookies = new Map<string, StoredCookie>();

  extractSetCookies(res: Response): StoredCookie[] {
    const headersWithGetSetCookie = res.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const rawList: string[] =
      typeof headersWithGetSetCookie.getSetCookie === 'function'
        ? headersWithGetSetCookie.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie')!]
          : [];

    const parsed: StoredCookie[] = [];
    for (const raw of rawList) {
      const segments = raw.split(';');
      const nameVal = segments[0]?.trim();
      if (!nameVal) {
        continue;
      }
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx <= 0) {
        continue;
      }
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      const attributes = segments.slice(1).join(';').trim();
      const entry: StoredCookie = { name, value, attributes };
      if (value === '' || /max-age=0/i.test(attributes)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, entry);
      }
      parsed.push(entry);
    }
    return parsed;
  }

  applyCookies(headers: Headers): void {
    const cookieStr = this.toCookieHeader();
    if (cookieStr && !headers.has('cookie')) {
      headers.set('cookie', cookieStr);
    }
  }

  toCookieHeader(): string {
    return Array.from(this.cookies.values())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  get(name: string): StoredCookie | undefined {
    return this.cookies.get(name);
  }

  entries(): StoredCookie[] {
    return Array.from(this.cookies.values());
  }

  clear(): void {
    this.cookies.clear();
  }
}

function createContextStub(cookieJar: CookieJar): Record<string, unknown> {
  return {
    requestId: crypto.randomUUID(),
    ip: '127.0.0.1',
    geo: {},
    params: {},
    cookies: {
      get: (name: string) => cookieJar.get(name)?.value,
      set: (opts: { name: string; value: string }) => {
        if (opts && typeof opts.name === 'string') {
          const headers = new Headers();
          headers.append('set-cookie', `${opts.name}=${opts.value}`);
          cookieJar.extractSetCookies(new Response(null, { headers }));
        }
      },
      delete: (name: string) => {
        const headers = new Headers();
        headers.append('set-cookie', `${name}=; Max-Age=0`);
        cookieJar.extractSetCookies(new Response(null, { headers }));
      },
    },
  };
}

function shouldRouteRestfulOAuthToOAuthHandler(): boolean {
  const vercelJsonPath = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(vercelJsonPath)) {
    return false;
  }
  try {
    const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8')) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
    };
    // Check if vercel.json explicitly maps /api/restful/oauth2/* to wm-oauth
    return (config.rewrites ?? []).some(
      (r) =>
        typeof r.source === 'string' &&
        r.source.startsWith('/api/restful/oauth2/') &&
        typeof r.destination === 'string' &&
        r.destination.includes('wm-oauth'),
    );
  } catch {
    return false;
  }
}

export interface E2eRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  headers?: Record<string, string>;
  token?: string | null;
  useCookieJar?: boolean;
  body?: RequestInit['body'] | Record<string, unknown> | number | string | null;
}

export interface E2eClient {
  readonly mode: 'http' | 'handler';
  readonly cookies: CookieJar;
  request(pathAndQuery: string, opts?: E2eRequestOptions): Promise<Response>;
  get(pathAndQuery: string, opts?: Omit<E2eRequestOptions, 'method' | 'body'>): Promise<Response>;
  post(
    pathAndQuery: string,
    body?: E2eRequestOptions['body'],
    opts?: Omit<E2eRequestOptions, 'method' | 'body'>,
  ): Promise<Response>;
  put(
    pathAndQuery: string,
    body?: E2eRequestOptions['body'],
    opts?: Omit<E2eRequestOptions, 'method' | 'body'>,
  ): Promise<Response>;
  del(pathAndQuery: string, opts?: Omit<E2eRequestOptions, 'method'>): Promise<Response>;
  options(pathAndQuery: string, opts?: Omit<E2eRequestOptions, 'method' | 'body'>): Promise<Response>;
  json<T = unknown>(res: Response): Promise<T>;
  withAuth(jwt: string): E2eClient;
}

export interface CreateE2eClientOptions {
  apiDeps?: unknown;
  oauthDeps?: unknown;
  baseUrl?: string | null;
  defaultToken?: string | null;
  cookieJar?: CookieJar;
}

async function loadRepoErrorConstructors(): Promise<RepoErrorConstructors | null> {
  for (const ext of ENTRY_EXTENSIONS) {
    const candidate = path.join(ROOT, 'api', '_core', 'lib', `repo${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const mod = await importDynamicModule(candidate);
      if (
        typeof mod.NotFoundOrForbiddenError === 'function' &&
        typeof mod.RepoValidationError === 'function' &&
        typeof mod.VersionConflictError === 'function'
      ) {
        return {
          NotFoundOrForbiddenError:
            mod.NotFoundOrForbiddenError as RepoErrorConstructors['NotFoundOrForbiddenError'],
          RepoValidationError:
            mod.RepoValidationError as RepoErrorConstructors['RepoValidationError'],
          VersionConflictError:
            mod.VersionConflictError as RepoErrorConstructors['VersionConflictError'],
        };
      }
    }
  }
  return null;
}

function isFakeHandlerDeps(value: unknown): value is FakeHandlerDeps {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isFakeHandlerDeps' in value &&
    (value as { __isFakeHandlerDeps?: unknown }).__isFakeHandlerDeps === true
  );
}

export async function createE2eClient(
  options: CreateE2eClientOptions = {},
): Promise<E2eClient> {
  const caps = detectE2eCapabilities();
  const baseUrl =
    options.baseUrl !== undefined ? options.baseUrl : caps.baseUrl;

  if (baseUrl) {
    assertNotNemoTarget({ E2E_BASE_URL: baseUrl });
    return buildClient({
      mode: 'http',
      baseUrl,
      defaultToken: options.defaultToken ?? null,
      cookieJar: options.cookieJar ?? new CookieJar(),
      dispatchInProcess: async () => {
        throw new Error('In-process dispatcher unused in HTTP mode');
      },
    });
  }

  // Ensure deterministic defaults for Mode A handler tests when not configured externally
  process.env.JWT_SECRET ??= DEFAULT_JWT_SECRET;
  process.env.ALLOWED_EMAIL ??= DEFAULT_ALLOWED_EMAIL;

  const errorClasses = await loadRepoErrorConstructors();
  const resolvedApiDeps =
    isFakeHandlerDeps(options.apiDeps) && errorClasses
      ? options.apiDeps.withErrorClasses(errorClasses)
      : options.apiDeps;
  const resolvedOAuthDeps =
    isFakeHandlerDeps(options.oauthDeps) && errorClasses
      ? options.oauthDeps.withErrorClasses(errorClasses)
      : options.oauthDeps;

  const [apiHandler, oauthHandler] = await Promise.all([
    caps.apiEntry ? loadApiHandler('api', resolvedApiDeps) : Promise.resolve(null),
    caps.oauthEntry ? loadApiHandler('oauth', resolvedOAuthDeps) : Promise.resolve(null),
  ]);

  if (!apiHandler && !oauthHandler) {
    throw new Error('No API function handlers available for E2eClient.');
  }

  const routeRestfulOAuthToOAuth = shouldRouteRestfulOAuthToOAuthHandler();
  const cookieJar = options.cookieJar ?? new CookieJar();

  return buildClient({
    mode: 'handler',
    baseUrl: 'https://e2e.local',
    defaultToken: options.defaultToken ?? null,
    cookieJar,
    dispatchInProcess: async (req: Request) => {
      const pathname = new URL(req.url).pathname;
      const ctx = createContextStub(cookieJar);

      if (pathname.startsWith('/oauth2/') || pathname.startsWith('/login/oauth2/')) {
        if (!oauthHandler) {
          throw new Error(`No oauthHandler loaded for ${pathname}`);
        }
        return oauthHandler(req, ctx);
      }

      if (pathname.startsWith('/api/restful/oauth2/') && routeRestfulOAuthToOAuth && oauthHandler) {
        return oauthHandler(req, ctx);
      }

      if (!apiHandler) {
        if (oauthHandler) {
          return oauthHandler(req, ctx);
        }
        throw new Error(`No apiHandler loaded for ${pathname}`);
      }

      const res = await apiHandler(req, ctx);
      // Fallback if /api/restful/oauth2/* is handled by oauthHandler when apiHandler returns 404
      if (
        res.status === 404 &&
        pathname.startsWith('/api/restful/oauth2/') &&
        oauthHandler
      ) {
        return oauthHandler(req, ctx);
      }
      return res;
    },
  });
}

interface BuildClientInternal {
  mode: 'http' | 'handler';
  baseUrl: string;
  defaultToken: string | null;
  cookieJar: CookieJar;
  dispatchInProcess: (req: Request) => Promise<Response>;
}

function buildClient(internal: BuildClientInternal): E2eClient {
  const sendRequest = async (
    pathAndQuery: string,
    opts: E2eRequestOptions = {},
  ): Promise<Response> => {
    const method = (opts.method ?? 'GET').toUpperCase();
    const headers = new Headers(opts.headers);

    const effectiveToken =
      opts.token !== undefined ? opts.token : internal.defaultToken;
    if (effectiveToken && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${effectiveToken}`);
    }

    if (opts.useCookieJar !== false) {
      internal.cookieJar.applyCookies(headers);
    }

    let serializedBody: RequestInit['body'] | undefined;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && opts.body !== undefined && opts.body !== null) {
      if (typeof opts.body === 'string' || opts.body instanceof Blob || opts.body instanceof Uint8Array) {
        serializedBody = opts.body;
      } else if (typeof opts.body === 'number' || typeof opts.body === 'object') {
        serializedBody = JSON.stringify(opts.body);
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }
      }
    }

    const normalizedPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;

    let response: Response;
    if (internal.mode === 'http') {
      const targetUrl = `${internal.baseUrl.replace(/\/+$/, '')}${normalizedPath}`;
      response = await globalThis.fetch(targetUrl, {
        method,
        headers,
        body: serializedBody,
        redirect: opts.redirect ?? 'manual',
      });
    } else {
      const reqHost = headers.get('host')?.trim();
      const xfProto = headers.get('x-forwarded-proto')?.trim().toLowerCase();
      let origin = internal.baseUrl.replace(/\/+$/, '');
      if (reqHost) {
        const proto =
          xfProto === 'http' || xfProto === 'https'
            ? xfProto
            : reqHost.startsWith('localhost') || reqHost.startsWith('127.0.0.1')
              ? 'http'
              : 'https';
        origin = `${proto}://${reqHost}`;
      }
      const req = new Request(`${origin}${normalizedPath}`, {
        method,
        headers,
        body: serializedBody,
      });
      response = await internal.dispatchInProcess(req);
    }

    if (opts.useCookieJar !== false) {
      internal.cookieJar.extractSetCookies(response);
    }
    return response;
  };

  return {
    mode: internal.mode,
    cookies: internal.cookieJar,
    request: sendRequest,
    get: (pathAndQuery, opts) => sendRequest(pathAndQuery, { ...opts, method: 'GET' }),
    post: (pathAndQuery, body, opts) =>
      sendRequest(pathAndQuery, { ...opts, method: 'POST', body }),
    put: (pathAndQuery, body, opts) =>
      sendRequest(pathAndQuery, { ...opts, method: 'PUT', body }),
    del: (pathAndQuery, opts) => sendRequest(pathAndQuery, { ...opts, method: 'DELETE' }),
    options: (pathAndQuery, opts) => sendRequest(pathAndQuery, { ...opts, method: 'OPTIONS' }),
    async json<T = unknown>(res: Response): Promise<T> {
      const text = await res.text();
      return JSON.parse(text) as T;
    },
    withAuth(jwt: string): E2eClient {
      return buildClient({
        ...internal,
        defaultToken: jwt,
      });
    },
  };
}
