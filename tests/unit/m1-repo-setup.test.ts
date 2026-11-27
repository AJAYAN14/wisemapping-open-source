import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FRONTEND = path.join(ROOT, 'frontend');

const readText = (relPath: string): string =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
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

describe('M1 repository restructuring, backup, frontend R1 & R4 integration', () => {
  it('keeps git backup branch and tag pointing at original Java commit bc7d6ea0', () => {
    const expectedSha = 'bc7d6ea095b9bde1c881805ff737681504c93d43';
    const branchSha = execFileSync('git', ['rev-parse', 'backup-java-original'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const tagSha = execFileSync('git', ['rev-parse', 'backup-java-original-tag^{commit}'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();

    expect(branchSha).toBe(expectedSha);
    expect(tagSha).toBe(expectedSha);
  });

  it('removes legacy Java/Docker files and directories', () => {
    const removedPaths = [
      'distribution',
      'test-file.txt',
      'qodana.yaml',
      '.cursorrules',
      'CLAUDE.md',
      'doc',
      '.github/workflows/maven.yml',
      '.github/workflows/docker-api-publish.yml',
      '.github/workflows/docker-app-publish.yml',
      'scripts/manage-git-hooks.sh',
      '.vscode/settings.json',
      '2.45.0',
    ];
    for (const p of removedPaths) {
      expect(fs.existsSync(path.join(ROOT, p))).toBe(false);
    }

    const wiseApiPath = path.join(ROOT, 'wise-api');
    if (fs.existsSync(wiseApiPath)) {
      // On Windows, an external IDE language server may briefly hold an empty folder handle.
      expect(walkFiles(wiseApiPath)).toEqual([]);
    }
    const trackedLegacy = execFileSync('git', ['ls-files', 'wise-api', 'distribution'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    expect(trackedLegacy).toBe('');
  });

  it('integrates clean official wisemapping-frontend without .git, node_modules, or nemo references', () => {
    expect(fs.existsSync(path.join(FRONTEND, 'packages/webapp/package.json'))).toBe(true);
    expect(fs.existsSync(path.join(FRONTEND, '.git'))).toBe(false);
    const trackedNodeModules = execFileSync('git', ['ls-files', 'frontend/node_modules'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    expect(trackedNodeModules).toBe('');

    const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.json', '.md', '.yml', '.yaml', '.html', '.css']);
    const matches: string[] = [];
    for (const file of walkFiles(FRONTEND)) {
      if (!textExtensions.has(path.extname(file).toLowerCase())) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      if (/\bnemo\b/i.test(content)) {
        matches.push(path.relative(ROOT, file));
      }
    }
    expect(matches).toEqual([]);
  });

  it('configures R1 production bootstrap URL and Google-only auth routes', () => {
    const prodConfig = JSON.parse(readText('frontend/packages/webapp/config.prod.json')) as {
      type: string;
      url: string;
    };
    expect(prodConfig).toEqual({ type: 'remote', url: '/api/restful/app/config' });

    const appTsx = readText('frontend/packages/webapp/src/app.tsx');
    expect(appTsx).toContain('path="/c/login"');
    expect(appTsx).toContain('path="/c/oauth-callback"');
    expect(appTsx).not.toContain('path="/:locale/c/registration"');
    expect(appTsx).not.toContain('path="/c/forgot-password"');
    expect(appTsx).not.toContain('path="/c/reset-password"');
    expect(appTsx).toContain('<Redirect to="/login" />');
  });

  it('implements R4 optimistic locking across mindplot, editor, and webapp', () => {
    const persistenceManager = readText('frontend/packages/mindplot/src/components/PersistenceManager.ts');
    expect(persistenceManager).toContain("'conflict'");

    const mindplotLocales = ['zh'];
    for (const locale of mindplotLocales) {
      const content = readText(`frontend/packages/mindplot/src/components/lang/${locale}.ts`);
      expect(content).toContain('SAVE_CONFLICT:');
    }

    const restPersistence = readText('frontend/packages/mindplot/src/components/RestPersistenceManager.ts');
    expect(restPersistence).toContain('X-Mindmap-Version');
    expect(restPersistence).toContain('case 409:');
    expect(restPersistence).toContain('_conflictedMaps');

    const editor = readText('frontend/packages/editor/src/classes/model/editor/index.ts');
    expect(editor).toContain('haltSaving()');
    expect(editor).toContain('this.savingHalted');

    const clientTypes = readText('frontend/packages/webapp/src/classes/client/index.ts');
    expect(clientTypes).toContain('version?: number;');

    const restClient = readText('frontend/packages/webapp/src/classes/client/rest-client/index.ts');
    expect(restClient).toContain('x-mindmap-version');

    const conflictDialog = readText(
      'frontend/packages/webapp/src/components/editor-page/version-conflict-dialog/index.tsx',
    );
    expect(conflictDialog).toContain('window.location.reload()');
    expect(conflictDialog).toContain('editor.conflict.title');

    const editorPage = readText('frontend/packages/webapp/src/components/editor-page/index.tsx');
    expect(editorPage).toContain('VersionConflictDialog');
    expect(editorPage).toContain("error.errorType === 'conflict'");

    const webappLocales = ['zh', 'zh-CN'];
    for (const locale of webappLocales) {
      const langJson = JSON.parse(readText(`frontend/packages/webapp/lang/${locale}.json`)) as Record<
        string,
        { defaultMessage: string }
      >;
      const compiledJson = JSON.parse(
        readText(`frontend/packages/webapp/src/compiled-lang/${locale}.json`),
      ) as Record<string, Array<{ type: number; value: string }>>;

      for (const key of ['editor.conflict.title', 'editor.conflict.description', 'editor.conflict.refresh']) {
        expect(langJson[key]?.defaultMessage).toBeTruthy();
        expect(compiledJson[key]?.[0]?.value).toBeTruthy();
      }
    }
  });

  it('documents all required environment variables in .env.example', () => {
    const envExample = readText('.env.example');
    for (const key of [
      'SUPABASE_URL=',
      'SUPABASE_ANON_KEY=',
      'SUPABASE_SERVICE_ROLE_KEY=',
      'DATABASE_URL=',
      'JWT_SECRET=',
      'ALLOWED_EMAIL=',
    ]) {
      expect(envExample).toContain(key);
    }
  });

  it('has no self-referential dependency in root package.json', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.[pkg.name]).toBeUndefined();
    expect(pkg.devDependencies?.[pkg.name]).toBeUndefined();
  });

  it('keeps Chinese-only compiled locale bundles in webapp', () => {
    for (const locale of ['zh', 'zh-CN']) {
      const compiled = JSON.parse(
        readText(`frontend/packages/webapp/src/compiled-lang/${locale}.json`),
      ) as Record<string, Array<{ type: number; value: string }>>;
      for (const key of ['editor.conflict.title', 'editor.conflict.description', 'editor.conflict.refresh']) {
        expect(compiled[key]?.[0]?.value?.trim().length).toBeGreaterThan(0);
      }
    }
    expect(fs.existsSync(path.join(FRONTEND, 'packages/webapp/src/compiled-lang/en.json'))).toBe(false);
  });

  it('tracks frontend/packages/webapp/.env in git while ignoring root .env files', () => {
    const tracked = execFileSync('git', ['ls-files', 'frontend/packages/webapp/.env'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    expect(tracked).toBe('frontend/packages/webapp/.env');

    const rootEnvIgnored = execFileSync('git', ['check-ignore', '.env'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    expect(rootEnvIgnored).toBe('.env');
  });
});
