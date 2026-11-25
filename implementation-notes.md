# Implementation Notes — WiseMapping Personal Private Edition

- **Repository**: `e:\Web\wisemapping-open-source`
- **Target Stack**: Official `wisemapping-frontend` (`frontend/`, Vite 8 / React 19 / Yarn 4) + TypeScript Netlify Functions (`netlify/functions/`) + Supabase PostgreSQL & Google OAuth (`supabase/migrations/`)
- **Critical Invariant (`nemo` Protection)**: Never connect to, read, modify, or delete any Supabase project, database, schema, table, or resource named `nemo`.

---

## Deviations

1. **Git Backup Tag Naming (`backup-java-original` + `backup-java-original-tag`)**
   - **Plan**: Create a local Git backup branch/tag (`backup-java-original`) at `bc7d6ea095b9bde1c881805ff737681504c93d43`.
   - **Actual**: Created branch `backup-java-original` AND distinct annotated tag `backup-java-original-tag` at `bc7d6ea095b9bde1c881805ff737681504c93d43` to prevent Git's `refname 'backup-java-original' is ambiguous` warning when a branch and tag share the same name.
2. **Local Node `v20.14.0` Root Dependency Pins vs Frontend Node 24**
   - **Plan**: Root workspace compatible with local Node `v20.14.0`, frontend built on Netlify with Node 24.
   - **Actual**: Latest `vitest@4/5` (pulling `vite@7/8`), `@netlify/functions@6`, and `@supabase/supabase-js@2.110+` enforce `engines.node >= 20.19` or `>= 22`. Root `package.json` explicitly pins `@netlify/functions@^5.3.0`, `@supabase/supabase-js@~2.108.0`, `@supabase/ssr@0.12.0`, `vitest@^3.2.7` with `"overrides": { "vite": "^6.4.6" }`, and `typescript@^5.9.3` so `npm install`, `tsc --noEmit`, and `vitest` run cleanly on `v20.14.0` as well as Node 24.
   - **Frontend Build Note**: `frontend/` (`vite@8.3.2`, `typescript@6.0.3`, `"engines": { "node": ">=24.0.0" }`) is NOT installed or built locally on `v20.14.0`; `netlify.toml` configures `NODE_VERSION = "24"` for production builds.
3. **i18n Compilation in `frontend/packages/webapp` Without Node 24 Local Install**
   - **Plan**: Add `editor.conflict.*` messages and compile `src/compiled-lang/*.json`.
   - **Actual**: Because `frontend/node_modules` is not installed locally under Node `v20.14.0`, updated all 13 `frontend/packages/webapp/lang/*.json` files and all 13 `frontend/packages/webapp/src/compiled-lang/*.json` AST files directly with sorted keys and verified exact format consistency (`[{ "type": 0, "value": "..." }]`) and Simplified Chinese character checks matching `en-messages.test.ts` and `locale-messages.test.ts`.
4. **Legacy `doc/` Removal**
   - **Actual**: Removed `doc/` via `git rm -r` alongside `wise-api/`, `distribution/`, `.github/workflows/*.yml`, `test-file.txt`, `qodana.yaml`, `scripts/manage-git-hooks.sh`, `.vscode/settings.json`, `.cursorrules`, and `CLAUDE.md` to avoid collision with the new `docs/` folder. All removed legacy files remain intact on `backup-java-original`.
5. **Esbuild Serverless Bundling Externalization for `pg`**
   - **Plan**: Bundle `netlify/functions/api.ts` and `oauth.ts` into `.netlify/functions-check`.
   - **Actual**: Marked `--external:pg` and `--external:pg-native` in `package.json` `build:functions` script because `pg` optional native bindings should not be inlined into ESM bundle files, while embedding `@supabase/ssr`, `jose`, etc. seamlessly.

---

## Discovered Edge Cases

1. **Windows Binary Pipe & Locked Empty Directory (`wise-api/`)**
   - Extracted `fb15a53` using `git archive --format=tar -o <temp.tar>` + `tar -xf` to avoid PowerShell 5.1 text-encoding corruption on stdout binary pipes.
   - After `git rm -r wise-api` and deleting `wise-api/target/`, all 436 tracked files and all build artifacts under `wise-api/` were removed; however, on Windows an external IDE Java process held an open directory handle on the now-empty `wise-api/` folder (`0` files inside, untracked by Git).
2. **React Query Cache & `BootstrapPersistenceManager` Interaction on R4**
   - `/c/maps/:id/edit` fetches `GET /api/restful/maps/{id}/metadata?xml=true` and passes `bootstrapXML` into `BootstrapPersistenceManager`, bypassing `RESTPersistenceManager.loadMapDom()`. Seeding `RESTPersistenceManager` constructor `version` from `MapMetadata.version`, parsing `X-Mindmap-Version` in both `fetchMapMetadata` and `loadMapDom`, and invalidating `['maps', 'metadata', mapId]` on conflict and editor unmount prevents stale cached `bootstrapXML`/`version` on SPA re-entry.
3. **Non-Flushing `Editor.haltSaving()` on `409 Conflict`**
   - Upstream `Editor.stopSaving()` calls `flushPendingChangesOnce()` before detaching `beforeunload`. Adding a non-flushing `Editor.haltSaving()` (triggered by `persistenceManager?.addErrorHandler?.(...)` on `errorType === 'conflict'`) stops 15s autosave and detaches `beforeunload` immediately so clicking "Refresh Page" never triggers a stale `keepalive` `PUT`.
