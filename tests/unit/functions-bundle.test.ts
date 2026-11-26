import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('functions esbuild ESM bundle & Node 20 import check', () => {
  it('bundles api.ts and oauth.ts cleanly and imports both in Node ESM without runtime errors', async () => {
    const outdir = path.join(ROOT, '.vercel/functions-check');
    const result = await esbuild.build({
      entryPoints: [
        path.join(ROOT, 'api/wm-api.ts'),
        path.join(ROOT, 'api/wm-oauth.ts'),
      ],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      external: ['pg', 'pg-native'],
      outdir,
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);

    const apiBundlePath = path.join(outdir, 'wm-api.js');
    const oauthBundlePath = path.join(outdir, 'wm-oauth.js');
    expect(fs.existsSync(apiBundlePath)).toBe(true);
    expect(fs.existsSync(oauthBundlePath)).toBe(true);

    const apiMod = (await import(pathToFileURL(apiBundlePath).href)) as Record<string, unknown>;
    const oauthMod = (await import(pathToFileURL(oauthBundlePath).href)) as Record<string, unknown>;

    // wm-api and wm-oauth export Vercel's { fetch(request) } object as default.
    // The core factory functions live in api/_core/api.ts and api/_core/oauth.ts (separately typed).
    expect(typeof apiMod['default']).toBe('object');
    expect(apiMod['default']).not.toBeNull();
    expect(typeof (apiMod['default'] as Record<string, unknown>)['fetch']).toBe('function');
    expect(typeof oauthMod['default']).toBe('object');
    expect(oauthMod['default']).not.toBeNull();
    expect(typeof (oauthMod['default'] as Record<string, unknown>)['fetch']).toBe('function');
  });
});
