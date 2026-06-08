# Build 8: Retrieval Context Pack Foundation

Build 8 adds on-demand, permission-aware context packs for future AI prompt assembly.

## What Was Built

- Project context pack generation.
- Admin global context pack generation.
- Project plus allowed global context pack generation.
- Keyword and semantic retrieval modes.
- Source role grouping into structured context sections.
- Source type filtering.
- Safe chunk, section, and character limits.
- Context Pack Preview UI in the Project Workspace.

No creative AI generation, chat-with-sources, answer generation, model routing, URL scraping, OCR, workers, or campaign ideation were added.

## Storage Model

Context packs are generated on demand and are not stored.

No migration was required because Build 8 only assembles existing permission-checked source search results into a structured response. Existing source, chunk, and embedding RLS policies continue to protect the underlying data.

## Retrieval Scopes

- `project_only`
- `global_only`
- `project_plus_global`

Global content remains admin-only under the current product permission model.

## Retrieval Modes

- `keyword`
- `semantic`

Combined keyword/semantic ranking remains future work.

## Section Logic

Context packs are grouped into:

- Mandatory rules: only `mandatory_rule`
- Project context: project-scoped `context`
- Strategy intelligence: `strategy`
- Inspiration material: `inspiration`
- Evaluation material: `evaluation`
- General context: global `context`

Inspiration, context, strategy, and evaluation sources are not treated as mandatory rules.

## Default Limits

- Max chunks per section: 5
- Max total chunks: 25
- Max characters: 12,000
- Max snippet length: 700

## API

- `POST /api/projects/:id/context-pack`
- `POST /api/global-sources/context-pack`

## UI

Project Workspace now includes `Context Pack Preview` with:

- query/task input
- retrieval scope selector
- retrieval mode selector
- source role filters
- source type filters
- grouped context preview
- missing/unavailable context notes
- mandatory-rule presence indicator

## Security

- Project packs require project ownership.
- Global packs require admin access.
- Project plus global packs include global chunks only when global access is allowed.
- Context packs return snippets and source metadata only from permitted retrieval results.
- No service role key or OpenAI key is exposed to the frontend.

## Known Limitations

- Packs are not persisted.
- No hybrid ranking.
- No final prompt rendering.
- No AI answer generation.
- No source citation export yet.

Recommended next build: controlled prompt context assembly and source-grounded AI generation scaffolding.
