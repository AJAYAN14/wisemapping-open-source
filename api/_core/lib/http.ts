type RestSeverity = 'INFO' | 'WARNING' | 'SEVERE';

export interface RestErrors {
  globalErrors: string[];
  fieldErrors: Record<string, string>;
  globalSeverity?: RestSeverity;
  errorCode?: string;
  currentVersion?: number;
}

export class BadRequestError extends Error {
  readonly restErrors: RestErrors;

  constructor(
    globalErrors: string[],
    options?: {
      fieldErrors?: Record<string, string>;
      globalSeverity?: RestSeverity;
      errorCode?: string;
    },
  ) {
    super(globalErrors[0] ?? 'Bad Request');
    this.name = 'BadRequestError';
    this.restErrors = {
      globalErrors,
      fieldErrors: options?.fieldErrors ?? {},
      ...(options?.globalSeverity ? { globalSeverity: options.globalSeverity } : {}),
      ...(options?.errorCode ? { errorCode: options.errorCode } : {}),
    };
  }
}

function parseValidHostHeader(raw: string | null): string | undefined {
  const candidate = raw?.split(',')[0]?.trim();
  if (!candidate || /[\s\x00-\x1f\x7f\/\\@?#]/.test(candidate)) {
    return undefined;
  }
  try {
    const parsed = new URL(`http://${candidate}`);
    if (
      !parsed.hostname ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

export function resolveOrigin(req: Request): string {
  const xfProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const xfHost = parseValidHostHeader(req.headers.get('x-forwarded-host'));
  const host = xfHost || parseValidHostHeader(req.headers.get('host'));

  if (host) {
    let proto = xfProto;
    if (!proto) {
      try {
        proto = new URL(req.url).protocol.replace(':', '');
      } catch {
        proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      }
    }
    if (proto === 'http' || proto === 'https') {
      return `${proto}://${host}`;
    }
  }

  try {
    const parsed = new URL(req.url);
    if (parsed.origin && parsed.origin !== 'null') {
      return parsed.origin;
    }
  } catch {
    // Fall back to environment variables below
  }

  const envUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : process.env.APP_ORIGIN?.trim() || process.env.URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  return 'http://localhost:8888';
}

export function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (xfProto) {
    return xfProto === 'https';
  }
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildCorsHeaders(req: Request): Headers {
  const headers = new Headers();
  const origin = req.headers.get('origin')?.trim();
  headers.set('Access-Control-Allow-Origin', origin && origin.length > 0 ? origin : '*');
  if (origin && origin.length > 0) {
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, Accept-Language, X-Mindmap-Version, If-Match',
  );
  headers.set('Access-Control-Expose-Headers', 'Location, ResourceId, X-Mindmap-Version');
  return headers;
}

type HeaderInitLike = Headers | Record<string, string> | Array<[string, string]>;

function mergeHeaders(req: Request, extraHeaders?: HeaderInitLike): Headers {
  const headers = buildCorsHeaders(req);
  if (extraHeaders) {
    const extra = new Headers(extraHeaders);
    extra.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

export function jsonResponse(
  req: Request,
  status: number,
  body: unknown,
  extraHeaders?: HeaderInitLike,
): Response {
  const headers = mergeHeaders(req, extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

export function emptyResponse(req: Request, status: number, extraHeaders?: HeaderInitLike): Response {
  const headers = mergeHeaders(req, extraHeaders);
  return new Response(null, { status, headers });
}

export function xmlResponse(
  req: Request,
  status: number,
  xml: string,
  extraHeaders?: HeaderInitLike,
): Response {
  const headers = mergeHeaders(req, extraHeaders);
  headers.set('Content-Type', 'application/xml; charset=UTF-8');
  return new Response(xml, { status, headers });
}

export function textResponse(
  req: Request,
  status: number,
  text: string,
  extraHeaders?: HeaderInitLike,
): Response {
  const headers = mergeHeaders(req, extraHeaders);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(text, { status, headers });
}

export function unauthorizedResponse(req: Request): Response {
  return jsonResponse(req, 401, { msg: 'Unauthorized' });
}

export function restErrorResponse(
  req: Request,
  status: number,
  globalErrors: string[],
  options?: {
    fieldErrors?: Record<string, string>;
    globalSeverity?: RestSeverity;
    errorCode?: string;
    currentVersion?: number;
    extraHeaders?: HeaderInitLike;
  },
): Response {
  const payload: RestErrors = {
    globalErrors,
    fieldErrors: options?.fieldErrors ?? {},
    ...(options?.globalSeverity ? { globalSeverity: options.globalSeverity } : {}),
    ...(options?.errorCode ? { errorCode: options.errorCode } : {}),
    ...(options?.currentVersion !== undefined ? { currentVersion: options.currentVersion } : {}),
  };
  return jsonResponse(req, status, payload, options?.extraHeaders);
}

export async function readTextBody(req: Request): Promise<string> {
  if (!req.body) {
    return '';
  }
  return req.text();
}

export async function readJsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  const raw = await readTextBody(req);
  if (!raw || raw.trim().length === 0) {
    throw new BadRequestError(['Request body must not be empty.'], {
      globalSeverity: 'WARNING',
      errorCode: 'EMPTY_BODY',
    });
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BadRequestError(['Malformed JSON request body.'], {
      globalSeverity: 'WARNING',
      errorCode: 'INVALID_JSON',
    });
  }
}

export async function readOptionalJsonBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T | undefined> {
  const raw = await readTextBody(req);
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BadRequestError(['Malformed JSON request body.'], {
      globalSeverity: 'WARNING',
      errorCode: 'INVALID_JSON',
    });
  }
}

export function parsePositiveInt(raw: string | undefined, label = 'id'): number {
  if (!raw || !/^\d+$/.test(raw.trim())) {
    throw new BadRequestError([`Invalid ${label}: expected a positive integer.`], {
      globalSeverity: 'WARNING',
      errorCode: 'INVALID_ID',
    });
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestError([`Invalid ${label}: expected a positive integer.`], {
      globalSeverity: 'WARNING',
      errorCode: 'INVALID_ID',
    });
  }
  return value;
}

export function extractExpectedVersion(req: Request, bodyVersion?: unknown): number | undefined {
  const headerVersion = req.headers.get('x-mindmap-version');
  if (headerVersion !== null && headerVersion.trim().length > 0) {
    return parsePositiveInt(headerVersion, 'X-Mindmap-Version');
  }

  const ifMatch = req.headers.get('if-match');
  if (ifMatch !== null && ifMatch.trim().length > 0) {
    const cleaned = ifMatch.trim().replace(/^W\//i, '').replace(/^"(.*)"$/, '$1').trim();
    return parsePositiveInt(cleaned, 'If-Match');
  }

  if (bodyVersion !== undefined && bodyVersion !== null) {
    if (typeof bodyVersion === 'number') {
      if (!Number.isSafeInteger(bodyVersion) || bodyVersion < 1) {
        throw new BadRequestError(['Invalid version: expected a positive integer.'], {
          globalSeverity: 'WARNING',
          errorCode: 'INVALID_VERSION',
        });
      }
      return bodyVersion;
    }
    if (typeof bodyVersion === 'string' && bodyVersion.trim().length > 0) {
      return parsePositiveInt(bodyVersion, 'version');
    }
    throw new BadRequestError(['Invalid version: expected a positive integer.'], {
      globalSeverity: 'WARNING',
      errorCode: 'INVALID_VERSION',
    });
  }

  return undefined;
}

export function normalizeApiPath(url: URL): string {
  let path = url.pathname;
  if (path.startsWith('/api/wm-api')) {
    path = path.slice('/api/wm-api'.length);
  } else if (path.startsWith('/api/restful')) {
    path = path.slice('/api/restful'.length);
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

export function normalizeOAuthPath(url: URL): string {
  let path = url.pathname;
  if (path.startsWith('/api/wm-oauth')) {
    path = path.slice('/api/wm-oauth'.length);
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}
