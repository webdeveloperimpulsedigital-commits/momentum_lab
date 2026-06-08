# Momentum Lab

Momentum Lab is an internal creative intelligence workspace scaffold. This V1 creates the technical foundation for authentication, projects, project workspaces, basic chat persistence, Supabase-ready data, and placeholder surfaces for future knowledge and settings work.

This repository does not assume Supabase already exists. If Supabase credentials are absent, the app runs with a local in-memory fallback so the scaffold can be tested without external setup. Real persistence requires a Supabase project, environment variables, and the SQL migrations in `supabase/migrations`.

## Tech Stack

- React, TypeScript, Vite
- Tailwind CSS
- Node.js and Express
- Supabase Auth and Supabase Postgres support
- Shared TypeScript types in `shared`

## Project Structure

- `client` - React app and workspace UI
- `server` - Express API, auth shell, Supabase/in-memory data layer
- `shared` - Shared Momentum Lab types and label constants
- `supabase/migrations` - V1 database schema
- `docs` - Setup notes

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The dev command starts:

- Client: `http://localhost:5173`
- API: `http://localhost:3001`

Without Supabase variables, the app uses a development-only in-memory store. Data created in this mode can disappear when the server restarts. The default local login is:

- Email: `admin@momentum.local`
- Password: `password`

Change `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `AUTH_SECRET` in `.env` for local work.

## Environment Variables

See `.env.example`:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
APP_BASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

AI keys are included for later build steps and are not required for V1.

## Supabase

Run these SQL migrations in your Supabase project, in order:

1. `supabase/migrations/001_momentum_lab_v1_schema.sql`
2. `supabase/migrations/002_momentum_lab_v1_rls.sql`

Supabase Auth is used when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present. If they are missing, the server falls back to a local development auth flow.

Supabase table persistence is used when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present. The service role key is used only by the Express server and must not be exposed to browser code.

To create the single V1 admin:

1. Create a user in Supabase Auth with the intended admin email and password.
2. Log in through Momentum Lab once. The server upserts that user into the `users` table.
3. In Supabase SQL editor, set that user's role:

```sql
update users
set role = 'admin'
where email = 'your-admin@example.com';
```

RLS policies are prepared in `002_momentum_lab_v1_rls.sql`, but they are only active after that migration is run in a real Supabase project.

## Run Frontend

```bash
npm run dev --workspace client
```

## Run Backend

```bash
npm run dev --workspace server
```

## Smoke Tests

```bash
npm run smoke:test
```

The smoke test starts the built backend on a temporary port and checks:

- health
- login
- project creation
- project retrieval
- project update
- message creation
- message retrieval
- settings retrieval and patch
- global sources retrieval

If Supabase variables are missing, this verifies fallback mode only. It does not prove Supabase persistence or RLS.

## Current V1 Features

- Login screen with Supabase Auth or local placeholder authentication
- Dashboard with recent projects and placeholder navigation
- Project creation with required project name and optional intake fields
- Project Workspace with project list, message thread, message input, and side details
- Placeholder assistant response stored after each user message
- Global Knowledge Vault placeholder with future source roles
- Settings placeholder with future model/provider/research/export preferences
- Backend API routes for auth, projects, project messages, global sources, and settings
- Supabase SQL schema and RLS policy migration for V1 tables

## Intentionally Not Built Yet

- AI model routing
- File upload and processing
- Vector search
- Creative Council
- Idea scoring
- Full prompt engine
- API key saving in settings
- Real Global Knowledge Vault uploads

## API Routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/messages`
- `POST /api/projects/:id/messages`
- `GET /api/global-sources`
- `GET /api/settings`
- `PATCH /api/settings`

## Verification Boundaries

What works locally right now:

- React frontend and Express backend
- Local placeholder admin login
- Project CRUD in memory
- Project message creation/retrieval in memory
- Settings retrieval/update in memory
- Empty Global Knowledge Vault response

What is scaffolded:

- Supabase Auth login path
- Supabase-backed table access
- User provisioning into `users`
- RLS policies for current V1 tables

What requires Supabase credentials:

- Real persisted projects, messages, global sources, and settings
- Supabase Auth login
- Admin role provisioning against a real `users` row

What cannot be verified until a real Supabase project exists:

- Database migration execution
- Supabase persistence across server restarts
- RLS policy behavior
- Supabase Auth account setup

## Next Build Steps

1. Create a Supabase project, run both migrations, and verify RLS with real users.
2. Add real file upload storage and project file processing states.
3. Add model provider configuration and server-side model routing.
4. Add research dossier generation and source role handling.
5. Add idea card extraction, shortlisting, and route development workflows.
