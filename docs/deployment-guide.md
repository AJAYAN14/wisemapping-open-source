# Deployment Guide — WiseMapping Personal Private Edition

This guide details the complete deployment procedure for **WiseMapping Personal Private Edition**, a serverless, single-owner mind-mapping solution powered by:
- **Frontend**: Official `wisemapping-frontend` (React 19 + Vite 8 SPA in `frontend/`) hosted statically on Netlify.
- **Backend API**: TypeScript Netlify Functions (`netlify/functions/`) implementing the full `/api/restful/*` wire contract.
- **Database & Auth**: Supabase PostgreSQL database protected by Row-Level Security (RLS) + Google OAuth PKCE via `@supabase/ssr`.

---

## ⚠️ Critical Invariant (`nemo` Safety Guard)

> [!CAUTION]
> **Strict Nemo Target Protection**: Never connect to, read, modify, or delete any Supabase project, database, schema, table, or resource named `nemo`.
> All backend code, test suites, and migration scripts enforce this restriction via automated safety assertions (`assertNotNemoTarget`).

---

## Architecture Overview

```
                      [Browser User]
                            │
               HTTPS / (SPA & Direct Routes)
                            ▼
               ┌───────────────────────────┐
               │    Netlify Edge / CDN     │
               │   (React 19 / Vite 8 SPA) │
               └─────────────┬─────────────┘
                             │ /api/restful/* & /oauth2/*
                             ▼
               ┌───────────────────────────┐
               │ Netlify Functions (Node)  │
               │   • api.ts (REST Adapter) │
               │   • oauth.ts (Google PKCE)│
               └─────────────┬─────────────┘
                             │ pg (SET LOCAL ROLE authenticated)
                             ▼
               ┌───────────────────────────┐
               │    Supabase PostgreSQL    │
               │   • RLS-isolated Tables   │
               │   • Google OAuth Provider │
               └───────────────────────────┘
```

---

## Prerequisites

Before beginning deployment, ensure you have:
1. A **GitHub** account containing your WiseMapping repository.
2. A **Supabase** account (Free or Pro tier) with a clean project created.
3. A **Google Cloud Console** project with Google OAuth 2.0 Credentials enabled.
4. A **Netlify** account connected to your GitHub repository.

---

## Step 1: Supabase PostgreSQL Setup & Migrations

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project (e.g., `wisemapping-personal`).
   - Choose a strong database password and save it securely.
   - Choose your preferred region.
