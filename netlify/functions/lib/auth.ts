import { SignJWT, jwtVerify } from 'jose';
import { DEFAULT_ALLOWED_EMAIL, getAllowedEmail, getJwtSecretBytes } from './env';

export { DEFAULT_ALLOWED_EMAIL, getAllowedEmail };

export const JWT_EXPIRATION_MIN = 10080; // 7 days
export const JWT_EXPIRATION_SECONDS = JWT_EXPIRATION_MIN * 60; // 604800

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionJwtUser {
  uid: string;
  email: string;
  name: string;
}

export interface VerifiableOAuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }>;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && normalized === getAllowedEmail();
}

function isExplicitlyUnverifiedFlag(val: unknown): boolean {
  return val === false || (typeof val === 'string' && val.trim().toLowerCase() === 'false');
}

export function isEmailVerified(user: VerifiableOAuthUser): boolean {
  if (!user.email || !user.email.trim()) {
    return false;
  }
  if (
    isExplicitlyUnverifiedFlag(user.user_metadata?.['email_verified']) ||
    isExplicitlyUnverifiedFlag(user.user_metadata?.['verified_email'])
  ) {
    return false;
  }
  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const data = identity?.identity_data;
      if (
        isExplicitlyUnverifiedFlag(data?.['email_verified']) ||
        isExplicitlyUnverifiedFlag(data?.['verified_email'])
      ) {
        return false;
      }
    }
  }
  return true;
}

export function extractUserDisplayName(user: VerifiableOAuthUser, fallbackEmail: string): string {
  const meta = user.user_metadata ?? {};
  const fullName = meta['full_name'] ?? meta['name'];
  if (typeof fullName === 'string' && fullName.trim().length > 0) {
    return fullName.trim();
  }
  const given = typeof meta['given_name'] === 'string' ? meta['given_name'].trim() : '';
  const family = typeof meta['family_name'] === 'string' ? meta['family_name'].trim() : '';
  const combined = `${given} ${family}`.trim();
  if (combined.length > 0) {
    return combined;
  }
  return fallbackEmail.split('@')[0] || 'User';
}

export function splitDisplayName(fullName: string, email: string): { firstname: string; lastname: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstname: email.split('@')[0] || 'User', lastname: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstname: parts[0] ?? trimmed, lastname: '' };
  }
  return {
    firstname: parts[0] ?? '',
    lastname: parts.slice(1).join(' '),
  };
}

export async function signSessionJwt(user: SessionJwtUser): Promise<string> {
  if (!UUID_REGEX.test(user.uid)) {
    throw new Error('Cannot sign session JWT without a valid Supabase user UUID (uid).');
  }
  const email = normalizeEmail(user.email);
  if (!isAllowedEmail(email)) {
    throw new UnauthorizedError('Email is not on ALLOWED_EMAIL allowlist.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + JWT_EXPIRATION_SECONDS;

  return new SignJWT({
    uid: user.uid,
    name: user.name.trim() || email.split('@')[0] || 'User',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(email)
    .setIssuedAt(nowSec)
    .setExpirationTime(expSec)
    .sign(getJwtSecretBytes());
}

export async function verifySessionJwt(token: string): Promise<SessionJwtUser> {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError();
  }
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes(), {
      algorithms: ['HS256'],
    });

    const sub = typeof payload.sub === 'string' ? normalizeEmail(payload.sub) : '';
    const uid = typeof payload['uid'] === 'string' ? payload['uid'].trim() : '';
    const name =
      typeof payload['name'] === 'string' && payload['name'].trim().length > 0
        ? payload['name'].trim()
        : sub.split('@')[0] || 'User';

    if (!sub || !isAllowedEmail(sub) || !UUID_REGEX.test(uid)) {
      throw new UnauthorizedError();
    }

    return { uid, email: sub, name };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError();
  }
}

export function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : undefined;
}

export async function requireAuth(req: Request): Promise<SessionJwtUser> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new UnauthorizedError();
  }
  return verifySessionJwt(token);
}
