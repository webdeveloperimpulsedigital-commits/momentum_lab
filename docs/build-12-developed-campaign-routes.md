# Build 12: Developed Campaign Routes

Build 12 converts selected idea cards into structured developed campaign routes.

## What Was Built

- LLM-backed route development from one selected idea card.
- Optional dossier and evaluation usage.
- Route depth control.
- Permission-aware context pack usage.
- Stored developed routes in the existing `routes` table.
- Route revision notes.
- Developed Routes UI in the Project Workspace.

No final campaign selection, final campaign truth locking, proposal export, deck generation, Creative Council, multi-model routing, live research, URL scraping, OCR, or autonomous agents were added.

## Provider

- Provider: OpenAI
- Model: `gpt-4.1-mini`

All LLM calls remain server-side.

## Storage

Migration: `supabase/migrations/012_developed_campaign_routes.sql`

Reused:

- `routes`

Extended route fields include source idea, optional dossier, optional evaluation, route depth, route summary, campaign thought, category pressure, brand/product truth, non-generic reason, mechanics, execution system, touchpoints, proof gaps, risks, grounding, assumptions, missing context, refinement questions, and model metadata.

Added:

- `route_revision_notes`

## API

- `POST /api/projects/:id/routes/develop`
- `GET /api/projects/:id/route-revision-notes`
- `POST /api/projects/:id/routes/:routeId/revision-notes`

Existing manual route creation remains available through `POST /api/projects/:id/routes`.

## Route Depths

- Light route: concise route for comparison.
- Standard route: practical campaign route with core components.
- Deep route: more detailed route development, still not a final deck.

## Route Structure

Routes include title, summary, core thought, audience tension, category pressure, brand/product truth, brand role, non-generic reason, campaign mechanics, execution system, touchpoints, proof needed, risks, feasibility notes, source grounding, assumptions, missing context, and next refinement questions.

## Evaluation Usage

If an evaluation is supplied, route development uses its sharpness score, genericness risk, readiness, unsupported claims, feasibility risks, recommendation, and sharpness suggestions. If no evaluation id is supplied, the latest evaluation for the idea is used when available.

## Source Role Handling

- Mandatory rule sources are hard constraints.
- Strategy sources shape route logic and tension.
- Inspiration sources are used only as stimulus and are not proof.
- Evaluation sources strengthen critique and reduce genericness.
- Context sources provide background.

## UI

Project Workspace `Developed routes` now supports:

- selected idea card
- optional dossier
- optional evaluation
- route depth
- retrieval scope and mode
- source role/type filters
- route generation
- stored route display
- source grounding, assumptions, missing context, proof gaps, and risks
- route revision notes

## Security

- Users can develop routes only from idea cards in their own projects.
- Users can view only their own developed routes and route notes.
- Users cannot add revision notes to routes outside their own projects.
- Route development uses permission-checked context packs.
- Service role and OpenAI keys remain server-side only.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

The smoke suite verifies route generation from a shortlisted idea, explicit non-shortlisted idea selection, Light/Standard/Deep depths, dossier/evaluation links, context usage, revision notes, cross-user blocking, and direct RLS reads for routes and notes.

## Known Limitations

- No final route selection.
- No final campaign truth locking.
- No deck or proposal export.
- No route comparison dashboard.

Recommended next build: final route selection and campaign truth lock foundation.