3. Open the **SQL Editor** from the left navigation pane.
4. Paste and execute the contents of the migration file:
   [`supabase/migrations/0001_initial_schema.sql`](file:///e:/Web/wisemapping-open-source/supabase/migrations/0001_initial_schema.sql)
5. This migration script creates:
   - Tables: `mindmaps`, `mindmap_history`, `labels`, and `mindmap_labels`.
   - Automatic triggers: `set_updated_at` and `increment_mindmap_version` (atomic optimistic locking).
   - Strict Row-Level Security (RLS) policies granting access solely to `authenticated` users where `auth.uid() = owner_id`.
6. Retrieve your database connection parameters:
   - Navigate to **Project Settings** -> **Database**.
   - Under **Connection string**, select **URI** (Transaction pooler via port 6543 or Session pooler via port 5432). This is your `DATABASE_URL`.
   - Navigate to **Project Settings** -> **API** to obtain your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Step 2: Google Cloud Console OAuth 2.0 Configuration

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** -> **OAuth consent screen**.
   - Select **User Type: External** and fill in App Name (e.g. `WiseMapping Personal`).
   - Add your email address as the developer contact.
   - Under **Scopes**, ensure `.../auth/userinfo.email` and `.../auth/userinfo.profile` are added.
3. Navigate to **APIs & Services** -> **Credentials**.
4. Click **Create Credentials** -> **OAuth Client ID**.
   - **Application type**: Web application.
   - **Name**: `WiseMapping Client`.
   - **Authorized JavaScript origins**:
     - `https://<your-netlify-site-name>.netlify.app`
     - `https://<supabase-project-id>.supabase.co`
     - (Optional for local testing): `http://localhost:8888`
   - **Authorized redirect URIs**:
     - Supabase OAuth callback URI: `https://<supabase-project-id>.supabase.co/auth/v1/callback`
     - Netlify Functions callback URI: `https://<your-netlify-site-name>.netlify.app/api/restful/oauth2/callback`
     - (Optional for local testing): `http://localhost:8888/api/restful/oauth2/callback`
5. Note down your **Client ID** and **Client Secret**.

---

## Step 3: Configure Google Provider in Supabase Auth

1. In the Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Google**.
2. Toggle **Enable Google provider** to ON.
3. Paste the **Client ID** and **Client Secret** obtained in Step 2.
4. Verify that the Callback URL in Supabase matches:
   `https://<supabase-project-id>.supabase.co/auth/v1/callback`
5. Click **Save**.

---

## Step 4: Netlify Project & Environment Configuration

1. In the [Netlify Dashboard](https://app.netlify.com/), click **Add new site** -> **Import an existing project**.
2. Connect your GitHub repository (`wisemapping-open-source`).
3. Build settings are automatically detected from [`netlify.toml`](file:///e:/Web/wisemapping-open-source/netlify.toml):
   - **Base directory**: (root)
   - **Build command**: `cd frontend && corepack enable && yarn install --immutable && yarn build`
   - **Publish directory**: `frontend/packages/webapp/dist`
   - **Functions directory**: `netlify/functions`
   - **Node.js Version**: `24`
4. Navigate to **Site configuration** -> **Environment variables** -> **Add a variable** and configure the required environment variables:

| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | `https://<project-id>.supabase.co` | Your Supabase Project API URL. |
| `SUPABASE_ANON_KEY` | Yes | `eyJ...` | Supabase Public Anonymous API Key. |
| `DATABASE_URL` | Yes | `postgresql://postgres.[ref]:[pass]@aws-0-...pooler.supabase.com:6543/postgres` | PostgreSQL connection string for `pg` connection pool. |
| `JWT_SECRET` | Yes | At least 32 random characters | Secret key used to sign and verify 7-day HS256 auth tokens. `JWT_SECRET` must be >= 32 characters (e.g. 64-char hex string generated with `openssl rand -hex 32`). |
| `ALLOWED_EMAIL` | Yes | `a.jian0629@gmail.com` | Case-insensitive single-owner email allowlist. Sign-ins from any other Google account are rejected with 403 Forbidden. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | `false` | Set to `"false"` to accept Supabase pooler SSL certificates; set to `"true"` for strict CA validation. |
| `URL` | Auto | Netlify URL | Site production origin (automatically injected by Netlify). |
| `APP_ORIGIN` | No | (Derived from URL) | Optional override for frontend base origin in OAuth redirects. |
| `APP_CONFIG_TYPE` | Auto | `remote` | Injected by `netlify.toml` for production frontend build bootstrap. |
| `APP_CONFIG_JSON` | Auto | `{"type":"remote","url":"/api/restful/app/config"}` | Injected by `netlify.toml` for remote configuration fetching. |

5. Trigger a deployment: **Deploys** -> **Trigger deploy** -> **Clear cache and deploy site**.

---

## Step 5: Verification & Post-Deployment Checklist

After the Netlify build completes and transitions to Published:
1. Open your Netlify site URL (e.g. `https://<site>.netlify.app/c/login`).
2. Verify that local username/password forms and registration buttons are hidden, leaving only the Google OAuth sign-in button.
3. Click **Sign in with Google**:
   - Authenticate with your allowed account (`a.jian0629@gmail.com`).
   - The browser redirects to Supabase PKCE -> Netlify OAuth callback -> sets `jwt-auth-token` cookie -> enters `/c/maps`.
4. Create a new mind map:
   - Check that the mind map canvas opens cleanly.
   - Edit topics and observe that the save indicator confirms version updates.
   - Verify that changes persist across page reloads.
5. Verify optimistic locking (R4):
   - Open the same map in two different browser tabs.
   - Make edits and save in Tab A.
   - Attempt to edit and save in Tab B.
   - Confirm that Tab B halts saving and presents the non-dismissible **Version Conflict Dialog** prompting you to refresh.

---

## Local Development & Testing

You can run offline unit, contract, and E2E suites locally on Node 20+ without any cloud dependencies:

```bash
# Typecheck functions & tests
npm run typecheck

# Bundle functions check
npm run build:functions

# Run unit and contract tests
npm run test:unit

# Run full Vitest suite (offline tests pass; live DB tests skip safely if .env.local is omitted)
npm test
```

To run live database integration tests locally against your development Supabase project:
1. Create a `.env.local` file in the root directory:
   ```ini
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   DATABASE_URL=postgresql://postgres:...@...:6543/postgres
   JWT_SECRET=your-32-plus-characters-random-secret
   ALLOWED_EMAIL=a.jian0629@gmail.com
   ```
2. Run live tests:
   ```bash
   npx vitest run tests/db/
   ```
