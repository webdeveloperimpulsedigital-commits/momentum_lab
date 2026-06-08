# Build 5: Source Processing And Text Extraction

Date: 2026-06-05

## What Was Built

Build 5 adds server-side source processing for Momentum Lab sources.

It extracts text from supported uploaded and pasted sources, stores extracted content, creates deterministic chunks for future retrieval, and tracks processing status on source records.

No AI generation, embeddings, vector search, model routing, URL scraping, or OCR was added.

## Supported Extraction Types

- Pasted text sources: processed directly from `content_text`.
- TXT files: decoded as UTF-8 plain text.
- Markdown files: decoded as UTF-8 markdown text.
- DOCX files: extracted with `mammoth`.
- PDF files: extracted with `pdf-parse` for text-based PDFs.

## Unsupported Extraction Types

- URL metadata sources are marked unsupported because URL scraping is not implemented.
- Image files are marked unsupported because OCR is not implemented.
- Scanned/image-only PDFs may produce little or no text; OCR is not implemented.

## Libraries Added

- `mammoth`
- `pdf-parse`

## Database Fields And Tables Added

Migration: `supabase/migrations/006_source_processing_text_extraction.sql`

Added processing fields to `global_sources` and `project_sources`:

- `processing_status`
- `processing_error`
- `processed_at`
- `extracted_text_available`
- `extracted_character_count`
- `detected_source_type`

New tables:

- `source_contents`
- `source_chunks`

## Chunking Approach

Chunking is deterministic and does not call AI or embedding APIs.

Current defaults:

- chunk size: about 2,000 characters
- overlap: about 150 characters
- token estimate: rough character count divided by 4

Chunks preserve source order using `chunk_index`.

## API Routes Added

- `POST /api/global-sources/:sourceId/process`
- `GET /api/global-sources/:sourceId/content`
- `GET /api/global-sources/:sourceId/chunks`
- `POST /api/projects/:id/sources/:sourceId/process`
- `GET /api/projects/:id/sources/:sourceId/content`
- `GET /api/projects/:id/sources/:sourceId/chunks`

Content preview responses return a bounded text preview instead of dumping full extracted content into the UI.

## UI Changes

Global and project source lists now show:

- processing status
- extracted text availability
- extracted character count
- safe processing error messages
- Process button
- extracted text preview button when content is available

## Security And RLS Summary

- Source processing runs server-side.
- Service role credentials remain server-side only.
- Project source processing requires project ownership.
- Global source processing is admin-only.
- `source_contents` and `source_chunks` have RLS enabled.
- Project extracted content and chunks are only visible to the owning project user.
- Global extracted content and chunks are admin-only under the current product rule.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`
- Direct project/global source processing verification
- Pasted text extraction verification
- TXT extraction verification
- Markdown extraction verification
- Unsupported image handling verification
- Project extracted content isolation verification
- Global extraction admin permission verification
- Source content/chunk RLS verification
- Backend restart persistence verification
- Secret scan excluding `.env`, build output, dependencies, and lockfile
- Built frontend bundle scan for privileged secrets

## Known Limitations

- No OCR.
- No URL scraping.
- No embeddings.
- No vector search.
- No async queue or background worker.
- PDF extraction is text-based only and depends on embedded text.
- Full extracted text is not exposed in the UI, only a bounded preview.

## What Is Not Yet Implemented

- OCR for images or scanned PDFs
- Webpage fetching
- Embedding generation
- Semantic retrieval
- Source relevance ranking
- AI-generated dossiers or ideation

## Next Recommended Build Step

Add a retrieval preparation layer: source search, chunk browsing, and manual source selection for a project prompt context, without adding AI generation or embeddings yet.
