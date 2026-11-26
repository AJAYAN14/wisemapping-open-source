import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_EMAIL,
  JWT_EXPIRATION_MIN,
  JWT_EXPIRATION_SECONDS,
  UnauthorizedError,
  getAllowedEmail,
  isAllowedEmail,
  isEmailVerified,
  requireAuth,
  signSessionJwt,
  verifySessionJwt,
} from '../../api/_core/lib/auth';
import { NemoProtectionError, assertNotNemoTarget } from '../../api/_core/lib/env';

const TEST_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_UID = '11111111-2222-4333-8444-555555555555';

describe('functions auth, 7-day JWT & nemo guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.ALLOWED_EMAIL;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults ALLOWED_EMAIL to a.jian0629@gmail.com and matches case-insensitively', () => {
    expect(getAllowedEmail()).toBe(DEFAULT_ALLOWED_EMAIL);
    expect(isAllowedEmail('a.jian0629@gmail.com')).toBe(true);
    expect(isAllowedEmail('  A.JIAN0629@GMAIL.COM  ')).toBe(true);
    expect(isAllowedEmail('other@gmail.com')).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
  });

  it('respects custom ALLOWED_EMAIL override', () => {
    process.env.ALLOWED_EMAIL = 'Owner.Custom@Example.com';
    expect(getAllowedEmail()).toBe('owner.custom@example.com');
    expect(isAllowedEmail('owner.custom@example.com')).toBe(true);
    expect(isAllowedEmail('a.jian0629@gmail.com')).toBe(false);
  });

  it('mints and verifies a 7-day HS256 JWT with sub=email and uid=supabaseUserId', async () => {
    expect(JWT_EXPIRATION_MIN).toBe(10080);
    expect(JWT_EXPIRATION_SECONDS).toBe(604800);

    const token = await signSessionJwt({
      uid: TEST_UID,
      email: 'A.Jian0629@Gmail.com',
      name: 'AJian',
    });

    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('HS256');

    const payload = decodeJwt(token);
    expect(payload.sub).toBe('a.jian0629@gmail.com');
    expect(payload['uid']).toBe(TEST_UID);
    expect(payload['name']).toBe('AJian');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect((payload.exp as number) - (payload.iat as number)).toBe(604800);

    const verified = await verifySessionJwt(token);
    expect(verified).toEqual({
      uid: TEST_UID,
      email: 'a.jian0629@gmail.com',
      name: 'AJian',
    });
  });

  it('rejects JWT signing when email is not allowlisted or JWT_SECRET is too short', async () => {
    await expect(
      signSessionJwt({
        uid: TEST_UID,
        email: 'intruder@gmail.com',
        name: 'Intruder',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    process.env.JWT_SECRET = 'too-short';
    await expect(
      signSessionJwt({
        uid: TEST_UID,
        email: 'a.jian0629@gmail.com',
        name: 'Owner',
      }),
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it('rejects expired, wrong-secret, non-allowlisted, and missing-uid JWTs', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ uid: TEST_UID, name: 'Owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('a.jian0629@gmail.com')
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 10)
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(verifySessionJwt(expiredToken)).rejects.toBeInstanceOf(UnauthorizedError);

    const wrongSecretToken = await new SignJWT({ uid: TEST_UID, name: 'Owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('a.jian0629@gmail.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
    await expect(verifySessionJwt(wrongSecretToken)).rejects.toBeInstanceOf(UnauthorizedError);

    const wrongEmailToken = await new SignJWT({ uid: TEST_UID, name: 'Intruder' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('intruder@gmail.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(verifySessionJwt(wrongEmailToken)).rejects.toBeInstanceOf(UnauthorizedError);

    const missingUidToken = await new SignJWT({ name: 'Owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('a.jian0629@gmail.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(verifySessionJwt(missingUidToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('extracts and validates Bearer token in requireAuth', async () => {
    const token = await signSessionJwt({
      uid: TEST_UID,
      email: 'a.jian0629@gmail.com',
      name: 'Owner',
    });

    const missingReq = new Request('http://localhost:8888/api/restful/maps');
    await expect(requireAuth(missingReq)).rejects.toBeInstanceOf(UnauthorizedError);

    const badSchemeReq = new Request('http://localhost:8888/api/restful/maps', {
      headers: { Authorization: `Basic ${token}` },
    });
    await expect(requireAuth(badSchemeReq)).rejects.toBeInstanceOf(UnauthorizedError);

    const validReq = new Request('http://localhost:8888/api/restful/maps', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(requireAuth(validReq)).resolves.toMatchObject({
      uid: TEST_UID,
      email: 'a.jian0629@gmail.com',
    });
  });

  it('checks email_verified flags strictly', () => {
    expect(isEmailVerified({ id: TEST_UID, email: 'a.jian0629@gmail.com' })).toBe(true);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        user_metadata: { email_verified: true },
        identities: [{ provider: 'google', identity_data: { email_verified: true } }],
      }),
    ).toBe(true);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        user_metadata: { email_verified: false },
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        user_metadata: { email_verified: 'false' },
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        user_metadata: { verified_email: false },
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        user_metadata: { verified_email: 'False' },
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        identities: [{ provider: 'google', identity_data: { email_verified: false } }],
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        identities: [{ identity_data: { email_verified: false } }],
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        identities: [{ provider: 'oidc', identity_data: { verified_email: 'FALSE' } }],
      }),
    ).toBe(false);
    expect(
      isEmailVerified({
        id: TEST_UID,
        email: 'a.jian0629@gmail.com',
        identities: [{ provider: 'github', identity_data: { email_verified: ' false ' } }],
      }),
    ).toBe(false);
  });

  it('rejects any DATABASE_URL or SUPABASE_URL referencing nemo (case-insensitive)', () => {
    expect(() =>
      assertNotNemoTarget({
        DATABASE_URL: 'postgresql://postgres:pw@db.nemo.supabase.co:5432/postgres',
      }),
    ).toThrowError(NemoProtectionError);

    expect(() =>
      assertNotNemoTarget({
        SUPABASE_URL: 'https://my-NeMo-project.supabase.co',
      }),
    ).toThrowError(NemoProtectionError);

    expect(() =>
      assertNotNemoTarget({
        DATABASE_URL: 'postgresql://postgres:pw@db.wisemapping.supabase.co:6543/postgres',
        SUPABASE_URL: 'https://wisemapping.supabase.co',
      }),
    ).not.toThrow();
  });
});
