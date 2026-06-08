# Build 14: Campaign Blueprint Foundation

Build 14 converts the active final selected route and campaign truth into a structured internal campaign blueprint.

This is not a client-facing deck, proposal export, PDF export, final social copy generation, asset-by-asset generation, media plan, Creative Council, multi-model routing, live web research, URL scraping, OCR, or autonomous agent work.

## Model And Provider

Blueprint generation uses the existing server-side LLM gateway and configured model/provider. The OpenAI key remains server-side only.

## Storage

Migration: `supabase/migrations/014_campaign_blueprint_foundation.sql`

New tables:

- `project_campaign_blueprints`
- `campaign_blueprint_revision_notes`

Blueprints store the originating final selection, developed route, idea, evaluation, dossier, blueprint depth, campaign truth, strategic problem, message hierarchy, execution pillars, touchpoint system, proof stack, risks, feasibility notes, assumptions, missing context, open questions, next action, model metadata, and timestamps.

## API

Added:

- `POST /api/projects/:id/campaign-blueprints/generate`
- `GET /api/projects/:id/campaign-blueprint-revision-notes`
- `POST /api/projects/:id/campaign-blueprints/:blueprintId/revision-notes`

The generation endpoint uses the active final selection by default, or a selected final selection if supplied. It validates that the final selection, developed route, dossier, and evaluation belong to the user's accessible project.

## Blueprint Depths

- Lean blueprint: concise internal campaign skeleton.
- Standard blueprint: complete working architecture.
- Detailed blueprint: deeper campaign system with more executional detail, still not a deck.

## Blueprint Structure

Blueprints include campaign title, locked campaign truth, route summary, strategic problem, audience tension, category pressure, brand/product truth, brand role, platform statement, campaign promise, message hierarchy, narrative arc, execution pillars, mechanics, touchpoints, proof stack, assets/formats to explore, rollout logic, risks, feasibility notes, assumptions, missing context, open questions, and next recommended action.

## Message Hierarchy

The message hierarchy remains internal and strategic. It separates core campaign truth, primary message, support messages, proof areas, possible calls to action, and claims that should not be made until proof exists.

## Execution Pillars

The prompt asks for 3 to 5 relevant pillars, each with its role, audience job, possible formats, source/proof dependency, and risks.

## Source Role Handling

Mandatory rule sources are hard constraints. Strategy sources guide architecture. Inspiration sources are used only as stimulus and are not proof. Evaluation sources guide critique and risk. Context sources provide background.

## UI

Project Workspace now includes `Campaign Blueprint`.

Users can choose blueprint depth, retrieval scope, retrieval mode, source roles, source types, generate a blueprint, view previous blueprints, see campaign truth/message hierarchy/execution pillars/touchpoints/proof/risk/assumption/missing context fields, and add revision notes.

## Permissions And RLS

RLS is enabled for blueprint and blueprint note tables. Users can read and manage only blueprints and notes for projects they own. API generation also checks project ownership before resolving final selections, developed routes, dossiers, evaluations, context packs, and snippets.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

The smoke test verifies Lean, Standard, and Detailed blueprint generation, traceability links, context usage, revision notes, cross-user blocking, and direct RLS reads.

## Known Limitations

- Blueprint generation produces an internal strategic working document only.
- No client deck, export, media plan, or final asset generation is implemented.
- No AI refinement UI beyond generating a new blueprint.

## Recommended Next Step

Build the campaign output planning foundation from stored campaign blueprints.
