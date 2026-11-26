import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CookieJar, detectE2eCapabilities, requireRuntimeGate } from './support/client';
import { FakeOAuthAdapter, FakePgError, FakeStore } from './support/fake-repo';
import {
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  LABEL_TITLE_MAX_LENGTH,
  NemoProtectionError,
  ROOT,
  SECONDARY_USER_UUID,
  SEVEN_DAYS_SECONDS,
  XML_FIXTURES,
  assertNotNemoTarget,
  createDefaultMapXml,
  createRunId,
  generateLargeMapXml,
  mintExpiredJwt,
  mintJwt,
  mintJwtWithoutSub,
  tamperJwtSignature,
  uniqueLabelTitle,
  uniqueTitle,
  verifyAndDecodeJwt,
} from './support/fixtures';

const E2E_DIR = path.join(ROOT, 'tests', 'e2e');

const EXPECTED_SPEC_FILES = [
  'repo-and-infra.test.ts',
  'frontend-integration.test.ts',
  'database-rls.test.ts',
  'auth-and-config.test.ts',
  'account.test.ts',
  'mindmap-crud.test.ts',
  'history-and-labels.test.ts',
  'optimistic-locking.test.ts',
  'e2e-track-meta.test.ts',
  'real-world-workloads.test.ts',
] as const;

