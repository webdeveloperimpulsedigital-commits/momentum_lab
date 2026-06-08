# Build 15: Pitch Deck Structure Handoff

Build 15 converts a stored campaign blueprint into a structured pitch deck build handoff that can be copied into a separate PPT design/build project.

Momentum Lab does not create PPT, PDF, rendered slides, designed decks, proposal exports, or client-facing deck files.

## Model And Provider

Handoff generation uses the existing server-side LLM gateway and configured model/provider. The OpenAI key remains server-side only.

## Storage

Migration: `supabase/migrations/015_pitch_deck_structure_handoff.sql`

New tables:

- `project_pitch_deck_handoffs`
- `pitch_deck_handoff_revision_notes`

Handoffs store project traceability, campaign blueprint, final selection, developed route, idea/evaluation/dossier links, handoff type, deck depth, audience type, deck purpose, campaign truth, narrative arc, slide structure, section breaks, visual/design notes, proof/claim controls, open questions, copy-paste handoff text, assumptions, missing context, internal-only notes, and model metadata.

## API

Added:

- `POST /api/projects/:id/pitch-deck-handoffs/generate`
- `GET /api/projects/:id/pitch-deck-handoff-revision-notes`
- `POST /api/projects/:id/pitch-deck-handoffs/:handoffId/revision-notes`

The generator validates that the selected campaign blueprint belongs to the user's project and uses permission-checked context retrieval.

## Handoff Types

- Internal pitch structure
- Client pitch structure
- Founder review structure
- Creative team handoff
- PPT design team handoff

Default: `PPT design team handoff`.

## Deck Depths

- Short deck: 6 to 8 slide guidance.
- Standard deck: 10 to 14 slide guidance.
- Detailed deck: 15 to 22 slide guidance.

The system recommends structure rather than forcing an exact slide count.

## Audience Types

- Internal team
- Client leadership
- Marketing team
- B2B boardroom
- Employer branding team
- Creative review
- General

Default: `Client leadership`.

## Slide Structure Logic

The handoff leads with the business or communication problem, builds toward the campaign truth, separates strategy from execution, flags proof and feasibility, and ends with next steps. Each slide includes job, key message, content points, proof needed, visual/asset direction, presenter intent, risk, and readiness status.

## Copy-Paste Handoff Logic

The copy-paste block is plain text/markdown intended for a separate PPT build project. It includes project context, campaign truth, deck objective, audience, narrative arc, slide-by-slide instructions, proof gaps, asset needs, design direction notes, open questions, what not to claim, and expected PPT project output.

## Source Role Handling

Mandatory rule sources are hard constraints. Strategy sources guide deck logic. Inspiration sources are visual stimulus only and are not proof. Evaluation sources flag risks, genericness, weak logic, and proof gaps. Context sources provide background.

## UI

Project Workspace now includes `Pitch Deck Handoff`.

Users can select a campaign blueprint, choose handoff type, deck depth, audience type, retrieval scope/mode/source filters, generate a handoff, view slide-by-slide structure, proof/claim controls, visual/design notes, copy-paste block, previous handoffs, and revision notes.

## Permissions And RLS

RLS is enabled for handoff and handoff note tables. Users can read and manage only handoffs and notes for their own projects. Cross-user generation, viewing, and note creation are blocked. Handoff generation uses permission-aware context packs and does not expose inaccessible snippets or metadata.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

Smoke coverage includes all handoff types, all deck depths, audience selection, copy-paste block generation, revision notes, cross-user blocking, direct RLS checks, and Supabase storage.

## Known Limitations

- No PPT export.
- No PDF export.
- No `.pptx` generation.
- No rendered slides or in-system deck design.
- No asset generation.

## Recommended Next Step

Use the handoff artifact as the endpoint for Momentum Lab, or build additional quality review tools for handoff clarity without creating deck files.
