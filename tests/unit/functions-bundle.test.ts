import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('functions esbuild ESM bundle & Node 20 import check', () => {
  it('bundles api.ts and oauth.ts cleanly and imports both in Node ESM without runtime errors', async () => {
    const outdir = path.join(ROOT, '.netlify/functions-check');
    const result = await esbuild.build({
      entryPoints: [
        path.join(ROOT, 'netlify/functions/api.ts'),
        path.join(ROOT, 'netlify/functions/oauth.ts'),
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

    const apiBundlePath = path.join(outdir, 'api.js');
    const oauthBundlePath = path.join(outdir, 'oauth.js');
    expect(fs.existsSync(apiBundlePath)).toBe(true);
    expect(fs.existsSync(oauthBundlePath)).toBe(true);

    const apiMod = (await import(pathToFileURL(apiBundlePath).href)) as Record<string, unknown>;
    const oauthMod = (await import(pathToFileURL(oauthBundlePath).href)) as Record<string, unknown>;

    expect(typeof apiMod['default']).toBe('function');
    expect(typeof apiMod['createApiHandler']).toBe('function');
    expect(typeof oauthMod['default']).toBe('function');
    expect(typeof oauthMod['createOAuthHandler']).toBe('function');
  });
});