4. **Local Git Identity for Annotated Tag & Commits**
   - Configured repository-local `user.name` (`AJAYAN14`) and `user.email` (`AJAYAN14@users.noreply.github.com`) in `.git/config` to match sibling repo settings for creating `backup-java-original-tag` and M1 commit.
5. **M1 Remediation Hardening (i18n Informal Address, `package.json` Cleanliness, Queued `409` Events & `.env` Exception)**
   - Updated German `editor.conflict.description` in `frontend/packages/webapp/lang/de.json` and `src/compiled-lang/de.json` to informal `"Aktualisiere die Seite..."` (matching `form-of-address.test.ts`), and updated `mindplot/src/components/lang/es.ts` `SAVE_CONFLICT` to informal `"recarga"`.
   - Removed accidental `"wisemapping-personal": "file:"` self-dependency from root `package.json` and regenerated `package-lock.json`.
   - Updated `RestPersistenceManager._sendSave` `case 409:` to settle queued `PendingSave.events` (`onError`) alongside the in-flight save without duplicating `triggerError`, and added unit tests in `rest-client.test.ts` (`x-mindmap-version` fallback) and `rest-persistence-manager.test.ts`.
   - Added `!frontend/packages/webapp/.env` in root `.gitignore` so upstream `frontend/packages/webapp/.env` stays tracked 1:1 with `fb15a53` while root/other `.env*` files remain ignored.
6. **Trailing Slashes & Netlify Functions Routing**
   - In Netlify Functions API handler, normalize trailing slashes on URL path matching (`/maps/1/` vs `/maps/1`) and handle case-insensitive URL paths for mind map ID parameters.
7. **Safe Live DB Guarding via `assertNotNemoTarget`**
   - Created `migrate-helper.ts` with deep regex inspection preventing any `SUPABASE_URL` or `DATABASE_URL` containing `nemo` from being evaluated, throwing `NemoProtectionError` without logging secrets.
8. **Single-Owner Google OAuth Exclusivity & Elimination of Commercial/Multi-Tenant Relics**
   - **Login Screen**: Removed email/password inputs, "Forgot Password?", "Sign Up", and external commercial terms/privacy links. Only Google OAuth is rendered and enabled.
   - **Footer & Tracking**: Replaced 3-column commercial footer with a minimal dark/light bar. Removed AdSense, Google Consent Mode, and New Relic injection scripts from `index.html`.
   - **Maps Dashboard**: Wiped 50 hardcoded fake maps from `mock-client/index.ts`. Removed "创建人" (Creator) column. Pruned sidebar filters to strictly "所有" (All) and "收藏" (Starred). Removed floating yellow `?` help button and "AI 副驾驶" promotional dialog.
   - **Account Menu**: Removed "账号信息" modal dialog (name/password editor) and Admin Console; kept only owner profile email (`a.jian0629@gmail.com`) and sign out.
9. **Single-Locale Chinese Enforcement & Purging of Dead/Tracking Files**
   - **Chinese-Only Enforcement**: Removed `<LanguageMenu />` from the top bar entirely and deleted its component folder. Set `AppI18n.getUserLocale()` and `getDefaultLocale()` to always return `Locales.ZH`, pre-bundled Chinese in `messages.ts` and `i18n-msg`, and set `index.html` to `lang="zh-CN"`.
   - **Purged Dead "Shitcode" & Ad Tracking**:
     - Deleted `frontend/packages/editor/images/note-add.svg` (a 1049-line Nuxt HTML error page containing Google AdSense scripts saved with an `.svg` extension).
     - Deleted `frontend/packages/webapp/newrelic-snippet.html` and stripped all `window.newrelic` calls.
     - Deleted `frontend/packages/webapp/src/components/maps-page/help-menu/` (floating yellow help button with PayPal donation link).
     - Removed `window.adsbygoogle` push on route changes and stripped unused type definitions.
10. **Direct File Import without Redundant Dialog**
    - Clicking the toolbar "导入" (Import) button now directly triggers the native OS file picker (`<input type="file" />`).
    - Stripped the manual "名称 *" and "描述" input modal. The map title automatically takes the selected file's name (without extension), and opens directly into the editor upon selection.
11. **Comprehensive Shitcode & Relic Audit**
    - **Admin Console Routes Pruned**: Removed all `/c/admin` routes and lazy components from `app.tsx` (`AdminConsole`, `AdminLayout`, `AccountsPage`, `MapsAdminPage`, `SystemPage`).
    - **Multi-user Share Action Removed**: Removed internal multi-user map sharing from `action-chooser/index.tsx`.
    - **Editor Error-Logger Sanitized**: Removed `window.newrelic` residue from `frontend/packages/editor/src/utils/error-logger.ts`.
    - **Codebase Audited Clean**: Confirmed 0 AdSense publisher IDs (`ca-pub-`), 0 active analytics accounts, 0 New Relic hooks, 0 fake HTML/SVG pages, and 0 commercial donation/PayPal references across runtime code.

---

## Questions for Review

- Live verification against the real Supabase project: Whenever you are ready to connect to your live WiseMapping Supabase instance, create `.env.local` with the database connection string and API keys; all 25 live DB / RLS integration tests will execute automatically and verify schema, transactions, and row-level policies end-to-end.
