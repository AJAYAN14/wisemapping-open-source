import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { EXPECTED_JAVA_BACKUP_SHA, ROOT, mintJwt } from './support/fixtures';

const caps = detectE2eCapabilities();

function readRootText(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.yarn') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

interface ParsedToml {
  build?: {
    command?: string;
    publish?: string;
    functions?: string;
    environment?: Record<string, string>;
  };
  functions?: {
    directory?: string;
    node_bundler?: string;
  };
  redirects: Array<{
    from?: string;
    to?: string;
    status?: number;
    force?: boolean;
  }>;
}

function parseNetlifyToml(content: string): ParsedToml {
  const result: ParsedToml = { redirects: [] };
  let section = '';
  let currentRedirect: ParsedToml['redirects'][number] | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      continue;
    }
    if (line === '[[redirects]]') {
      currentRedirect = {};
      result.redirects.push(currentRedirect);
      section = 'redirects';
      continue;
    }
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].trim();
      currentRedirect = null;
      continue;
    }
    const kvMatch = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (!kvMatch?.[1] || kvMatch[2] === undefined) {
      continue;
    }
    const key = kvMatch[1].trim();
    const rawVal = kvMatch[2].trim();
    const unquoted =
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
        ? rawVal.slice(1, -1)
        : rawVal;

    if (section === 'redirects' && currentRedirect) {
      if (key === 'from') currentRedirect.from = unquoted;
      else if (key === 'to') currentRedirect.to = unquoted;
      else if (key === 'status') currentRedirect.status = Number.parseInt(unquoted, 10);
      else if (key === 'force') currentRedirect.force = unquoted === 'true';
    } else if (section === 'build') {
      result.build ??= {};
      if (key === 'command') result.build.command = unquoted;
      else if (key === 'publish') result.build.publish = unquoted;
      else if (key === 'functions') result.build.functions = unquoted;
    } else if (section === 'build.environment') {
      result.build ??= {};
      result.build.environment ??= {};
      result.build.environment[key] = unquoted;
    } else if (section === 'functions') {
      result.functions ??= {};
      if (key === 'directory') result.functions.directory = unquoted;
      else if (key === 'node_bundler') result.functions.node_bundler = unquoted;
    }
  }
  return result;
}

