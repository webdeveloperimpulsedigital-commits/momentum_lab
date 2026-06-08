# Build 10: First Ideation and Thought-Starter Cards

Build 10 adds the first rough ideation layer for Momentum Lab.

## What Was Built

- Grounded first-pass ideation from dossiers and context packs.
- Stored ideation run records.
- Stored thought-starter idea cards.
- Bravery level control.
- Idea Explorer UI.
- Reject and shortlist actions with reasons.

No polished campaign routes, final campaign development, Creative Council, multi-model routing, live research, URL scraping, OCR, or autonomous agents were added.

## Provider

- Provider: OpenAI
- Model: `gpt-4.1-mini`

All LLM calls remain server-side.

## Storage

Migration: `supabase/migrations/010_first_ideation_thought_starter_cards.sql`

Added:

- `project_ideation_runs`
- `project_idea_cards`

Idea cards store title, one-line idea, collision, tension, product truth, execution format, why it may work, non-generic reason, risk, grounding note, assumptions, bravery level, retrieval settings, status, and reject/shortlist reasons.

## API

- `GET /api/projects/:id/idea-cards`
- `POST /api/projects/:id/idea-cards/generate`
- `POST /api/projects/:id/idea-cards/:ideaId/reject`
- `POST /api/projects/:id/idea-cards/:ideaId/shortlist`

## Bravery Levels

- Safe: realistic and low-risk without becoming generic.
- Sharp: fresh, strategic, and realistic default mode.
- Bold: pushes category norms and creative devices.
- Wild: novelty, spectacle, provocation, and feasibility watchouts.
- Chaos first: raw, strange, high-variance starters.

## Source Role Handling

- Mandatory rules must be followed.
- Strategy sharpens problem, tension, and campaign logic.
- Inspiration is stimulus only and must not be copied or treated as proof.
- Evaluation flags risks and genericness.
- Context is background, not strict instruction.

## Anti-Generic Controls

The prompt bans generic marketing language, unsupported claims, invented statistics, repeating the same idea, copying inspiration literally, and treating all sources as rules.

## UI

Project Workspace now includes `Idea Explorer` with:

- task/query input
- optional dossier selection
- bravery level
- retrieval scope and mode
- source role/type filters
- idea count
- optional instruction
- stored idea cards
- status filter
- reject/shortlist actions with reasons

## Security

- Users can generate, view, reject, and shortlist idea cards only for their own projects.
- Idea card and ideation run tables have RLS enabled.
- Ideation uses permission-checked context packs and optional owned dossiers.
- Service role and OpenAI keys remain server-side only.

## Error Handling

- Invalid bravery levels and idea counts above 15 are rejected before generation.
- Missing, unsupported, timed-out, rate-limited, or failed LLM provider calls return sanitized API errors.
- Malformed model JSON and incomplete idea cards are rejected before storage.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

The smoke suite verifies stored ideation cards, reject/shortlist reasons, source role grouping, mandatory-rule handling, inspiration-as-stimulus behavior, the 15-card hard cap, and all bravery levels: Safe, Sharp, Bold, Wild, and Chaos first.

## Known Limitations

- No developed routes yet.
- No Creative Council review.
- No side-by-side clustering or duplicate analysis beyond simple title dedupe.
- No export.

Recommended next build: shortlist-to-route development foundation.
