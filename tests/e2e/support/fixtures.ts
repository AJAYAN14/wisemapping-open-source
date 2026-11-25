import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { SignJWT, jwtVerify, type JWTHeaderParameters, type JWTPayload } from 'jose';

export const ROOT = path.resolve(import.meta.dirname, '../../..');

const envLocalPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocalPath)) {
  loadDotenv({ path: envLocalPath, quiet: true });
}

export const DEFAULT_ALLOWED_EMAIL = (
  process.env.E2E_ALLOWED_EMAIL ||
  process.env.ALLOWED_EMAIL ||
  'a.jian0629@gmail.com'
)
  .trim()
  .toLowerCase();
export const DEFAULT_OWNER_UUID =
  process.env.E2E_OWNER_UID?.trim() || '00000000-0000-4000-8000-000000000001';
export const SECONDARY_USER_UUID = '00000000-0000-4000-8000-000000000002';
export const ATTACKER_UUID = '00000000-0000-4000-8000-000000000099';

export const DEFAULT_JWT_SECRET = 'test-e2e-hs256-jwt-secret-at-least-32-chars-long';
export const SEVEN_DAYS_MINUTES = 10080;
export const SEVEN_DAYS_SECONDS = SEVEN_DAYS_MINUTES * 60; // 604800

export const MAP_TITLE_API_MAX_LENGTH = 512;
export const LABEL_TITLE_MAX_LENGTH = 30;
export const NOTE_MAX_LENGTH = 10000;
export const EXPECTED_JAVA_BACKUP_SHA = 'bc7d6ea095b9bde1c881805ff737681504c93d43';

const TEXT_ENCODER = new TextEncoder();

export class NemoProtectionError extends Error {
  readonly targetKey: string;

  constructor(targetKey: string, detail: string) {
    super(`NemoProtectionError: Refusing operation on protected target "${targetKey}" (${detail}).`);
    this.name = 'NemoProtectionError';
    this.targetKey = targetKey;
  }
}

/**
 * Fail-closed guard that refuses any URL, DSN, or configuration containing "nemo"
 * before any network call or PostgreSQL connection is attempted.
 */
export function assertNotNemoTarget(values: Record<string, string | undefined>): void {
  for (const [key, rawValue] of Object.entries(values)) {
    if (!rawValue) {
      continue;
    }
    if (/nemo/i.test(rawValue)) {
      throw new NemoProtectionError(key, 'contains forbidden "nemo" identifier');
    }
  }
}

