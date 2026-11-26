import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

interface VercelRewrite {
  source?: string;
  destination?: string;
}

interface VercelJson {
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: VercelRewrite[];
}

describe('vercel.json configuration & rewrite precedence', () => {
  it('has buildCommand, outputDirectory, and correct rewrite order routing API and OAuth paths', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    const config = JSON.parse(raw) as VercelJson;

    expect(config.buildCommand).toBeTruthy();
    expect(config.outputDirectory).toBe('frontend/packages/webapp/dist');

    const rewrites = config.rewrites ?? [];

    // All four API/OAuth rewrites must be present
    const restfulOauthRule = rewrites.find((r) => r.source === '/api/restful/oauth2/:path(.*)');
    const restfulApiRule = rewrites.find((r) => r.source === '/api/restful/:path(.*)');
    const oauth2Rule = rewrites.find((r) => r.source === '/oauth2/:path(.*)');
    const loginOauth2Rule = rewrites.find((r) => r.source === '/login/oauth2/:path(.*)');
    const spaRule = rewrites.find((r) => r.source === '/((?!api/).*)');;

    expect(restfulOauthRule?.destination).toContain('wm-oauth');
    expect(restfulApiRule?.destination).toContain('wm-api');
    expect(oauth2Rule?.destination).toContain('wm-oauth');
    expect(loginOauth2Rule?.destination).toContain('wm-oauth');
    expect(spaRule?.destination).toBe('/index.html');

    // OAuth must come before API (more-specific before less-specific)
    const restfulOauthIdx = rewrites.indexOf(restfulOauthRule!);
    const restfulApiIdx = rewrites.indexOf(restfulApiRule!);
    expect(restfulOauthIdx).toBeLessThan(restfulApiIdx);

    // SPA fallback must be last
    const spaIdx = rewrites.indexOf(spaRule!);
    expect(spaIdx).toBe(rewrites.length - 1);
  });
});
