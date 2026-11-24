# Implementation Plan — WiseMapping Personal Private Edition

**Summary**: Transform `wisemapping-open-source` into a single-owner (`a.jian0629@gmail.com`) private mind-mapping app built from official `wisemapping/wisemapping-frontend` (`main` @ `fb15a53`) on Netlify (static SPA + TypeScript Netlify Functions `/api/restful/*` adapter) and Supabase (PostgreSQL + Google OAuth). The approach preserves the official frontend's `/api/restful/*` wire contract while backing it with a 4-table RLS-protected Supabase schema, `@supabase/ssr` PKCE Google OAuth, 7-day JWTs, and atomic `version`-based optimistic locking.

---

## Blindspot Pass (Landmines & Hidden Context)

1. **Local Node `v20.14.0` vs Official Frontend Node `24` (Vite 8)**: Local environment has `node v20.14.0` (`npm 10.7.0`). Official `wisemapping-frontend` (`vite@8.3.2`) requires `NODE_VERSION = "24"`. Placing `wisemapping-frontend` in `frontend/` and keeping root `netlify/functions/` + Vitest tests Node-20-compatible allows running all backend/API/DB tests locally while `netlify.toml` builds `frontend/` on Node 24.
2. **Clean Official `fb15a53` Frontend Baseline**: Upstream `wisemapping/wisemapping-frontend` (`main` @ `fb15a53`) is integrated cleanly into `frontend/` without any BaaS fork commits or `nemo` references.
3. **`config.prod.json` & `apiBaseUrl` Traps**: Official `config.prod.json` hardcoded `http://localhost:3000/api/restful/app/config`. Worse, if `/api/restful/app/config` returns `apiBaseUrl: ""`, `AppConfig.usesMockClient()` silently switches the app into `MockClient` mode. `config.prod.json` is patched to `/api/restful/app/config`, Netlify builds configure `APP_CONFIG_TYPE=remote` + `APP_CONFIG_JSON='{"type":"remote","url":"/api/restful/app/config"}'`, and `/api/restful/app/config` dynamically returns the non-empty site origin.
4. **Supabase `service_role` vs Asymmetric JWTs vs True RLS**: Modern Supabase projects often sign 1-hour tokens with asymmetric keys, whereas `wisemapping-frontend` requires a 7-day JWT (`sub === email`) and `supabase-js` with `service_role` bypasses RLS completely. Using `@supabase/ssr` cookies for Google OAuth PKCE, issuing a 7-day HS256 JWT (`JWT_SECRET`), and running queries via `pg` inside `BEGIN ... COMMIT` with `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` provides both 7-day sessions and true PostgreSQL RLS enforcement.
5. **Hidden Direct Auth Routes & Autosave Error Swallowing**: Returning `localLoginEnabled: false` and `registrationEnabled: false` hides the password form, sign-up button, and forgot-password link on `/c/login`, but `/c/forgot-password`, `/:locale/c/registration`, and related recovery routes remain directly reachable in `app.tsx` unless guarded. Similarly, `RestPersistenceManager` and `Editor` must surface `409 Conflict` on both manual save and 15s background autosave and halt further saves until the user refreshes.

---

## Section 1 — Architecture & Core Decisions

### 1. Frontend Source Baseline (`main` `fb15a53`)
- Clean official `wisemapping/wisemapping-frontend` (`main` @ `fb15a53`) extracted into `frontend/`, applying only R1 (bootstrap URL + route guards for hidden auth pages) and R4 (`version` tracking + `409 Conflict` refresh prompt).

### 2. Optimistic Locking (`version`) UX & Conflict Policy (R4)
- `version INTEGER NOT NULL DEFAULT 1` on `mindmaps`.
- Frontend seeds `version` from `MapMetadata.version` (and `X-Mindmap-Version` header in `loadMapDom`), sends `version` in JSON body and `X-Mindmap-Version` header at `_sendSave()` time, and updates tracked version from `200`/`204` responses.
- Backend executes atomic `UPDATE ... WHERE id = $1 AND owner_id = $2 AND version = $3`. On `409 Conflict` (manual save, 15s autosave, or `beforeunload` flush), both `RESTPersistenceManager` and `Editor` halt further saves without flushing, invalidate cached map metadata, and display a non-dismissible `VersionConflictDialog` prompting the user to **Refresh Page**. All prior saves remain preserved permanently in `mindmap_history`.

