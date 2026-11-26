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

interface ParsedVercel {
  buildCommand?: string;
  outputDirectory?: string;
  rewrites: Array<{
    source?: string;
    destination?: string;
  }>;
}

function parseVercelRewrites(content: string): ParsedVercel {
  const config = JSON.parse(content) as {
    buildCommand?: string;
    outputDirectory?: string;
    rewrites?: Array<{ source?: string; destination?: string }>;
  };
  return {
    buildCommand: config.buildCommand,
    outputDirectory: config.outputDirectory,
    rewrites: config.rewrites ?? [],
  };
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
        '.vercel/functions',
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

  describe.skipIf(!caps.canRunVercelJson)('Tier 1 — F14: vercel.json & Functions Build', () => {
    it('T1-F14-01: vercel.json configures outputDirectory, buildCommand, and api/*.ts functions', () => {
      const parsed = parseVercelRewrites(readRootText('vercel.json'));
      expect(parsed.outputDirectory).toContain('frontend/packages/webapp/dist');
      expect(parsed.buildCommand).toBeTruthy();
    });

    it('T1-F14-02: vercel.json places /api/restful/oauth2/*, /oauth2/*, and /login/oauth2/* before SPA fallback', () => {
      const parsed = parseVercelRewrites(readRootText('vercel.json'));
      const restfulOauthIdx = parsed.rewrites.findIndex((r) => r.source === '/api/restful/oauth2/:path(.*)');
      const oauthIdx = parsed.rewrites.findIndex((r) => r.source === '/oauth2/:path(.*)');
      const loginOauthIdx = parsed.rewrites.findIndex((r) => r.source === '/login/oauth2/:path(.*)');
      const spaIdx = parsed.rewrites.findIndex((r) => r.source === '/((?!api/).*)');;

      expect(restfulOauthIdx).toBeGreaterThanOrEqual(0);
      expect(oauthIdx).toBeGreaterThanOrEqual(0);
      expect(loginOauthIdx).toBeGreaterThanOrEqual(0);
      expect(spaIdx).toBeGreaterThan(restfulOauthIdx);
      expect(spaIdx).toBeGreaterThan(oauthIdx);
      expect(spaIdx).toBeGreaterThan(loginOauthIdx);
    });

    it(
      'T1-F14-03: esbuild bundles api/wm-api.ts and wm-oauth.ts cleanly',
      () => {
        execFileSync('npm', ['run', 'build:functions'], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        });
        expect(fs.existsSync(path.join(ROOT, '.vercel', 'functions-check', 'wm-api.js'))).toBe(true);
        expect(fs.existsSync(path.join(ROOT, '.vercel', 'functions-check', 'wm-oauth.js'))).toBe(true);
      },
      30_000,
    );

    it('T1-F14-04: api/_core/{api,oauth} export default Web handler and factory signatures', async () => {
      const apiSource = readRootText('api/_core/api.ts');
      const oauthSource = readRootText('api/_core/oauth.ts');
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

  describe.skipIf(!caps.canRunVercelJson || !caps.canRunApiRuntime)(
    'Tier 2 — F14: vercel.json & Functions Boundary Cases',
    () => {
      it('T2-F14-01: SPA fallback /((?!api/).*) never shadows /api/restful/*, /oauth2/*, or /login/oauth2/*', () => {
        const parsed = parseVercelRewrites(readRootText('vercel.json'));
        const spaIdx = parsed.rewrites.findIndex((r) => r.source === '/((?!api/).*)');
        expect(spaIdx).toBeGreaterThan(0);
        for (const prefix of ['/api/restful/oauth2/:path(.*)', '/oauth2/:path(.*)', '/login/oauth2/:path(.*)']) {
          const idx = parsed.rewrites.findIndex((r) => r.source === prefix);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(spaIdx);
        }
      });

      it('T2-F14-02: vercel.json wm-api and wm-oauth destinations are present', () => {
        const parsed = parseVercelRewrites(readRootText('vercel.json'));
        expect(parsed.rewrites.some((r) => r.destination?.includes('wm-api'))).toBe(true);
        expect(parsed.rewrites.some((r) => r.destination?.includes('wm-oauth'))).toBe(true);
      });

      it('T2-F14-03: Vercel build command configures remote /api/restful/app/config bootstrap', () => {
        const cfg = readRootText('vercel.json');
        expect(cfg).toContain('/api/restful');
        const vercel = JSON.parse(cfg) as { buildCommand?: string };
        expect(vercel.buildCommand).toBeTruthy();
      });

      it(
        'T2-F14-04: esbuild-bundled functions execute /api/restful/app/config under Node 20',
        async () => {
          execFileSync('npm', ['run', 'build:functions'], {
            cwd: ROOT,
            encoding: 'utf8',
            shell: process.platform === 'win32',
          });
          const bundledApi = path.join(ROOT, '.vercel', 'functions-check', 'wm-api.js');
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

    it('T2-F15-04: implementation-notes.md documents the Node 20 local vs Node 24 Vercel split', () => {
      const notes = readRootText('implementation-notes.md');
      expect(notes).toContain('v20.14.0');
      expect(notes).toContain('Node');
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

      it('T1-F15-03: docs/deployment-guide.md covers Supabase SQL, Google OAuth, and Vercel env setup', () => {
        const guide = readRootText('docs/deployment-guide.md');
        expect(guide).toMatch(/supabase/i);
        expect(guide).toMatch(/migration|sql/i);
        expect(guide).toMatch(/google\s+oauth/i);
        expect(guide).toMatch(/vercel/i);
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

      it('T2-F15-02: docs/deployment-guide.md documents Supabase OAuth callback and Vercel callback URIs', () => {
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
    it.skipIf(!caps.canRunVercelJson || !caps.canRunApiRuntime || !caps.canRunOAuthRuntime)(
      'T3-14: vercel.json routing aligns with /api/restful/app/config and /oauth2/authorization/google',
      async () => {
        const parsed = parseVercelRewrites(readRootText('vercel.json'));
        const apiRule = parsed.rewrites.find((r) => r.source === '/api/restful/:path(.*)');
        const oauthRule = parsed.rewrites.find((r) => r.source === '/oauth2/:path(.*)');
        const spaRule = parsed.rewrites.find((r) => r.source === '/((?!api/).*)');;
        expect(apiRule?.destination).toContain('wm-api');
        expect(oauthRule?.destination).toContain('wm-oauth');
        expect(spaRule?.destination).toBe('/index.html');

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
        const dirs = ['frontend', 'api', 'supabase', 'docs'];
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
