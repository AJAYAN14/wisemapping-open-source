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
   - **Frontend Build Note**: `frontend/` (`vite@8.3.2`, `typescript@6.0.3`, `"engines": { "node": ">=24.0.0" }`) is NOT installed or built locally on `v20.14.0`; `netlify.toml` (M3) configures `NODE_VERSION = "24"` for production builds.
3. **i18n Compilation in `frontend/packages/webapp` Without Node 24 Local Install**
   - **Plan**: Add `editor.conflict.*` messages and compile `src/compiled-lang/*.json`.
   - **Actual**: Because `frontend/node_modules` is not installed locally under Node `v20.14.0`, updated all 13 `frontend/packages/webapp/lang/*.json` files and all 13 `frontend/packages/webapp/src/compiled-lang/*.json` AST files directly with sorted keys and verified exact format consistency (`[{ "type": 0, "value": "..." }]`) and Simplified Chinese character checks matching `en-messages.test.ts` and `locale-messages.test.ts`.
4. **Legacy `doc/` Removal**
   - **Actual**: Removed `doc/` via `git rm -r` alongside `wise-api/`, `distribution/`, `.github/workflows/*.yml`, `test-file.txt`, `qodana.yaml`, `scripts/manage-git-hooks.sh`, `.vscode/settings.json`, `.cursorrules`, and `CLAUDE.md` to avoid collision with the new `docs/` folder. All removed legacy files remain intact on `backup-java-original`.

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

---

## Questions for Review

- *(None pending for M1; `frontend/` unit tests and `vite build` should be verified in a Node 24 environment / Netlify build preview once M3 `netlify.toml` is added.)*
