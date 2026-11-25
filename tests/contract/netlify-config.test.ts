import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('netlify.toml configuration & redirect precedence', () => {
  it('configures Node 24 frontend build, esbuild functions with external pg, and correct redirect order', () => {
    const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

    expect(toml).toContain('publish = "frontend/packages/webapp/dist"');
    expect(toml).toContain('functions = "netlify/functions"');
    expect(toml).toContain('NODE_VERSION = "24"');
    expect(toml).toContain('APP_CONFIG_TYPE = "remote"');
    expect(toml).toContain('/api/restful/app/config');
    expect(toml).toContain('node_bundler = "esbuild"');
    expect(toml).toContain('"pg"');

    // Parse [[redirects]] blocks in order
    const blocks = toml.split('[[redirects]]').slice(1);
    const redirects = blocks.map((block) => {
      const from = /from\s*=\s*"([^"]+)"/.exec(block)?.[1];
      const to = /to\s*=\s*"([^"]+)"/.exec(block)?.[1];
      const status = Number.parseInt(/status\s*=\s*(\d+)/.exec(block)?.[1] ?? '0', 10);
      const force = /force\s*=\s*(true|false)/.exec(block)?.[1] === 'true';
      return { from, to, status, force };
    });

    expect(redirects).toEqual([
      {
        from: '/api/restful/oauth2/*',
        to: '/.netlify/functions/oauth/:splat',
        status: 200,
        force: true,
      },
      {
        from: '/api/restful/*',
        to: '/.netlify/functions/api/:splat',
        status: 200,
        force: true,
      },
      {
        from: '/oauth2/*',
        to: '/.netlify/functions/oauth/:splat',
        status: 200,
        force: true,
      },
      {
        from: '/login/oauth2/*',
        to: '/.netlify/functions/oauth/:splat',
        status: 200,
        force: true,
      },
      {
        from: '/*',
        to: '/index.html',
        status: 200,
        force: false,
      },
    ]);
  });
});
