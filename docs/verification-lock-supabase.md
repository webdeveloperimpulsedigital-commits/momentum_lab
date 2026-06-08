# Momentum Lab Verification Lock: Supabase Foundation

Date: 2026-06-05

## Confirmed Working Items

- Momentum Lab is configured against the real Supabase project in local `.env`.
- The running API reports `supabaseConfigured: true`, `storageMode: supabase`, and `authMode: supabase-auth`.
- Normal app operation does not require a Supabase personal access token.
- Admin login works through Supabase Auth.
- The scaffold/default admin password is rejected.
- Auth session cookie handling works for authenticated `/api/auth/me` requests.
- Project and message data persisted after backend restart.
- Schema migration file exists: `supabase/migrations/001_momentum_lab_v1_schema.sql`.
- RLS migration file exists: `supabase/migrations/002_momentum_lab_v1_rls.sql`.
- Expected Supabase tables exist: `users`, `projects`, `project_messages`, `global_sources`, `project_files`, `idea_cards`, `routes`, and `settings`.
- RLS is enabled on the expected V1 tables.
- 14 RLS policies were present on the expected V1 tables.
- Direct Supabase anon-client RLS checks passed with an admin user and a non-admin user.
- Non-admin user was blocked from reading settings and global sources.
- Non-admin user was blocked from creating global sources.
- Non-admin user was blocked from reading another user's project.
- Non-admin user was blocked from writing messages into another user's project.
- Admin user can read settings and create global sources.
- Built frontend bundle did not contain the service role key, database URL, auth secret, or admin password.

## Fix Applied During Verification

The verification found that Supabase login provisioning could overwrite an existing admin row role back to `user`.
`server/src/auth.ts` was updated so provisioning preserves an existing `users.role` value and only defaults to `user` for new rows.
The admin row was restored to `admin` in Supabase after the fix.

## Still Unverified Items

- Browser-level visual verification with the in-app browser was not performed in this lock.
- This workspace is not currently a Git repository, so Git-based tracking checks cannot run normally. `.env` is listed in `.gitignore`, and because there is no Git repo here, `.env` is not tracked in this workspace.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`
- Local API `/health` check
- Local API login check with current admin password
- Local API rejection check with scaffold/default password
- Backend restart persistence check for a verification project and message
- Direct Supabase Auth/Data API RLS checks with admin and non-admin users
- Direct Postgres metadata checks using `DATABASE_URL` for table existence, RLS enablement, and policy count
- Secret scan excluding `.env`, `node_modules`, `dist`, and `package-lock.json`
- Built frontend bundle scan for privileged secret values

## Test Results

- Typecheck: passed
- Build: passed
- Smoke test: passed in Supabase mode
- `/health`: passed, Supabase mode reported
- Admin login: passed
- Scaffold/default password rejection: passed
- Persistence after backend restart: passed
- RLS behavior checks: passed
- Database metadata checks: passed
- Frontend privileged secret scan: passed
- Repo secret scan: passed; only placeholder examples were found in docs

## Security Notes

- The previously exposed Supabase personal access token is not required for normal app operation.
- No new Supabase personal access token was used for this verification.
- Runtime secrets are stored in local `.env`.
- `.env` is listed in `.gitignore`.
- Privileged Supabase credentials are used by the server only.
- The frontend does not receive the service role key.
- Do not commit `.env` or copy any local secret values into docs, README, scripts, frontend code, or chat.

## Required Manual Actions For Adwait

- Keep the revoked personal access token revoked.
- Do not create a new Supabase personal access token unless a future management task specifically requires it.
- If this workspace is later initialized as a Git repository, confirm `.env` remains untracked before the first commit.
- Store the current admin password securely outside the repository.

## Known Risks

- The Express server uses the Supabase service role key for server-side table access. This is acceptable for the current backend-owned V1 scaffold, but it means API route authorization must remain correct.
- RLS is verified for direct Supabase anon-client access, but service-role operations bypass RLS by design.
- Local `.env` contains powerful credentials and must remain local-only.

## Next Recommended Build Step

Proceed to a verification lock closeout or the next foundation step only after accepting this document. A good next build prompt is:

“Add durable repository hygiene and CI checks for Momentum Lab, including secret scanning, smoke test automation, and a clean environment setup flow, without adding product features.”
