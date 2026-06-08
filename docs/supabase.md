# Supabase Setup Notes

Momentum Lab V1 can run without Supabase by using the server's in-memory development fallback. In fallback mode, data is only local to the running server process.

For persistent data, create a Supabase project and run these migrations in order:

```sql
-- Paste and run supabase/migrations/001_momentum_lab_v1_schema.sql
-- Then paste and run supabase/migrations/002_momentum_lab_v1_rls.sql
```

Then set these variables in `server/.env` or the root `.env` used by your process:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SECRET=
APP_BASE_URL=http://localhost:5173
```

The Express API uses `SUPABASE_ANON_KEY` only for Supabase Auth login and
`SUPABASE_SERVICE_ROLE_KEY` for server-side table access. Do not expose the
service role key in frontend code.

## Admin User Setup

Momentum Lab V1 is single-admin friendly.

1. In Supabase Auth, create the admin user manually.
2. Add the same email and password to your local `.env` only if you also want a matching local fallback login:

```bash
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=use-a-local-development-password
AUTH_SECRET=replace-with-a-long-random-string
```

3. Start the app and log in through the Momentum Lab login page. The server will upsert the Supabase Auth user into the `users` table when `SUPABASE_SERVICE_ROLE_KEY` is configured.
4. Mark that user as admin:

```sql
update users
set role = 'admin'
where email = 'your-admin@example.com';
```

## RLS Policies Prepared

`002_momentum_lab_v1_rls.sql` enables RLS for:

- `users`
- `projects`
- `project_messages`
- `global_sources`
- `project_files`
- `idea_cards`
- `routes`
- `settings`

Policy intent:

- Users can access only their own projects.
- Users can access only messages, project files, idea cards, and routes that belong to their own projects.
- Global sources are admin-only.
- Settings are admin-only.

Because the current Express API uses the service role key for server-side data access, these policies mainly prepare the project for future direct Supabase client access. They are still useful as a database safety layer, but they must be tested in a real Supabase project before being treated as verified.

## Persistence Verification

After configuring Supabase:

1. Run both SQL migrations.
2. Create the admin user in Supabase Auth.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, and `APP_BASE_URL`.
4. Start the app with `npm run dev`.
5. Log in, create a project, send a message, and update settings.
6. Restart the backend.
7. Log in again and confirm the project and message still appear.

You can also run:

```bash
npm run smoke:test
```

When Supabase variables are present, the smoke test should report `"storageMode": "supabase"`. Without those variables, it reports `"storageMode": "memory"` and verifies fallback mode only.

## RLS Verification

Run these checks only after a real Supabase project exists:

1. In Supabase, create two Auth users.
2. Ensure each user has a matching row in `users`.
3. Create a project for user A and a project for user B.
4. Use Supabase SQL or API calls as each authenticated user to verify user A cannot read user B's project rows.
5. Repeat for `project_messages`, `project_files`, `idea_cards`, and `routes`.
6. Confirm only a `users.role = 'admin'` user can read or write `global_sources` and `settings`.

Do not consider RLS verified until those checks pass against the real project.
