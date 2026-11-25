export const DEFAULT_ALLOWED_EMAIL = 'a.jian0629@gmail.com';

export interface EnvRecord {
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  JWT_SECRET?: string;
  ALLOWED_EMAIL?: string;
  DATABASE_SSL_REJECT_UNAUTHORIZED?: string;
  URL?: string;
  DEPLOY_PRIME_URL?: string;
  APP_ORIGIN?: string;
}

export class NemoProtectionError extends Error {
  constructor(varName: 'DATABASE_URL' | 'SUPABASE_URL') {
    super(`Nemo protection triggered: ${varName} references forbidden target "nemo".`);
    this.name = 'NemoProtectionError';
  }
}

export function assertNotNemoTarget(env: Pick<EnvRecord, 'DATABASE_URL' | 'SUPABASE_URL'> = process.env): void {
  if (env.DATABASE_URL && /nemo/i.test(env.DATABASE_URL)) {
    throw new NemoProtectionError('DATABASE_URL');
  }
  if (env.SUPABASE_URL && /nemo/i.test(env.SUPABASE_URL)) {
    throw new NemoProtectionError('SUPABASE_URL');
  }
}

export function getAllowedEmail(env: Pick<EnvRecord, 'ALLOWED_EMAIL'> = process.env): string {
  const configured = env.ALLOWED_EMAIL?.trim();
  return (configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_EMAIL).toLowerCase();
}

export function getJwtSecretBytes(env: Pick<EnvRecord, 'JWT_SECRET'> = process.env): Uint8Array {
  const secret = env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET environment variable must be configured (>= 32 characters).');
  }
  return new TextEncoder().encode(secret);
}

export function getSupabaseClientConfig(
  env: Pick<EnvRecord, 'DATABASE_URL' | 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'> = process.env,
): { supabaseUrl: string; supabaseAnonKey: string } {
  assertNotNemoTarget(env);
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const supabaseAnonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required.');
  }
  if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required.');
  }
  return { supabaseUrl, supabaseAnonKey };
}

export function getDatabaseSslRejectUnauthorized(
  env: Pick<EnvRecord, 'DATABASE_SSL_REJECT_UNAUTHORIZED'> = process.env,
): boolean {
  return env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() === 'true';
}
