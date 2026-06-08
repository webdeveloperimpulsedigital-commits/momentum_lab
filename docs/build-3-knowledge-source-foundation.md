# Build 3: Knowledge Source Foundation

Date: 2026-06-05

## What Was Built

Build 3 establishes separate knowledge zones for Momentum Lab:

- Global Knowledge Vault: admin-managed reusable source metadata.
- Project Sources: project-owned source metadata isolated to one project.

This build supports pasted text sources and URL source metadata. It does not implement file upload UI, file parsing, scraping, embeddings, vector search, or AI generation.

## New Tables, Columns, And Buckets

Migration: `supabase/migrations/004_knowledge_source_foundation.sql`

Added to `global_sources`:

- `source_type`
- `tags`
- `source_url`
- `content_text`

New table:

- `project_sources`

Private Supabase Storage buckets created:

- `global-sources`
- `project-sources`

The buckets are private and prepared for future file upload work. File upload is not implemented in this build.

## API Routes Added

- `GET /api/global-sources`
- `POST /api/global-sources`
- `PATCH /api/global-sources/:sourceId`
- `DELETE /api/global-sources/:sourceId`
- `GET /api/projects/:id/sources`
- `POST /api/projects/:id/sources`
- `PATCH /api/projects/:id/sources/:sourceId`
- `DELETE /api/projects/:id/sources/:sourceId`

Deletes currently archive source metadata by setting `source_status` to `archived`.

## UI Screens And Sections Added

- Global Knowledge Vault now has an admin source management UI.
- Project Workspace now has a Project Sources section.

Both support:

- title
- description
- source role
- source type
- tags
- active/inactive/archive status
- URL metadata
- pasted text content

## Supported Source Types

- `text`
- `markdown`
- `pdf`
- `docx`
- `image`
- `url`
- `note`
- `transcript`
- `other`

The source type is metadata only for file-like types until upload and parsing are implemented.

## Source Roles

- Context source: background understanding only.
- Strategy source: sharpens framing, tension, insight, and campaign logic.
- Inspiration source: sparks creative combinations, references, formats, and mechanics.
- Evaluation source: supports critique and improvement after ideas exist.
- Mandatory rule source: strict compliance or constraint source.

Default role: Context source.

## Storage Approach

Two private buckets exist:

- `global-sources`
- `project-sources`

Storage policies are prepared:

- Global source files are admin-managed.
- Project source files follow project ownership using the project id as the first storage path segment.

No frontend upload flow was added, so source file access isolation is policy-prepared but not exercised through UI file uploads yet.

## Permission And RLS Summary

- `project_sources` has RLS enabled.
- Users can access only project source records for projects they own.
- Global source writes are admin-only through the API.
- Existing admin-only global source RLS pattern is preserved.
- Non-admin users are blocked from global source writes.
- Direct database RLS was tested for project source isolation.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`
- Direct Supabase API checks for global/project source permissions
- Direct Postgres metadata checks for RLS on `project_sources`
- Secret scan excluding `.env`, build output, dependencies, and lockfile
- Built frontend bundle scan for privileged secret values

## Known Limitations

- File upload is not implemented.
- File parsing is not implemented.
- URL scraping/fetching is not implemented.
- Embeddings and vector search are not implemented.
- Source promotion from project to global is not implemented.
- Global source reading is currently admin-only in the API.

## Next Recommended Build Step

Add a safe file upload foundation for project and global sources, including signed upload/download paths, storage policy tests, and metadata linking, without adding parsing, embeddings, or AI generation yet.
