import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createE2eClient, detectE2eCapabilities } from './support/client';
import { createFakeHandlerDeps, FakeOAuthAdapter, FakeStore } from './support/fake-repo';
import { DEFAULT_ALLOWED_EMAIL, DEFAULT_OWNER_UUID, ROOT, mintJwt } from './support/fixtures';

const caps = detectE2eCapabilities();
const FRONTEND = path.join(ROOT, 'frontend');

function readFrontendText(relPath: string): string {
  return fs.readFileSync(path.join(FRONTEND, relPath), 'utf8');
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.yarn') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function parseSourceAst(relPath: string): ts.SourceFile {
  const full = path.join(FRONTEND, relPath);
  const content = fs.readFileSync(full, 'utf8');
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(full, content, ts.ScriptTarget.ES2022, true, kind);
}

function findJsxRouteElements(sourceFile: ts.SourceFile): Map<string, string> {
  const routeElements = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'Route') {
      let routePath: string | undefined;
      let elementText: string | undefined;
      for (const prop of node.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || !prop.initializer) continue;
        const name = prop.name.getText(sourceFile);
        if (name === 'path' && ts.isStringLiteral(prop.initializer)) {
          routePath = prop.initializer.text;
        } else if (name === 'element') {
          elementText = prop.initializer.getText(sourceFile);
        }
      }
      if (routePath && elementText) {
        routeElements.set(routePath, elementText);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return routeElements;
}

