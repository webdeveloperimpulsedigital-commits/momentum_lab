# Build 9: LLM Gateway and Grounded Dossier Foundation

Build 9 adds the first controlled AI generation layer for Momentum Lab.

## What Was Built

- Server-side LLM gateway.
- OpenAI text generation through the Responses API.
- Grounded Creative Intelligence Dossier generation from Build 8 context packs.
- Stored project dossier artifacts.
- RLS-protected `project_dossiers` table.
- Project Workspace UI for generating and viewing dossiers.

No campaign ideation, route generation, Creative Council, multi-provider routing, web research, URL scraping, OCR, or agents were added.

## Provider

- Provider: OpenAI
- Verified model: `gpt-4.1-mini`

Server-side configuration:

- `OPENAI_API_KEY`
- `LLM_PROVIDER=openai`
- `LLM_MODEL=gpt-4.1-mini`
- `LLM_TEMPERATURE=0.7`
- `LLM_MAX_OUTPUT_TOKENS=1400`
- `LLM_TIMEOUT_MS=45000`

Only the server reads provider keys.

## Storage

Migration: `supabase/migrations/009_llm_gateway_grounded_dossier.sql`

Added table:

- `project_dossiers`

Stored fields include task query, retrieval settings, selected roles/types, dossier JSON, grounding metadata, assumptions, missing context, model provider/name, and timestamps.

## API

- `GET /api/projects/:id/dossiers`
- `POST /api/projects/:id/dossiers`

The generation endpoint:

1. verifies project ownership
2. generates a permission-safe context pack
3. builds the dossier prompt server-side
4. calls the LLM gateway
5. parses strict JSON output
6. stores the dossier

## Grounding Logic

The prompt includes:

- project metadata
- grouped context pack sections
- mandatory rules separately
- source role explanations
- hallucination bans
- assumption labelling requirements
- missing context requirements

The model is told not to invent client facts, statistics, market data, legal claims, competitor claims, dates, or case details.

## Source Role Handling

- Mandatory rules are treated as hard constraints.
- Strategy sources are framing intelligence.
- Inspiration sources are creative stimulus only.
- Evaluation sources are critique criteria.
- Context sources are background.

## UI

Project Workspace now includes `Creative Intelligence Dossier` with:

- task/query input
- retrieval scope
- retrieval mode
- source role filters
- source type filters
- generated dossier view
- assumptions
- missing context
- source grounding summary
- previous stored dossiers

## Security

- Users can generate/list dossiers only for their own projects.
- Stored dossiers are protected by RLS.
- Dossier generation can only access the context pack returned by permission-checked retrieval.
- The frontend does not receive the service role key or OpenAI key.

## Known Limitations

- No human edit workflow yet.
- No export yet.
- No citation UI per bullet yet.
- No hybrid retrieval ranking.
- No campaign ideation or route generation.

Recommended next build: controlled ideation scaffolding using stored dossiers and grounded context packs.