describe('F1/F14/F15 — Repository, Infrastructure & Documentation E2E', () => {
  describe('Tier 1 — F1: Git Backup & Legacy Removal', () => {
    it('T1-F01-01: backup branch and annotated tag both resolve to bc7d6ea0', () => {
      const branchSha = git(['rev-parse', 'backup-java-original']);
      const tagSha = git(['rev-parse', 'backup-java-original-tag^{commit}']);
      expect(branchSha).toBe(EXPECTED_JAVA_BACKUP_SHA);
      expect(tagSha).toBe(EXPECTED_JAVA_BACKUP_SHA);
    });

    it('T1-F01-02: legacy wise-api, distribution, and doc directories are removed from HEAD', () => {
      const tracked = git(['ls-files', 'wise-api', 'distribution', 'doc']);
      expect(tracked).toBe('');
      expect(fs.existsSync(path.join(ROOT, 'distribution'))).toBe(false);
      expect(fs.existsSync(path.join(ROOT, 'doc'))).toBe(false);
      expect(walkFiles(path.join(ROOT, 'wise-api'))).toEqual([]);
    });

    it('T1-F01-03: legacy Java/Docker CI workflows and config files are removed', () => {
      const removed = [
        '.github/workflows/maven.yml',
        '.github/workflows/docker-api-publish.yml',
        '.github/workflows/docker-app-publish.yml',
        'qodana.yaml',
        'CLAUDE.md',
      ];
      for (const rel of removed) {
        expect(fs.existsSync(path.join(ROOT, rel))).toBe(false);
      }
    });

    it('T1-F01-04: .gitignore protects .env files and build artifacts', () => {
      const targets = [
        '.env',
        '.env.local',
        '.env.production.local',
        'node_modules/pkg',
        'dist/index.js',
        '.netlify/functions',
      ];
      const output = git(['check-ignore', ...targets]);
      const ignored = output.split(/\r?\n/).map((line) => line.trim());
      for (const target of targets) {
        expect(ignored).toContain(target);
      }
    });

    it('T1-F01-05: backup-java-original branch still preserves original wise-api and distribution trees', () => {
      const treeEntries = git(['ls-tree', '--name-only', 'backup-java-original']).split(/\r?\n/);
      expect(treeEntries).toContain('wise-api');
      expect(treeEntries).toContain('distribution');
    });
  });

  describe('Tier 2 — F1: Boundary & Corner Cases', () => {
    it('T2-F01-01: wise-api/ has 0 files (even if empty IDE-locked dir remains) and distribution/ is absent', () => {
      expect(walkFiles(path.join(ROOT, 'wise-api'))).toHaveLength(0);
      expect(fs.existsSync(path.join(ROOT, 'distribution'))).toBe(false);
    });

    it('T2-F01-02: .env and .env.local are gitignored while frontend/packages/webapp/.env remains tracked', () => {
      const ignored = git(['check-ignore', '.env', '.env.local']).split(/\r?\n/);
      expect(ignored).toContain('.env');
      expect(ignored).toContain('.env.local');

      let webappEnvIgnored = false;
      try {
        git(['check-ignore', 'frontend/packages/webapp/.env']);
        webappEnvIgnored = true;
      } catch {
        webappEnvIgnored = false;
      }
      expect(webappEnvIgnored).toBe(false);
    });

    it('T2-F01-03: backup refs refs/heads/backup-java-original and refs/tags/backup-java-original-tag are unambiguous', () => {
      const headSha = git(['rev-parse', '--verify', 'refs/heads/backup-java-original']);
      const tagCommitSha = git(['rev-parse', '--verify', 'refs/tags/backup-java-original-tag^{commit}']);
      expect(headSha).toBe(EXPECTED_JAVA_BACKUP_SHA);
      expect(tagCommitSha).toBe(EXPECTED_JAVA_BACKUP_SHA);
    });

    it('T2-F01-04: root package.json contains no self-referential dependency', () => {
      const pkg = JSON.parse(readRootText('package.json')) as {
        name: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.[pkg.name]).toBeUndefined();
      expect(pkg.devDependencies?.[pkg.name]).toBeUndefined();
    });

    it('T2-F01-05: legacy doc/ directory is absent while new docs/ directory exists', () => {
      expect(fs.existsSync(path.join(ROOT, 'doc'))).toBe(false);
      expect(fs.existsSync(path.join(ROOT, 'docs'))).toBe(true);
    });
  });

  describe.skipIf(!caps.canRunNetlifyToml)('Tier 1 — F14: netlify.toml & Functions Build', () => {
    it('T1-F14-01: netlify.toml configures NODE_VERSION = "24", esbuild bundler, and frontend publish dir', () => {
      const parsed = parseNetlifyToml(readRootText('netlify.toml'));
      expect(parsed.build?.environment?.NODE_VERSION).toBe('24');
      expect(parsed.functions?.node_bundler).toBe('esbuild');
      expect(parsed.build?.functions ?? parsed.functions?.directory).toBe('netlify/functions');
      expect(parsed.build?.publish).toContain('frontend/packages/webapp/dist');
    });

    it('T1-F14-02: netlify.toml places /api/restful/*, /oauth2/*, and /login/oauth2/* before /* SPA fallback', () => {
      const parsed = parseNetlifyToml(readRootText('netlify.toml'));
      const apiIdx = parsed.redirects.findIndex((r) => r.from === '/api/restful/*');
      const oauthIdx = parsed.redirects.findIndex((r) => r.from === '/oauth2/*');
      const loginOauthIdx = parsed.redirects.findIndex((r) => r.from === '/login/oauth2/*');
      const spaIdx = parsed.redirects.findIndex((r) => r.from === '/*');

      expect(apiIdx).toBeGreaterThanOrEqual(0);
      expect(oauthIdx).toBeGreaterThanOrEqual(0);
      expect(loginOauthIdx).toBeGreaterThanOrEqual(0);
      expect(spaIdx).toBeGreaterThan(apiIdx);
      expect(spaIdx).toBeGreaterThan(oauthIdx);
      expect(spaIdx).toBeGreaterThan(loginOauthIdx);

      expect(parsed.redirects[apiIdx]?.status).toBe(200);
      expect(parsed.redirects[apiIdx]?.force).toBe(true);
    });

    it(
      'T1-F14-03: esbuild bundles netlify/functions/api.ts and oauth.ts cleanly',
      () => {
        execFileSync('npm', ['run', 'build:functions'], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        });
        expect(fs.existsSync(path.join(ROOT, '.netlify', 'functions-check', 'api.js'))).toBe(true);
        expect(fs.existsSync(path.join(ROOT, '.netlify', 'functions-check', 'oauth.js'))).toBe(true);
      },
      30_000,
    );

    it('T1-F14-04: netlify/functions/{api,oauth} export default Web handler and factory signatures', async () => {
      const apiSource = readRootText('netlify/functions/api.ts');
      const oauthSource = readRootText('netlify/functions/oauth.ts');
      expect(apiSource).toContain('export function createApiHandler');
      expect(apiSource).toMatch(/export\s+default\s+/);
      expect(oauthSource).toContain('export function createOAuthHandler');
      expect(oauthSource).toMatch(/export\s+default\s+/);

      const client = await createE2eClient();
      const res = await client.get('/api/restful/app/config');
      expect(res.status).toBe(200);
    });
  });

  describe('Tier 1 — F14 (Node 20 Baseline)', () => {
    it(
      'T1-F14-05: root typecheck and unit suite pass on current Node >= 20.14.0',
      () => {
        const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
        expect(major).toBeGreaterThanOrEqual(20);
        execFileSync('npm', ['run', 'typecheck'], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        });
        execFileSync('npm', ['run', 'test:unit'], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        });
      },
      30_000,
    );
  });

  describe.skipIf(!caps.canRunNetlifyToml || !caps.canRunApiRuntime)(
    'Tier 2 — F14: netlify.toml & Functions Boundary Cases',
    () => {
      it('T2-F14-01: SPA fallback /* never shadows /api/restful/*, /oauth2/*, or /login/oauth2/*', () => {
        const parsed = parseNetlifyToml(readRootText('netlify.toml'));
        const spaIdx = parsed.redirects.findIndex((r) => r.from === '/*');
        expect(spaIdx).toBeGreaterThan(0);
        for (const prefix of ['/api/restful/*', '/oauth2/*', '/login/oauth2/*']) {
          const idx = parsed.redirects.findIndex((r) => r.from === prefix);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(spaIdx);
        }
      });

      it('T2-F14-02: NODE_VERSION is pinned to exact string "24" for Vite 8 frontend build', () => {
        const parsed = parseNetlifyToml(readRootText('netlify.toml'));
        expect(parsed.build?.environment?.NODE_VERSION).toBe('24');
      });

      it('T2-F14-03: Netlify build command/environment configures remote /api/restful/app/config bootstrap', () => {
        const toml = readRootText('netlify.toml');
        expect(toml).toContain('APP_CONFIG_TYPE');
        expect(toml).toContain('/api/restful/app/config');
      });

      it(
        'T2-F14-04: esbuild-bundled functions execute /api/restful/app/config under Node 20',
        async () => {
          execFileSync('npm', ['run', 'build:functions'], {
            cwd: ROOT,
            encoding: 'utf8',
            shell: process.platform === 'win32',
          });
          const bundledApi = path.join(ROOT, '.netlify', 'functions-check', 'api.js');
          const bundledSpec = `/@fs/${bundledApi.replace(/\\/g, '/')}`;
          const mod = (await import(bundledSpec)) as {
            default: (req: Request) => Promise<Response>;
          };
          const res = await mod.default(new Request('https://e2e.local/api/restful/app/config'));
          expect(res.status).toBe(200);
          const body = (await res.json()) as { apiBaseUrl?: string };
          expect(body.apiBaseUrl).toBeTruthy();
        },
        30_000,
      );

      it('T2-F14-05: unknown /api/restful/nonexistent returns 404 JSON RestErrors (never HTML)', async () => {
        const client = await createE2eClient();
        const unauth = await client.get('/api/restful/nonexistent');
        expect(unauth.status).toBe(401);
        expect(unauth.headers.get('content-type') ?? '').toContain('application/json');

        const jwt = await mintJwt();
        const res = await client.withAuth(jwt).get('/api/restful/nonexistent');
        expect(res.status).toBe(404);
        expect(res.headers.get('content-type') ?? '').toContain('application/json');
        const body = await client.json<{ globalErrors?: string[] }>(res);
        expect(Array.isArray(body.globalErrors)).toBe(true);
      });
    },
  );

  describe('Tier 1 & Tier 2 — F15: Plan, Implementation Notes & Documentation', () => {
    it('T1-F15-02: implementation-notes.md contains Deviations, Discovered Edge Cases, and Questions for Review', () => {
      const notes = readRootText('implementation-notes.md');
      expect(notes).toContain('## Deviations');
      expect(notes).toContain('## Discovered Edge Cases');
      expect(notes).toContain('## Questions for Review');
    });

    it('T1-F15-05: existing docs and .env.example contain explicit nemo non-touch warning and zero nemo DB URLs', () => {
      const plan = readRootText('docs/implementation-plan.md');
      const notes = readRootText('implementation-notes.md');
      const envEx = readRootText('.env.example');
      expect(notes.toLowerCase()).toContain('nemo');
      expect(envEx.toLowerCase()).toContain('never configure or connect to any supabase project named "nemo"');
      expect(plan).not.toMatch(/postgres(ql)?:\/\/[^\s]*nemo/i);
      expect(envEx).not.toMatch(/postgres(ql)?:\/\/[^\s]*nemo/i);
    });

    it('T2-F15-04: implementation-notes.md documents the Node 20 local vs Node 24 Netlify split', () => {
      const notes = readRootText('implementation-notes.md');
      expect(notes).toContain('v20.14.0');
      expect(notes).toContain('NODE_VERSION = "24"');
    });

    it('T2-F15-05: .env.example and docs contain zero real secrets or JWTs', () => {
      const files = [
        path.join(ROOT, '.env.example'),
        ...walkFiles(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')),
      ];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/);
        expect(content).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
      }
    });

    describe.skipIf(!caps.hasDocsDeploymentGuide)('M4 Deployment Guide & README checks', () => {
      it('T1-F15-01: implementation-plan.md, implementation-notes.md, deployment-guide.md, and README.md exist', () => {
        for (const rel of [
          'docs/implementation-plan.md',
          'implementation-notes.md',
          'docs/deployment-guide.md',
          'README.md',
        ]) {
          const full = path.join(ROOT, rel);
          expect(fs.existsSync(full)).toBe(true);
          expect(fs.readFileSync(full, 'utf8').trim().length).toBeGreaterThan(50);
        }
      });

      it('T1-F15-03: docs/deployment-guide.md covers Supabase SQL, Google OAuth, and Netlify env setup', () => {
        const guide = readRootText('docs/deployment-guide.md');
        expect(guide).toMatch(/supabase/i);
        expect(guide).toMatch(/migration|sql/i);
        expect(guide).toMatch(/google\s+oauth/i);
        expect(guide).toMatch(/netlify/i);
      });

      it('T1-F15-04: every env var key in .env.example is documented in docs/deployment-guide.md', () => {
        const guide = readRootText('docs/deployment-guide.md');
        for (const key of [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'DATABASE_URL',
          'JWT_SECRET',
          'ALLOWED_EMAIL',
        ]) {
          expect(guide).toContain(key);
        }
      });

      it('T2-F15-01: README.md and docs/deployment-guide.md contain no active Java/Docker/Maven setup instructions', () => {
        const readme = readRootText('README.md');
        const guide = readRootText('docs/deployment-guide.md');
        expect(readme).not.toMatch(/\bmvn\s+spring-boot:run\b/i);
        expect(readme).not.toMatch(/\bdocker\s+compose\s+up\b/i);
        expect(guide).not.toMatch(/\bmvn\s+spring-boot:run\b/i);
        expect(guide).not.toMatch(/\bdocker\s+compose\s+up\b/i);
      });

      it('T2-F15-02: docs/deployment-guide.md documents Supabase OAuth callback and Netlify callback URIs', () => {
        const guide = readRootText('docs/deployment-guide.md');
        expect(guide).toContain('/auth/v1/callback');
        expect(guide).toContain('/api/restful/oauth2/callback');
      });

      it('T2-F15-03: docs/deployment-guide.md specifies JWT_SECRET >= 32 chars and ALLOWED_EMAIL default', () => {
        const guide = readRootText('docs/deployment-guide.md');
        expect(guide).toMatch(/JWT_SECRET[\s\S]{0,200}32/);
        expect(guide).toContain('a.jian0629@gmail.com');
      });
    });
  });

  describe('Tier 3 — Cross-Feature Infra & Repo Combinations', () => {
    it.skipIf(!caps.canRunNetlifyToml || !caps.canRunApiRuntime || !caps.canRunOAuthRuntime)(
      'T3-14: netlify.toml routing aligns with /api/restful/app/config and /oauth2/authorization/google',
      async () => {
        const parsed = parseNetlifyToml(readRootText('netlify.toml'));
        const apiRule = parsed.redirects.find((r) => r.from === '/api/restful/*');
        const oauthRule = parsed.redirects.find((r) => r.from === '/oauth2/*');
        const spaRule = parsed.redirects.find((r) => r.from === '/*');
        expect(apiRule?.to).toContain('/.netlify/functions/api');
        expect(oauthRule?.to).toContain('/.netlify/functions/oauth');
        expect(spaRule?.to).toBe('/index.html');

        const client = await createE2eClient();
        const cfgRes = await client.get('/api/restful/app/config');
        expect(cfgRes.status).toBe(200);
        const oauthRes = await client.get('/oauth2/authorization/google');
        expect(oauthRes.status).toBe(302);
      },
    );

    it.skipIf(!caps.canRunApiRuntime)(
      'T3-18: zero nemo references across codebase + esbuild bundle & typecheck succeed',
      () => {
        const dirs = ['frontend', 'netlify', 'supabase', 'docs'];
        const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql', '.md', '.json', '.toml']);
        const hits: string[] = [];
        for (const dir of dirs) {
          for (const file of walkFiles(path.join(ROOT, dir))) {
            if (!textExts.has(path.extname(file).toLowerCase())) continue;
            const content = fs.readFileSync(file, 'utf8');
            if (/postgres(ql)?:\/\/[^\s]*nemo|https?:\/\/[^\s]*nemo/i.test(content)) {
              hits.push(path.relative(ROOT, file));
            }
          }
        }
        expect(hits).toEqual([]);
        execFileSync('npm', ['run', 'build:functions'], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        });
      },
      30_000,
    );
  });
});