describe('F16 — E2E Track Meta-Verification & Harness Self-Tests', () => {
  describe('Tier 1 — F16: Suite Structure, Opaque-Box Compliance & Harness Integrity', () => {
    it('T1-F16-01: all 10 E2E *.test.ts suites and 3 support modules exist', () => {
      for (const file of EXPECTED_SPEC_FILES) {
        expect(fs.existsSync(path.join(E2E_DIR, file)), file).toBe(true);
      }
      for (const support of ['client.ts', 'fake-repo.ts', 'fixtures.ts']) {
        expect(fs.existsSync(path.join(E2E_DIR, 'support', support)), support).toBe(true);
      }
    });

    it('T1-F16-02: 4-tier test matrix meets or exceeds minimum thresholds (T1>=80, T2>=80, T3>=16, T4>=8)', () => {
      const counts = { t1: 0, t2: 0, t3: 0, t4: 0 };
      for (const file of EXPECTED_SPEC_FILES) {
        const src = fs.readFileSync(path.join(E2E_DIR, file), 'utf8');
        counts.t1 += (src.match(/T1-F\d{2}-\d{2}:/g) ?? []).length;
        counts.t2 += (src.match(/T2-F\d{2}-\d{2}:/g) ?? []).length;
        counts.t3 += (src.match(/T3-(?:\d{2}|Account-01):/g) ?? []).length;
        counts.t4 += (src.match(/T4-\d{2}:/g) ?? []).length;
      }
      expect(counts.t1).toBeGreaterThanOrEqual(80);
      expect(counts.t2).toBeGreaterThanOrEqual(80);
      expect(counts.t3).toBeGreaterThanOrEqual(16);
      expect(counts.t4).toBeGreaterThanOrEqual(8);
      expect(counts.t1 + counts.t2 + counts.t3 + counts.t4).toBeGreaterThanOrEqual(184);
    });

    it('T1-F16-03: strict opaque-box boundary — zero imports from api/_core/lib/* or frontend/node_modules', () => {
      const allTsFiles = [
        ...EXPECTED_SPEC_FILES.map((f) => path.join(E2E_DIR, f)),
        ...['client.ts', 'fake-repo.ts', 'fixtures.ts'].map((f) =>
          path.join(E2E_DIR, 'support', f),
        ),
      ];
      for (const file of allTsFiles) {
        const src = fs.readFileSync(file, 'utf8');
        expect(src, `${path.basename(file)} imports internal lib`).not.toMatch(
          /from\s+['"][^'"]*api\/_core\/lib/,
        );
        expect(src, `${path.basename(file)} imports frontend/node_modules`).not.toMatch(
          /from\s+['"][^'"]*frontend\/node_modules/,
        );
      }
    });

    it('T1-F16-04: FakeStore enforces PG-faithful CAS version, unique titles, permanent history, and cascades', () => {
      const store = new FakeStore();
      const map = store.createMindmap({
        ownerId: DEFAULT_OWNER_UUID,
        ownerEmail: DEFAULT_ALLOWED_EMAIL,
        title: 'StoreCheck',
      });
      expect(map.version).toBe(1);

      expect(() =>
        store.createMindmap({
          ownerId: DEFAULT_OWNER_UUID,
          ownerEmail: DEFAULT_ALLOWED_EMAIL,
          title: 'StoreCheck',
        }),
      ).toThrow(FakePgError);

      // 6 non-minor saves -> all 6 permanent history rows retained
      for (let v = 1; v <= 6; v++) {
        const res = store.updateMindmapDocument({
          ownerId: DEFAULT_OWNER_UUID,
          ownerEmail: DEFAULT_ALLOWED_EMAIL,
          id: map.id,
          xml: createDefaultMapXml(`Edit-${v}`),
          expectedVersion: v,
          minor: false,
        });
        expect(res.status).toBe('ok');
      }
      expect(store.listHistory(DEFAULT_OWNER_UUID, map.id)).toHaveLength(6);

      // Stale CAS check returns conflict with currentVersion: 7
      const conflict = store.updateMindmapDocument({
        ownerId: DEFAULT_OWNER_UUID,
        ownerEmail: DEFAULT_ALLOWED_EMAIL,
        id: map.id,
        xml: createDefaultMapXml('Stale'),
        expectedVersion: 2,
      });
      expect(conflict).toEqual({ status: 'conflict', currentVersion: 7 });

      // Cross-owner isolation
      expect(store.getMindmap(SECONDARY_USER_UUID, map.id)).toBeUndefined();

      // Transactional batch delete aborts when any ID is missing
      expect(store.batchDeleteMindmaps(DEFAULT_OWNER_UUID, [map.id, 999999])).toBe(false);
      expect(store.getMindmap(DEFAULT_OWNER_UUID, map.id)).toBeDefined();

      // Cascade delete cleans mindmapHistory and mindmapLabels
      const lbl = store.createLabel({
        ownerId: DEFAULT_OWNER_UUID,
        title: 'CascadeLbl',
        color: '#000000',
      });
      store.assignLabelToMap(DEFAULT_OWNER_UUID, map.id, lbl.id);
      expect(store.countMindmapLabelRows()).toBe(1);
      expect(store.deleteMindmap(DEFAULT_OWNER_UUID, map.id)).toBe(true);
      expect(store.countHistoryRows()).toBe(0);
      expect(store.countMindmapLabelRows()).toBe(0);
    });

    it('T1-F16-05: fixtures generate exact O(N) large XMLs, 7d HS256 JWTs, expired/no-sub/tampered tokens, and XSS strings', async () => {
      const xml3999 = generateLargeMapXml(3999, 'PerfTest');
      expect(xml3999.split('<topic').length - 1).toBe(3999);
      expect(XML_FIXTURES.xssScript).toContain('<script>');
      expect(XML_FIXTURES.malformedUnclosed).not.toContain('</map>');

      const jwt = await mintJwt();
      const verified = await verifyAndDecodeJwt(jwt);
      expect(verified.payload.sub).toBe(DEFAULT_ALLOWED_EMAIL);
      expect(verified.lifetimeSeconds).toBe(SEVEN_DAYS_SECONDS);

      const expired = await mintExpiredJwt();
      await expect(verifyAndDecodeJwt(expired)).rejects.toThrow();

      const noSub = await mintJwtWithoutSub();
      const decodedNoSub = await verifyAndDecodeJwt(noSub);
      expect(decodedNoSub.payload.sub).toBeUndefined();

      const tampered = tamperJwtSignature(jwt);
      await expect(verifyAndDecodeJwt(tampered)).rejects.toThrow();
    });
  });

  describe('Tier 2 — F16: Guardrails, Capability Detection & Harness Corner Cases', () => {
    it('T2-F16-01: assertNotNemoTarget fails closed on nemo targets and requireRuntimeGate enforces strict M5 gate', () => {
      expect(() =>
        assertNotNemoTarget({
          E2E_BASE_URL: 'https://nemo-app.netlify.app',
        }),
      ).toThrow(NemoProtectionError);

      const prevGate = process.env.E2E_REQUIRE_RUNTIME;
      try {
        process.env.E2E_REQUIRE_RUNTIME = '1';
        const caps = detectE2eCapabilities();
        if (!caps.canRunApiRuntime || !caps.canRunOAuthRuntime) {
          expect(() => requireRuntimeGate(caps)).toThrow(/E2E_REQUIRE_RUNTIME=1/);
        } else {
          expect(() => requireRuntimeGate(caps)).not.toThrow();
        }
      } finally {
        if (prevGate === undefined) delete process.env.E2E_REQUIRE_RUNTIME;
        else process.env.E2E_REQUIRE_RUNTIME = prevGate;
      }
    });

    it('T2-F16-02: detectE2eCapabilities handles absent .env.local cleanly without crashing', () => {
      const caps = detectE2eCapabilities();
      expect(['http', 'handler', 'unavailable']).toContain(caps.mode);
      if (!caps.hasEnvLocal && !process.env.DATABASE_URL) {
        expect(caps.canRunLiveDb).toBe(false);
      }
    });

    it('T2-F16-03: vitest.config.ts includes tests/**/*.test.ts and excludes frontend/**', () => {
      const cfg = fs.readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf8');
      expect(cfg).toContain("'tests/**/*.test.ts'");
      expect(cfg).toContain("'frontend/**'");
    });

    it('T2-F16-04: unique generators and FakeStore.reset() isolate sequential test state without collisions', () => {
      const runId = createRunId();
      const seenTitles = new Set<string>();
      const seenLabels = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const t = uniqueTitle('SharedName', runId);
        const l = uniqueLabelTitle('VeryLongLabelPrefixThatMustBeTruncated');
        expect(t.length).toBeLessThanOrEqual(80);
        expect(l.length).toBeLessThanOrEqual(LABEL_TITLE_MAX_LENGTH);
        seenTitles.add(t);
        seenLabels.add(l);
      }
      expect(seenTitles.size).toBe(50);
      expect(seenLabels.size).toBe(50);

      const store = new FakeStore();
      store.createMindmap({
        ownerId: DEFAULT_OWNER_UUID,
        ownerEmail: DEFAULT_ALLOWED_EMAIL,
        title: 'SharedName',
      });
      store.reset();
      expect(() =>
        store.createMindmap({
          ownerId: DEFAULT_OWNER_UUID,
          ownerEmail: DEFAULT_ALLOWED_EMAIL,
          title: 'SharedName',
        }),
      ).not.toThrow();
    });

    it('T2-F16-05: CookieJar and FakeOAuthAdapter handle PKCE cookies, expiry (Max-Age=0), and case-insensitive headers', () => {
      const jar = new CookieJar();
      const setHeaders = new Headers();
      setHeaders.append('Set-Cookie', 'sb-pkce=abc123; Path=/; HttpOnly');
      jar.extractSetCookies(new Response(null, { headers: setHeaders }));
      expect(jar.get('sb-pkce')?.value).toBe('abc123');

      const outHeaders = new Headers();
      jar.applyCookies(outHeaders);
      expect(outHeaders.get('cookie')).toBe('sb-pkce=abc123');

      const clearHeaders = new Headers();
      clearHeaders.append('set-cookie', 'sb-pkce=; Max-Age=0; Path=/');
      jar.extractSetCookies(new Response(null, { headers: clearHeaders }));
      expect(jar.get('sb-pkce')).toBeUndefined();

      const oauth = new FakeOAuthAdapter();
      const pkce = oauth.issuePkceSession('https://e2e.local/api/restful/oauth2/callback', '/c/maps/');
      expect(oauth.exchangeCode('valid_owner_code', pkce.cookieValue).ok).toBe(true);
      expect(oauth.exchangeCode('valid_owner_code', 'wrong-verifier').ok).toBe(false);
    });
  });
});
