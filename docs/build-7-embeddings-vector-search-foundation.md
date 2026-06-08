# Build 7: Embeddings and Vector Search Foundation

Build 7 adds server-side embeddings and permission-aware semantic retrieval for processed Momentum Lab source chunks.

## What Was Built

- OpenAI embedding generation for extracted source chunks.
- `pgvector` storage for one embedding per source chunk.
- Project, global, and combined semantic search routes.
- Source role and source type filters for semantic search.
- Embedding status tracking on project and global source records.
- UI controls for keyword vs semantic search.
- Embed and re-embed actions for processed sources.

No creative generation, answer generation, chat-with-sources, URL scraping, OCR, workers, queues, or model routing were added.

## Provider

- Provider: OpenAI
- Model: `text-embedding-3-small`
- Dimensions: `1536`

Required local server-side environment variable:

- `OPENAI_API_KEY`

Optional server-side defaults:

- `EMBEDDING_PROVIDER=openai`
- `EMBEDDING_MODEL=text-embedding-3-small`
- `EMBEDDING_DIMENSIONS=1536`
- `EMBEDDING_BATCH_SIZE=32`
- `EMBEDDING_TIMEOUT_MS=30000`

Provider keys are read only by the server and are not exposed to the frontend.

## Migration

Migration: `supabase/migrations/008_embeddings_vector_search_foundation.sql`

Added:

- `vector` extension
- `source_embedding_status` enum
- embedding status columns on `global_sources`
- embedding status columns on `project_sources`
- `source_chunk_embeddings`
- RLS policies for embedding rows
- vector and lookup indexes
- `match_source_chunk_embeddings(...)` semantic match function

## API

- `POST /api/projects/:id/sources/:sourceId/embed`
- `POST /api/global-sources/:sourceId/embed`
- `GET /api/projects/:id/source-search?mode=semantic`
- `GET /api/global-sources/search?mode=semantic`

Existing keyword routes are preserved with `mode=keyword`.

## Permissions

- Users can embed their own project sources.
- Users cannot embed another user's project sources.
- Admins can embed global sources.
- Non-admin users cannot embed global sources.
- Project semantic search verifies project ownership before searching.
- Global semantic search remains admin-only.
- Combined semantic search returns project results plus global results only when global access is allowed.
- `source_chunk_embeddings` has RLS enabled and mirrors the chunk/source permission model.

## Known Limitations

- Semantic search is retrieval-only.
- Hybrid keyword/semantic ranking is not implemented yet.
- Embedding generation is synchronous.
- No background queue or retry worker exists yet.
- URL scraping and OCR remain unimplemented.

## Verification

Verified:

- vector extension enabled
- real OpenAI embedding call succeeds
- project source chunks embed
- global source chunks embed
- empty chunks skip safely
- semantic project/global/combined search works
- role/type filters work
- non-admin global embedding/search is blocked
- cross-project embedding/search is blocked
- embedding RLS blocks direct reads for another user
- semantic search works after backend restart
- typecheck, build, and smoke test pass
- no secrets in frontend bundle or tracked source

Recommended next build: retrieval context assembly for future prompt construction, still without creative generation.