export function createRunId(): string {
  return `e2e-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
}

let titleSeq = 0;
export function uniqueTitle(prefix = 'Map', runId?: string): string {
  const suffix = runId ?? crypto.randomUUID().slice(0, 8);
  const seq = (++titleSeq).toString(36);
  const combined = `${prefix}-${suffix}-${seq}-${crypto.randomBytes(4).toString('hex')}`;
  return combined.slice(0, 80);
}

export function uniqueLabelTitle(prefix = 'Lbl'): string {
  const token = crypto.randomBytes(3).toString('hex');
  const maxPrefixLen = Math.max(1, LABEL_TITLE_MAX_LENGTH - token.length - 1);
  return `${prefix.slice(0, maxPrefixLen)}-${token}`.slice(0, LABEL_TITLE_MAX_LENGTH);
}

export function repeatChars(ch: string, length: number): string {
  if (length <= 0) {
    return '';
  }
  return ch.repeat(length).slice(0, length);
}

export function uniqueExactLengthString(length: number, fillChar = 'm'): string {
  if (length <= 0) {
    return '';
  }
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  if (length <= token.length + 1) {
    return token.slice(0, length);
  }
  const padLen = length - token.length - 1;
  return `${repeatChars(fillChar, padLen)}-${token}`;
}

export function uniqueExactLengthTitle(length: number, fillChar = 'm'): string {
  return uniqueExactLengthString(length, fillChar);
}

export function uniqueExactLengthLabelTitle(length: number, fillChar = 'l'): string {
  return uniqueExactLengthString(length, fillChar);
}

export const BVA_STRINGS = {
  mapTitleMax: repeatChars('m', MAP_TITLE_API_MAX_LENGTH),
  mapTitleOver: repeatChars('m', MAP_TITLE_API_MAX_LENGTH + 1),
  labelTitleMax: repeatChars('l', LABEL_TITLE_MAX_LENGTH),
  labelTitleOver: repeatChars('l', LABEL_TITLE_MAX_LENGTH + 1),
  noteValid: repeatChars('n', 1500),
  noteMax: repeatChars('n', NOTE_MAX_LENGTH),
  noteOver: repeatChars('n', NOTE_MAX_LENGTH + 5),
} as const;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createDefaultMapXml(title = 'Root', layout = 'mindmap'): string {
  const safeTitle = escapeXml(title);
  const safeLayout = escapeXml(layout);
  return `<map name="${safeTitle}" version="tango" theme="prism" layout="${safeLayout}"><topic central="true" text="${safeTitle}" id="1"/></map>`;
}

/**
 * Generates a valid WiseMapping XML document containing exactly `topicCount`
 * `<topic ...>` elements in O(N) time.
 */
export function generateLargeMapXml(topicCount: number, title = 'Large Map'): string {
  const safeTitle = escapeXml(title);
  if (topicCount <= 0) {
    return `<map name="${safeTitle}" version="tango" theme="prism" layout="mindmap"></map>`;
  }
  if (topicCount === 1) {
    return createDefaultMapXml(title);
  }
  const childrenCount = topicCount - 1;
  const children = Array.from({ length: childrenCount }, (_, index) => {
    const id = index + 2;
    const position = index % 2 === 0 ? '1' : '-1';
    return `<topic position="${position},0" order="${index}" text="Node ${id}" id="${id}"/>`;
  }).join('');
  return `<map name="${safeTitle}" version="tango" theme="prism" layout="mindmap"><topic central="true" text="${safeTitle}" id="1">${children}</topic></map>`;
}

export const XML_FIXTURES = {
  default: createDefaultMapXml('Root'),
  unicode:
    '<map name="Unicode" version="tango" theme="prism" layout="mindmap"><topic central="true" text="脑图 🚀 &amp; test" id="1"/></map>',
  malformedUnclosed: '<map version="tango"><topic central="true" text="broken">',
  wrongRoot: '<notmap><topic central="true" text="x"/></notmap>',
  xssScript:
    '<map version="tango"><topic central="true" text="x"/><script>alert(1)</script></map>',
  empty: '',
} as const;

export interface MintJwtOptions {
  email?: string;
  uid?: string;
  secret?: string;
  expiresInSeconds?: number;
  iatOffsetSeconds?: number;
  omitSub?: boolean;
}

export async function mintJwt(options: MintJwtOptions = {}): Promise<string> {
  const email = options.email ?? DEFAULT_ALLOWED_EMAIL;
  const uid = options.uid ?? DEFAULT_OWNER_UUID;
  const secret = options.secret ?? process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
  const expiresInSeconds = options.expiresInSeconds ?? SEVEN_DAYS_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const iat = nowSeconds + (options.iatOffsetSeconds ?? 0);
  const exp = iat + expiresInSeconds;

  const jwt = new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(iat)
    .setExpirationTime(exp);

  if (!options.omitSub) {
    jwt.setSubject(email);
  }

  return jwt.sign(TEXT_ENCODER.encode(secret));
}

export async function mintExpiredJwt(
  options: Omit<MintJwtOptions, 'expiresInSeconds' | 'iatOffsetSeconds'> = {},
): Promise<string> {
  return mintJwt({
    ...options,
    iatOffsetSeconds: -(SEVEN_DAYS_SECONDS + 60),
    expiresInSeconds: SEVEN_DAYS_SECONDS,
  });
}

export async function mintJwtWithoutSub(
  options: Omit<MintJwtOptions, 'omitSub' | 'email'> = {},
): Promise<string> {
  return mintJwt({
    ...options,
    omitSub: true,
  });
}

export function tamperJwtSignature(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[2]) {
    throw new Error('Expected compact 3-part JWT string');
  }
  const sig = parts[2];
  // Mutate the first character (byte 0 bits), never the trailing char which has discarded base64url padding bits.
  const firstChar = sig.charAt(0);
  const flipped = firstChar === 'A' ? 'B' : 'A';
  return `${parts[0]}.${parts[1]}.${flipped}${sig.slice(1)}`;
}

export async function verifyAndDecodeJwt(
  token: string,
  secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
): Promise<{
  payload: JWTPayload;
  header: JWTHeaderParameters;
  lifetimeSeconds: number;
}> {
  const { payload, protectedHeader } = await jwtVerify(token, TEXT_ENCODER.encode(secret), {
    algorithms: ['HS256'],
  });
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  return {
    payload,
    header: protectedHeader,
    lifetimeSeconds: exp - iat,
  };
}