### 3. Auth Session & Database Access Strategy (R2 + R3)
- Server-side `@supabase/ssr` Google OAuth PKCE -> strict `ALLOWED_EMAIL` check (default `a.jian0629@gmail.com`) -> 7-day (`10080` min) HS256 JWT (`JWT_SECRET`) stored in frontend `jwt-auth-token` cookie -> Netlify Functions verify JWT and execute PostgreSQL queries over `pg` (`DATABASE_URL`) inside `SET LOCAL ROLE authenticated` transactions.

### 4. Repository Directory Layout (`frontend/` Subdirectory)
- `frontend/` holds `wisemapping-frontend`, `netlify/functions/` holds TypeScript Netlify Functions, `supabase/migrations/` holds SQL DDL + RLS scripts, `tests/` holds Vitest unit/contract/DB/E2E suites, and root `package.json` runs on Node 20+.

---

## Section 2 — Known Unknowns & Pivot Triggers

| Unknown | Default Taken | Signal That Triggers a Pivot |
|---|---|---|
| **Target Supabase `.env.local` provisioning** | Build M1, M2 SQL, M3 functions, and offline Vitest tests first; verify `.env.local` exists before running live DB tests in M2. | `.env.local` provided -> validate target is NOT `nemo`, apply `supabase/migrations/`, and run live `pg` RLS + optimistic locking suite. |
| **Supavisor Pooler vs Direct `DATABASE_URL`** | Write `db.ts` to support standard `DATABASE_URL` SSL (`rejectUnauthorized: false` for Supabase pooler when needed) with `BEGIN ... SET LOCAL ... COMMIT` and `max: 1` pool per serverless isolate. | Connection or prepared-statement error on port 6543 -> disable prepared statements / adjust SSL config. |
| **`auth.users` trigger permissions on hosted Supabase** | Enforce `ALLOWED_EMAIL` unconditionally in the Netlify OAuth callback; avoid hardcoding email in SQL triggers so Netlify env var changes never drift. | If DB-level `auth.users` restriction is explicitly requested, document Supabase Auth Hook in Deployment Guide. |

---

## Section 3 — Milestones

1. **M1 — Repo Restructuring & Frontend Integration**: Backup `backup-java-original` branch + `backup-java-original-tag` tag at `bc7d6ea0`; remove `wise-api/`, `distribution/`, Java/Docker workflows, and legacy docs/configs; update `.gitignore`; extract clean `fb15a53` into `frontend/`; apply R1 + R4 frontend patches; scaffold root `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `docs/implementation-plan.md`, and `implementation-notes.md`.
2. **M2 — Supabase Migrations & Live DB Verification**: Author `supabase/migrations/0001_initial_schema.sql` (`mindmaps`, `mindmap_history`, `labels`, `mindmap_labels`, plain `TEXT` XML, `version`, permanent snapshots, strict `authenticated`-only RLS); verify target DB is NOT `nemo`; run migrations + automated `pg` RLS/CRUD/conflict suite.
3. **M3 — Netlify Functions Adapter & `netlify.toml`**: Implement `netlify/functions/{api,oauth}.ts` covering all required `/api/restful/*` and `/oauth2/*` routes, trailing slashes, `ResourceId`/`Location` headers, `RestErrors` JSON, `ALLOWED_EMAIL`, 7-day JWT, `version` atomic updates, and `netlify.toml` (`NODE_VERSION = "24"`, `esbuild`, redirect ordering); run Vitest unit/contract tests + `esbuild` bundle test.
4. **M4 & M5 — Documentation, Deployment Guide & E2E Hardening**: Finalize `implementation-notes.md`, `docs/deployment-guide.md`, and `README.md`; pass 100% of E2E tests and adversarial coverage hardening.

---

## Confirmed Execution Decisions (2026-11-24)

1. **`.env.local` & Live DB Verification**: User approved live verification against their target WiseMapping Supabase project (strictly never `nemo`) via `e:\Web\wisemapping-open-source\.env.local`. M1, M2 SQL authoring, and M3 offline tests proceed immediately; M2 live DB execution verifies `.env.local` presence first.
2. **Frontend Baseline**: Confirmed clean official `wisemapping/wisemapping-frontend` (`main` @ `fb15a53`) with only R1 (hiding non-Google login routes/entries) and R4 (`version` optimistic locking + `409` refresh prompt).
3. **Plan Architecture**: All Section 1 choices approved (`frontend/` subdirectory, `version` + `409` refresh dialog on manual & autosave, `@supabase/ssr` PKCE + 7-day JWT + `pg` `SET LOCAL ROLE authenticated` RLS, `ALLOWED_EMAIL` in Netlify OAuth callback).
