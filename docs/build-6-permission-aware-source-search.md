# Build 6: Permission-Aware Source Search

Build 6 adds safe retrieval over extracted Momentum Lab source chunks.

## What changed

- Added project source search inside a project workspace.
- Added admin-only global source search in the Knowledge Vault.
- Added combined project/global search from a project, limited to sources the current user is allowed to access.
- Added filters for source role, source type, and result limit.
- Search results return bounded snippets and source metadata, not full extracted documents.

## Migration

Migration: `supabase/migrations/007_permission_aware_source_search.sql`

The migration adds:

- `pg_trgm`
- a trigram index on `source_chunks.chunk_text`
- scope/project/date chunk index
- filter indexes for project and global source search metadata

Search currently uses simple Postgres text matching through `ILIKE`, backed by trigram indexing. It does not use full-text search, vector search, embeddings, or AI generation.

## API

- `GET /api/projects/:id/source-search`
- `GET /api/global-sources/search`

Supported query parameters:

- `q`
- `scope`: `project`, `global`, or `combined`
- `source_role`
- `source_type`
- `limit`: 1 to 20

## Permissions

- Project search first verifies project ownership.
- Global search remains admin-only.
- Combined search includes project chunks plus global chunks only when global access is allowed.
- Snippet retrieval is done through the same permission-aware search routes.
- Existing RLS on `source_contents` and `source_chunks` remains enabled.

## Verification

Verified with:

- typecheck
- production build
- smoke test
- direct API permission checks for blocked project/global access
- direct RLS checks against `source_chunks`

No Supabase personal access token is required for normal operation or for this build. The app uses server-side Supabase credentials from local `.env`.
