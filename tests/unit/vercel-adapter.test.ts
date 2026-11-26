import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { restoreRewrittenRequest } from '../../api/_shared.js';
import wmApi from '../../api/wm-api.js';
import wmOauth from '../../api/wm-oauth.js';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('Vercel deployment configuration and adapters', () => {
  it('configures vercel.json rewrites in correct precedence order', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
    };

    expect(config.outputDirectory).toBe('frontend/packages/webapp/dist');

    const sources = config.rewrites.map((r) => r.source);
    const oauthRestIdx = sources.indexOf('/api/restful/oauth2/:path(.*)');
    const restApiIdx = sources.indexOf('/api/restful/:path(.*)');
    const spaIdx = sources.indexOf('/((?!api/).*)');

    expect(oauthRestIdx).toBeGreaterThanOrEqual(0);
    expect(restApiIdx).toBeGreaterThan(oauthRestIdx);
    expect(spaIdx).toBeGreaterThan(restApiIdx);
  });

  it('routes trailing-slash REST paths through api/wm-api rather than 404', async () => {
    for (const trailingPath of ['/api/restful/maps/', '/api/restful/labels/']) {
      const req = new Request(
        `https://wisemapping.vercel.app/api/wm-api?__wm_path=${trailingPath}`,
      );
      const restored = restoreRewrittenRequest(req);
      expect(new URL(restored.url).pathname).toBe(trailingPath);

      const res = await wmApi.fetch(req);
      expect(res.status).toBe(401);
    }
  });

  it('restores rewritten GET path and query parameters cleanly', () => {
    const req = new Request(
      'https://wisemapping.vercel.app/api/wm-api?__wm_path=/api/restful/maps/42/metadata&xml=true',
    );
    const restored = restoreRewrittenRequest(req);
    const parsed = new URL(restored.url);

    expect(parsed.pathname).toBe('/api/restful/maps/42/metadata');
    expect(parsed.searchParams.get('xml')).toBe('true');
    expect(parsed.searchParams.has('__wm_path')).toBe(false);
  });

  it('preserves PUT body and custom headers when restoring rewritten request', async () => {
    const xml = '<map version="tango"><topic central="true" text="Test"/></map>';
    const req = new Request(
      'https://wisemapping.vercel.app/api/wm-api?__wm_path=/api/restful/maps/7/document/xml',
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/xml',
          'x-mindmap-version': '5',
        },
        body: xml,
      },
    );

    const restored = restoreRewrittenRequest(req);
    expect(restored.method).toBe('PUT');
    expect(new URL(restored.url).pathname).toBe('/api/restful/maps/7/document/xml');
    expect(restored.headers.get('x-mindmap-version')).toBe('5');
    expect(await restored.text()).toBe(xml);
  });

  it('serves /api/restful/app/config through api/wm-api adapter', async () => {
    const req = new Request(
      'https://wisemapping.vercel.app/api/wm-api?__wm_path=/api/restful/app/config',
    );
    const res = await wmApi.fetch(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apiBaseUrl?: string;
      googleOauth2Enabled?: boolean;
      googleOauth2Url?: string;
    };
    expect(body.googleOauth2Enabled).toBe(true);
    expect(body.apiBaseUrl).toBe('https://wisemapping.vercel.app');
    expect(body.googleOauth2Url).toBe('https://wisemapping.vercel.app/oauth2/authorization/google');
  });

  it('handles OPTIONS preflight through api/wm-oauth adapter', async () => {
    const req = new Request(
      'https://wisemapping.vercel.app/api/wm-oauth?__wm_path=/oauth2/authorization/google',
      { method: 'OPTIONS' },
    );
    const res = await wmOauth.fetch(req);
    expect(res.status).toBe(204);
  });
});
