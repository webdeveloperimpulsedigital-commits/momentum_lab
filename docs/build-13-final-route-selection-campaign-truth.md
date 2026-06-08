# Build 13: Final Route Selection and Campaign Truth

Build 13 lets a user compare developed routes, choose one final internal route, and lock the campaign truth that future campaign expansion should build from.

This is not deck generation, proposal export, client PDF export, asset generation, Creative Council, multi-model routing, web research, URL scraping, OCR, or autonomous agent work.

## Storage

Migration: `supabase/migrations/013_final_route_selection_campaign_truth.sql`

The existing Build 2 `final_campaign_truths` table was reused and extended. It already had project ownership, active truth support, and RLS policies. Build 13 adds route selection traceability, rationale fields, proof/risk fields, selected user/time fields, status, and supersession tracking.

Added or extended fields include:

- `developed_route_id`
- `idea_card_id`
- `evaluation_id`
- `dossier_id`
- `selected_by`
- `selection_rationale`
- `why_this_route_won`
- `rejected_or_deprioritised_notes`
- `proof_required`
- `risks_watchouts`
- `assumptions`
- `missing_context`
- `status`
- `superseded_by`
- `selected_at`

## Single Active Selection

Only one final route selection is active per project.

When a user saves a new final selection, the previous active selection is marked `superseded`, `is_active` is set to false, and `superseded_by` is linked to the new active row. The new row is inserted as the active final selection, so history is preserved instead of overwritten.

## API

Updated:

- `PUT /api/projects/:id/final-truth`

The endpoint accepts a developed route ID, final route title, final campaign truth, selection rationale, why-won notes, deprioritised notes, proof required, risks/watchouts, assumptions, missing context, and next action.

The server validates that the selected developed route belongs to the current user's accessible project before saving. It copies linked idea, evaluation, and dossier IDs from the selected route unless supplied explicitly.

## UI

Project Workspace now includes:

- `Final Route and Campaign Truth`
- developed route comparison cards
- active final route summary
- selected developed route control
- campaign truth and selection rationale fields
- proof, risks, assumptions, missing context, and next action fields
- selection history showing active and superseded rows

The UI is intentionally simple and optimised for internal decision traceability.

## Campaign Truth Logic

Campaign truth entry is manual in Build 13. AI refinement is not implemented in this build.

The saved campaign truth is required, concise by form design, and linked to the selected developed route. Unsupported claims are not promoted by this layer; proof required, assumptions, and missing context are captured separately.

## Permissions And RLS

The existing `final_campaign_truths` RLS policies remain active and are reused. Users can read and manage only final selections for projects they own. The server also performs project and route ownership checks before saving.

Cross-user final selection creation, viewing, and supersession are blocked. Because AI campaign truth refinement is not implemented, there is no new snippet retrieval path for final selection.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

The smoke test covers final selection save, selected route links, idea/evaluation/dossier traceability, previous active selection supersession, history visibility, cross-user API blocking, and direct RLS reads.

## Known Limitations

- AI campaign truth refinement is not implemented.
- The comparison view is simple and does not include advanced scoring visualisation.
- Final route selection prepares the project for later campaign expansion but does not generate a client-facing presentation or export.

## Recommended Next Step

Build the campaign expansion foundation from the active final route and campaign truth.