describe('F2/F3/F4 — Frontend Integration, Auth Entry Guards & R4 Conflict UX E2E', () => {
  describe('Tier 1 — F2: Official wisemapping-frontend Integration', () => {
    it('T1-F02-01: frontend monorepo workspace and all 4 packages exist', () => {
      const rootPkg = JSON.parse(readFrontendText('package.json')) as { workspaces?: string[] };
      expect(rootPkg.workspaces).toContain('packages/*');
      for (const pkgName of ['web2d', 'mindplot', 'editor', 'webapp']) {
        expect(fs.existsSync(path.join(FRONTEND, 'packages', pkgName, 'package.json'))).toBe(true);
      }
    });

    it('T1-F02-02: config.prod.json points to relative /api/restful/app/config without localhost', () => {
      const raw = readFrontendText('packages/webapp/config.prod.json');
      expect(raw).not.toContain('localhost:3000');
      expect(JSON.parse(raw)).toEqual({
        type: 'remote',
        url: '/api/restful/app/config',
      });
    });

    it('T1-F02-03: clean official baseline without nested .git, frontend/netlify.toml, or BaaS fork', () => {
      expect(fs.existsSync(path.join(FRONTEND, '.git'))).toBe(false);
      expect(fs.existsSync(path.join(FRONTEND, 'netlify.toml'))).toBe(false);

      const matches: string[] = [];
      for (const file of walkFiles(path.join(FRONTEND, 'packages/webapp/src'))) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        if (/clientType\s*[:=].*supabase/i.test(text)) {
          matches.push(path.relative(ROOT, file));
        }
      }
      expect(matches).toEqual([]);
    });

    it('T1-F02-04: webapp/.env is tracked and resolveBootstrapConfig supports remote + APP_CONFIG_JSON', async () => {
      const tracked = execFileSync('git', ['ls-files', 'frontend/packages/webapp/.env'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
      expect(tracked).toBe('frontend/packages/webapp/.env');

      const bsPath = path.join(FRONTEND, 'packages/webapp/src/utils/bootstrap-config-source.ts');
      const bsSpec = `/@fs/${bsPath.replace(/\\/g, '/')}`;
      const mod = (await import(bsSpec)) as {
        resolveBootstrapConfig: (opts: {
          env: Record<string, string | undefined>;
          production: boolean;
          readJson: (f: string) => unknown;
          warn: (m: string) => void;
        }) => unknown;
      };
      const resolved = mod.resolveBootstrapConfig({
        env: {
          APP_CONFIG_TYPE: 'remote',
          APP_CONFIG_JSON: '{"type":"remote","url":"/api/restful/app/config"}',
        },
        production: true,
        readJson: () => ({}),
        warn: () => undefined,
      });
      expect(resolved).toEqual({ type: 'remote', url: '/api/restful/app/config' });
    });

    it('T1-F02-05: zero nemo references exist anywhere under frontend/', () => {
      const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.json', '.md', '.html', '.css']);
      const hits: string[] = [];
      for (const file of walkFiles(FRONTEND)) {
        if (!textExts.has(path.extname(file).toLowerCase())) continue;
        if (/\bnemo\b/i.test(fs.readFileSync(file, 'utf8'))) {
          hits.push(path.relative(ROOT, file));
        }
      }
      expect(hits).toEqual([]);
    });
  });

  describe('Tier 2 — F2: Frontend Integration Boundary & Corner Cases', () => {
    it('T2-F02-01: AppConfig.usesMockClient triggers mock mode on empty apiBaseUrl', () => {
      const appConfigAst = parseSourceAst('packages/webapp/src/classes/app-config/index.ts');
      const text = appConfigAst.getText();
      expect(text).toContain("config.clientType !== 'rest'");
      expect(text).toContain('!config.apiBaseUrl');
    });

    it('T2-F02-02: root tsconfig.json and vitest.config.ts exclude frontend/ cleanly', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8')) as {
        exclude?: string[];
      };
      const vitestCfg = fs.readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf8');
      expect(tsconfig.exclude).toContain('frontend');
      expect(vitestCfg).toContain('frontend/**');
    });

    it('T2-F02-03: config.prod.json starts with /api/restful/ and never http://', () => {
      const prod = JSON.parse(readFrontendText('packages/webapp/config.prod.json')) as {
        type: string;
        url: string;
      };
      expect(prod.url.startsWith('/api/restful/')).toBe(true);
      expect(prod.url.startsWith('http://')).toBe(false);
    });

    it('T2-F02-04: webapp index.html uses valid Vite module entry with zero local filesystem paths', () => {
      const html = readFrontendText('packages/webapp/index.html');
      expect(html).toContain('<script type="module" src="/src/index.tsx"></script>');
      expect(html).not.toMatch(/[A-Za-z]:\\\\|\/Users\/|\/home\//);
    });

    it('T2-F02-05: frontend/.yarn has no large committed install-state.gz', () => {
      const trackedYarn = execFileSync('git', ['ls-files', 'frontend/.yarn'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
      expect(trackedYarn).not.toContain('install-state.gz');
    });
  });

  describe('Tier 1 — F3: Hide Non-Google Login Entry Points', () => {
    it.skipIf(!caps.canRunApiRuntime)(
      'T1-F03-01: /api/restful/app/config disables local login, registration, Facebook, and OIDC',
      async () => {
        const deps = createFakeHandlerDeps(new FakeStore(), new FakeOAuthAdapter());
        const client = await createE2eClient({ apiDeps: deps });
        const res = await client.get('/api/restful/app/config');
        expect(res.status).toBe(200);
        const cfg = await client.json<Record<string, unknown>>(res);
        expect(cfg.googleOauth2Enabled).toBe(true);
        expect(cfg.localLoginEnabled).toBe(false);
        expect(cfg.registrationEnabled).toBe(false);
        expect(cfg.facebookOauth2Enabled).toBe(false);
        expect(cfg.oidcOauth2Enabled).toBe(false);
      },
    );

    it.skipIf(!caps.canRunApiRuntime)(
      'T1-F03-02: GET /api/restful/account returns authenticationType "GOOGLE_OAUTH2" to hide password tab',
      async () => {
        const deps = createFakeHandlerDeps(new FakeStore(), new FakeOAuthAdapter());
        const jwt = await mintJwt({ email: DEFAULT_ALLOWED_EMAIL, uid: DEFAULT_OWNER_UUID });
        const client = (await createE2eClient({ apiDeps: deps })).withAuth(jwt);
        const res = await client.get('/api/restful/account');
        expect(res.status).toBe(200);
        const account = await client.json<{ authenticationType?: string }>(res);
        expect(account.authenticationType).toBe('GOOGLE_OAUTH2');
      },
    );

    it('T1-F03-03: registration routes are gated on AppConfig.isRegistrationEnabled() in app.tsx', () => {
      const ast = parseSourceAst('packages/webapp/src/app.tsx');
      const routes = findJsxRouteElements(ast);
      const localeReg = routes.get('/:locale/c/registration');
      expect(localeReg).toBeDefined();
      expect(localeReg).toContain('AppConfig.isRegistrationEnabled()');
      expect(localeReg).toContain('<Redirect to="/c/login" />');
      expect(ast.getText()).toContain('createRegistrationRoutes');
    });

    it('T1-F03-04: all 4 password-recovery routes redirect to /c/login when isLocalLoginEnabled() is false', () => {
      const ast = parseSourceAst('packages/webapp/src/app.tsx');
      const routes = findJsxRouteElements(ast);
      for (const routePath of [
        '/c/forgot-password',
        '/:locale/c/forgot-password',
        '/c/forgot-password-success',
        '/c/reset-password',
      ]) {
        const el = routes.get(routePath);
        expect(el, `route ${routePath}`).toBeDefined();
        expect(el).toContain('AppConfig.isLocalLoginEnabled()');
        expect(el).toContain('<Redirect to="/c/login" />');
      }
    });

    it('T1-F03-05: LoginPage gates local password form on localLoginEnabled and Sign-Up on isRegistrationEnabled()', () => {
      const loginSrc = parseSourceAst('packages/webapp/src/components/login-page/index.tsx').getText();
      expect(loginSrc).toContain('const localLoginEnabled = AppConfig.isLocalLoginEnabled()');
      expect(loginSrc).toContain('{localLoginEnabled && (');
      expect(loginSrc).toContain("headerType={AppConfig.isRegistrationEnabled() ? 'only-signup' : 'none'}");
      expect(loginSrc).toContain('AppConfig.isGoogleOauth2Enabled()');
    });
  });

  describe('Tier 2 — F3: Auth Entry Guard Boundary & Corner Cases', () => {
    it('T2-F03-01: direct /:locale/c/registration route falls back to <Redirect to="/c/login" />', () => {
      const routes = findJsxRouteElements(parseSourceAst('packages/webapp/src/app.tsx'));
      const expr = routes.get('/:locale/c/registration') ?? '';
      expect(expr).toMatch(/AppConfig\.isRegistrationEnabled\(\)\s*\?\s*<RegistationPage\s*\/>\s*:\s*<Redirect\s+to="\/c\/login"\s*\/>/);
    });

    it('T2-F03-02: /c/forgot-password and /:locale/c/forgot-password both fall back to /c/login', () => {
      const routes = findJsxRouteElements(parseSourceAst('packages/webapp/src/app.tsx'));
      for (const p of ['/c/forgot-password', '/:locale/c/forgot-password']) {
        expect(routes.get(p)).toMatch(
          /AppConfig\.isLocalLoginEnabled\(\)\s*\?\s*<ForgotPasswordPage\s*\/>\s*:\s*<Redirect\s+to="\/c\/login"\s*\/>/,
        );
      }
    });

    it('T2-F03-03: /c/forgot-password-success and /c/reset-password both fall back to /c/login', () => {
      const routes = findJsxRouteElements(parseSourceAst('packages/webapp/src/app.tsx'));
      expect(routes.get('/c/forgot-password-success')).toContain('<Redirect to="/c/login" />');
      expect(routes.get('/c/reset-password')).toContain('<Redirect to="/c/login" />');
    });

    it.skipIf(!caps.canRunApiRuntime)(
      'T2-F03-04: legacy registration, activation, and password-auth endpoints are rejected (403/404)',
      async () => {
        const deps = createFakeHandlerDeps(new FakeStore(), new FakeOAuthAdapter());
        const client = await createE2eClient({ apiDeps: deps });
        const checks = await Promise.all([
          client.post('/api/restful/users', { email: 'new@example.com', password: 'secret' }),
          client.put('/api/restful/users/activation', ''),
          client.put('/api/restful/users/resetPassword', {}),
          client.post('/api/restful/users/resetPasswordToken', { email: DEFAULT_ALLOWED_EMAIL }),
          client.post('/api/restful/authenticate', { email: DEFAULT_ALLOWED_EMAIL, password: 'x' }),
        ]);
        for (const res of checks) {
          expect([401, 403, 404, 405]).toContain(res.status);
          expect(res.headers.get('content-type') ?? '').toContain('application/json');
        }
      },
    );

    it('T2-F03-05: Editor Capability hides sign-up button in edition-owner and edition-editor modes', () => {
      const capAst = parseSourceAst('packages/editor/src/classes/action/capability/index.ts');
      const text = capAst.getText();
      const signUpMatch = /'sign-up'\s*:\s*\{[\s\S]*?hidden\s*:\s*\[([^\]]+)\]/m.exec(text);
      expect(signUpMatch?.[1]).toBeDefined();
      expect(signUpMatch?.[1]).toContain("'edition-owner'");
      expect(signUpMatch?.[1]).toContain("'edition-editor'");
    });
  });

  describe('Tier 1 — F4: Frontend Optimistic Locking UX (R4)', () => {
    it('T1-F04-01: RestClient.fetchMapMetadata extracts version from JSON or x-mindmap-version header', () => {
      const restClientSrc = parseSourceAst('packages/webapp/src/classes/client/rest-client/index.ts').getText();
      expect(restClientSrc).toContain("response.headers?.['x-mindmap-version']");
      expect(restClientSrc).toContain('data.version !== undefined');
      expect(restClientSrc).toContain('...(version !== undefined ? { version } : {})');
    });

    it('T1-F04-02: RESTPersistenceManager sends X-Mindmap-Version header and version JSON payload', () => {
      const pmSrc = parseSourceAst('packages/mindplot/src/components/RestPersistenceManager.ts').getText();
      expect(pmSrc).toContain("headers['X-Mindmap-Version'] = String(currentVersion)");
      expect(pmSrc).toContain('version: currentVersion');
      expect(pmSrc).toContain('this._versions.set(mapId, headerVersion)');
    });

    it('T1-F04-03: RESTPersistenceManager handles HTTP 409 by tracking _conflictedMaps and emitting conflict', () => {
      const pmSrc = parseSourceAst('packages/mindplot/src/components/RestPersistenceManager.ts').getText();
      expect(pmSrc).toContain('case 409:');
      expect(pmSrc).toContain('this._conflictedMaps.add(mapId)');
      expect(pmSrc).toContain("errorType: 'conflict'");
      expect(pmSrc).toContain("severity: 'WARNING'");
    });

    it('T1-F04-04: Editor.haltSaving() sets savingHalted = true and detaches autosave & beforeunload without flushing', () => {
      const editorAst = parseSourceAst('packages/editor/src/classes/model/editor/index.ts');
      const text = editorAst.getText();
      const haltMatch = /haltSaving\(\):\s*void\s*\{([^}]+)\}/.exec(text);
      expect(haltMatch?.[1]).toBeDefined();
      expect(haltMatch?.[1]).toContain('this.savingHalted = true');
      expect(haltMatch?.[1]).toContain('this.removeAutoSave()');
      expect(haltMatch?.[1]).toContain('this.removeBeforeUnloadHandler()');
      expect(haltMatch?.[1]).not.toContain('flushPendingChanges');
      expect(text).toContain("if (error.errorType === 'conflict') {\n        this.haltSaving();");
    });

    it('T1-F04-05: VersionConflictDialog is non-dismissible, reloads page, and all 13 locales define editor.conflict.*', () => {
      const dialogSrc = parseSourceAst(
        'packages/webapp/src/components/editor-page/version-conflict-dialog/index.tsx',
      ).getText();
      expect(dialogSrc).toContain('disableEscapeKeyDown');
      expect(dialogSrc).toContain('window.location.reload()');
      expect(dialogSrc).toContain('editor.conflict.title');

      const locales = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'pt', 'ru', 'uk', 'zh', 'zh-CN'];
      for (const locale of locales) {
        const lang = JSON.parse(readFrontendText(`packages/webapp/lang/${locale}.json`)) as Record<
          string,
          { defaultMessage?: string }
        >;
        const compiled = JSON.parse(
          readFrontendText(`packages/webapp/src/compiled-lang/${locale}.json`),
        ) as Record<string, Array<{ type: number; value: string }>>;
        for (const key of ['editor.conflict.title', 'editor.conflict.description', 'editor.conflict.refresh']) {
          expect(lang[key]?.defaultMessage?.trim().length, `${locale} lang ${key}`).toBeGreaterThan(0);
          expect(compiled[key]?.[0]?.value?.trim().length, `${locale} compiled ${key}`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Tier 2 — F4: R4 Optimistic Locking UX Boundary & Corner Cases', () => {
    it('T2-F04-01: RestClient falls back to x-mindmap-version header when JSON version is absent', () => {
      const restClientSrc = readFrontendText('packages/webapp/src/classes/client/rest-client/index.ts');
      expect(restClientSrc).toMatch(/data\.version\s*!==\s*undefined\s*\?\s*data\.version\s*:\s*Number\.isInteger\(parsedHeaderVersion\)/);
    });

    it('T2-F04-02: RESTPersistenceManager settles coalesced queued saves on 409 without double triggerError', () => {
      const pmSrc = readFrontendText('packages/mindplot/src/components/RestPersistenceManager.ts');
      expect(pmSrc).toContain('droppedEvents = queued.events');
      expect(pmSrc).toContain('this._pendingSaves.delete(mapId)');
      expect(pmSrc).toContain('this._handleError(error, [...events, ...droppedEvents])');
    });

    it('T2-F04-03: subsequent saveMapXml on conflicted map short-circuits client-side until loadMapDom', () => {
      const pmSrc = readFrontendText('packages/mindplot/src/components/RestPersistenceManager.ts');
      expect(pmSrc).toMatch(/if\s*\(this\._conflictedMaps\.has\(mapId\)\)\s*\{[\s\S]*?return;/);
      expect(pmSrc).toContain('this._conflictedMaps.delete(mapId)');
    });

    it('T2-F04-04: EditorPage wires error.errorType === "conflict" to VersionConflictDialog and query invalidation', () => {
      const editorPageSrc = readFrontendText('packages/webapp/src/components/editor-page/index.tsx');
      expect(editorPageSrc).toContain("error.errorType === 'conflict'");
      expect(editorPageSrc).toContain('setVersionConflict(true)');
      expect(editorPageSrc).toContain("queryClient.invalidateQueries({ queryKey: ['maps', 'metadata', mapId] })");
      expect(editorPageSrc).toContain('<VersionConflictDialog open={versionConflict} />');
    });

    it('T2-F04-05: German and Spanish editor.conflict.* and SAVE_CONFLICT messages use informal address', () => {
      const formalDe = /\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/;
      const formalEs = /\b(usted|ustedes|Ingrese|Introduzca|Seleccione|Haga|Inténtelo|Regístrese|Revise|Vuelva|Recargue)\b/;

      for (const key of ['editor.conflict.title', 'editor.conflict.description', 'editor.conflict.refresh']) {
        const deRaw = JSON.parse(readFrontendText('packages/webapp/lang/de.json')) as Record<string, { defaultMessage: string }>;
        const esRaw = JSON.parse(readFrontendText('packages/webapp/lang/es.json')) as Record<string, { defaultMessage: string }>;
        expect(formalDe.test(deRaw[key]?.defaultMessage ?? ''), `de ${key}`).toBe(false);
        expect(formalEs.test(esRaw[key]?.defaultMessage ?? ''), `es ${key}`).toBe(false);
      }

      const mindplotEs = readFrontendText('packages/mindplot/src/components/lang/es.ts');
      const saveConflictLine = /SAVE_CONFLICT:\s*['"`]([^'"`]+)['"`]/.exec(mindplotEs)?.[1] ?? '';
      expect(saveConflictLine.length).toBeGreaterThan(0);
      expect(formalEs.test(saveConflictLine)).toBe(false);
    });
  });

  describe('Tier 3 — Cross-Feature Frontend & Backend i18n Combination', () => {
    it.skipIf(!caps.canRunApiRuntime)(
      'T3-16: PUT /account/locale to "zh-CN" persists and matches Simplified Chinese conflict dialog AST',
      async () => {
        const deps = createFakeHandlerDeps(new FakeStore(), new FakeOAuthAdapter());
        const jwt = await mintJwt({ email: DEFAULT_ALLOWED_EMAIL, uid: DEFAULT_OWNER_UUID });
        const client = (await createE2eClient({ apiDeps: deps })).withAuth(jwt);

        const putRes = await client.put('/api/restful/account/locale', 'zh-CN', {
          headers: { 'content-type': 'text/plain' },
        });
        expect(putRes.status).toBe(204);

        const acctRes = await client.get('/api/restful/account');
        expect(acctRes.status).toBe(200);
        const acct = await client.json<{ authenticationType: string; locale: string }>(acctRes);
        expect(acct.authenticationType).toBe('GOOGLE_OAUTH2');
        expect(typeof acct.locale).toBe('string');

        const zhCnCompiled = JSON.parse(
          readFrontendText('packages/webapp/src/compiled-lang/zh-CN.json'),
        ) as Record<string, Array<{ type: number; value: string }>>;
        const title = zhCnCompiled['editor.conflict.title']?.[0]?.value ?? '';
        const refresh = zhCnCompiled['editor.conflict.refresh']?.[0]?.value ?? '';
        expect(title).toMatch(/[\u4e00-\u9fff]/);
        expect(refresh).toMatch(/[\u4e00-\u9fff]/);
      },
    );
  });
});
