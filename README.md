# WiseMapping Personal Private Edition

WiseMapping Personal Private Edition is a modern, single-owner, serverless web-based mind mapping application. It combines the official open-source WiseMapping frontend with a serverless cloud-native architecture on Netlify and Supabase.

---

## ✨ Features & Architecture

- **Official Frontend Baseline**: Built on the clean, official `wisemapping/wisemapping-frontend` (`main` @ `fb15a53`) using React 19, Vite 8, and Yarn 4.
- **Serverless API Adapter**: TypeScript Netlify Functions (`netlify/functions/`) provide 100% API compatibility with the WiseMapping REST wire contract (`/api/restful/*`).
- **PostgreSQL Database & RLS**: Supabase PostgreSQL backend with strict Row-Level Security (RLS) policies isolating user mind maps and metadata.
- **Single-Owner Google OAuth**: Server-side Google OAuth 2.0 PKCE flow via `@supabase/ssr`, enforced by a strict `ALLOWED_EMAIL` allowlist (default: `a.jian0629@gmail.com`) and 7-day secure HS256 JWT sessions.
- **Atomic Optimistic Locking (R4)**: End-to-end `version` tracking preventing concurrent save collisions. If a version conflict occurs, auto-save halts immediately and a non-dismissible refresh dialog prompts the user, keeping map history safe.
- **Automatic Version History**: Permanent snapshots saved in `mindmap_history` on non-minor edits, allowing instant historical inspection and rollback.

---

## 📁 Repository Structure

```
.
├── frontend/                 # Official wisemapping-frontend (React 19 / Vite 8 / Yarn 4)
│   ├── packages/
│   │   ├── mindplot/         # Core SVG mind map rendering & interaction engine
│   │   ├── web2d/            # Vector graphics abstraction library
│   │   └── webapp/           # Main SPA application & routing
├── netlify/
│   └── functions/
│       ├── api.ts            # /api/restful/* REST endpoints adapter
│       └── oauth.ts          # /oauth2/* Google OAuth PKCE & JWT authentication
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql  # Database tables, triggers, and RLS policies
├── docs/
│   ├── implementation-plan.md       # Implementation architecture & decisions
│   └── deployment-guide.md          # Step-by-step production deployment guide
├── tests/
│   ├── contract/             # API contract & Netlify routing tests
│   ├── db/                   # SQL migration schema & live DB test suite
│   ├── e2e/                  # End-to-end test suites (CRUD, auth, locking, etc.)
│   └── unit/                 # Functions, auth, and validation unit tests
├── netlify.toml              # Netlify build configuration & redirect routes
├── package.json              # Root project dependencies & test scripts
└── implementation-notes.md   # Architectural decisions, deviations & edge cases
```

---

## 🛠️ Local Development & Testing

The root project is designed to run testing and backend function validation under Node.js `20.14+`.

### Prerequisites

- Node.js `20.14.0` or higher
- npm `10.7.0` or higher

### Commands

```bash
# Install root dependencies
npm install

# Type-check TypeScript functions and test suites
npm run typecheck

# Bundle serverless functions with esbuild (Node 20 ESM verification)
npm run build:functions

# Run unit and contract tests
npm run test:unit

# Run full Vitest test suite (offline tests run; live DB tests skip safely if .env.local is omitted)
npm test

# Verify all M3 requirements (typecheck + build:functions + test:unit)
npm run verify:m3
```

---

## 🚀 Production Deployment

Deploying WiseMapping Personal Private Edition to Netlify and Supabase takes only a few minutes.

For detailed, step-by-step instructions on setting up:
1. Supabase database tables & RLS policies
2. Google Cloud Console OAuth 2.0 credentials
3. Netlify environment variables and build settings

👉 Please refer to the complete guide: [**Deployment Guide**](file:///e:/Web/wisemapping-open-source/docs/deployment-guide.md).

---

## 🛡️ Security & Privacy

- **Single-Owner Protection**: Only the email specified in `ALLOWED_EMAIL` can log in; any other Google account is immediately rejected with HTTP `403 Forbidden`.
- **Database Row-Level Security**: Every PostgreSQL transaction executes with `SET LOCAL ROLE authenticated` and `request.jwt.claims` containing the authenticated user ID.
- **Nemo Protection Rule**: Automated safety guards prevent connection or modifications to any resource or database named `nemo`.
- **Long-Lived Secure Sessions**: 7-day HS256 JWT tokens stored in `HttpOnly` / `SameSite=Lax` cookies.

---

## 📜 License

WiseMapping Open Source is licensed under the WiseMapping Public License. See [LICENSE.md](file:///e:/Web/wisemapping-open-source/LICENSE.md) for full details.
Original Java Spring codebase and legacy distributions are preserved on the `backup-java-original` Git branch.
