# Build 11: Idea Evaluation, Red-Team, and Sharpness Scoring

Build 11 adds a disciplined evaluation layer for generated thought-starter cards.

## What Was Built

- LLM-backed idea evaluation from stored idea cards, optional dossiers, and permission-aware context packs.
- Stored evaluation artifacts.
- Single and multi-idea evaluation support.
- Five evaluation modes.
- Scoring across strategic and creative dimensions.
- Red-team, anti-generic, unsupported-claim, grounding, and feasibility checks.
- Idea Evaluation UI in the Project Workspace.

No route development, final campaign development, Creative Council, multi-model routing, live research, URL scraping, OCR, or autonomous agents were added.

## Provider

- Provider: OpenAI
- Model: `gpt-4.1-mini`

All LLM calls remain server-side.

## Storage

Migration: `supabase/migrations/011_idea_evaluation_red_team_scoring.sql`

Added:

- `project_idea_evaluations`

Evaluations store the idea card, evaluation mode, retrieval settings, selected roles/types, dimension scores, overall sharpness, genericness risk, development readiness, verdict, strongest/weakest aspects, grounding assessment, unsupported claims, feasibility risks, sharpness suggestions, recommendation, and model metadata.

## API

- `GET /api/projects/:id/idea-evaluations`
- `POST /api/projects/:id/idea-evaluations/generate`

## Evaluation Modes

- Quick screen
- Strategic review
- Creative red-team
- Commercial feasibility check
- Anti-generic audit

## Scoring Dimensions

- Strategic fit
- Originality
- Brand/product truth
- Source grounding
- Audience tension
- Execution potential
- Feasibility
- Genericness risk
- Bravery fit
- Development potential

Each dimension is scored 1 to 5. Overall sharpness and genericness risk are scored 1 to 10. Development readiness is `Low`, `Medium`, or `High`.

## Red-Team Logic

The evaluator checks whether the card is truly an idea, whether the tension is sharp, whether it relies on unproven claims, whether the brand can credibly own it, whether the execution carries the strategy, and whether the idea has memory value.

## Anti-Generic Logic

The evaluator flags both exact and structural genericness, including empty language, familiar category mechanics, generic montage/testimonial/founder formats, vague empowerment language, and technology theatre without proof.

## Source Role Handling

- Mandatory rule sources are hard guardrails.
- Strategy sources shape fit, problem, and tension.
- Inspiration sources are stimulus and comparison only, not proof.
- Evaluation sources are used for critique and quality checks.
- Context sources provide background.

## UI

Project Workspace now includes `Idea Evaluation` with:

- idea card multi-select
- optional dossier selection
- evaluation mode
- retrieval scope and mode
- source role/type filters
- stored evaluations grouped by idea
- scores, verdict, risk, suggestions, and recommended action

Apply recommendation is not implemented in this build.

## Security

- Users can evaluate only idea cards from their own projects.
- Users can view only evaluations from their own projects.
- Evaluation uses permission-checked context packs and optional owned dossiers.
- Evaluation table has RLS enabled and tested.
- Service role and OpenAI keys remain server-side only.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

The smoke suite verifies single and multi-idea evaluation, all evaluation modes, stored scores/verdicts/recommendations, source role handling, inaccessible project blocking, and direct RLS reads for evaluation data.

## Known Limitations

- Apply recommendation is not implemented.
- No route development yet.
- No side-by-side ranking dashboard.
- Evaluation quality depends on available source context and LLM provider availability.

Recommended next build: shortlist-to-route development foundation.
