# Build 16: Pitch Deck Handoff Review And Client Readiness

Build 16 adds a review layer for generated pitch deck handoffs before they are copied into a separate PPT design/build project.

Momentum Lab still does not create PPT, PDF, `.pptx`, rendered slides, deck design automation, proposal exports, live web research, URL scraping, OCR, multi-model routing, or Creative Council outputs.

## Migration

Migration: `supabase/migrations/016_pitch_deck_handoff_review_client_readiness.sql`

New tables:

- `pitch_deck_handoff_reviews`
- `pitch_deck_handoff_slide_reviews`
- `pitch_deck_handoff_review_notes`

Reviews link back to pitch deck handoffs, campaign blueprints, final selections, developed routes, and inherited idea/evaluation/dossier references where available.

## Review Modes

- Quick readiness scan
- Standard client-readiness review
- Deep red-team review
- Founder review

## Review Output

Each review stores:

- overall readiness verdict
- 0 to 100 readiness score
- client-readiness status
- narrative strength assessment
- slide logic assessment
- proof and claim risk assessment
- unsupported claims
- proof gaps
- assumptions
- missing context
- internal-only risks
- visual asset gaps
- design handoff clarity assessment
- recommended fixes
- do-not-present-yet warnings
- copy-paste improvement notes
- source grounding summary

Slide-level diagnostics are stored separately for each slide with readiness, proof, claim risk, visual asset, client input, internal-only, genericness, and recommendation fields.

## Security And RLS

RLS is enabled for review, slide review, and review note tables. Users can read and manage only review data for their own projects. API generation checks project ownership before resolving the selected handoff, blueprint, final selection, route, and context pack.

Review generation uses permission-aware context packs and does not retrieve another user's snippets.

## UI

Project Workspace includes `Pitch Deck Handoff Review`.

Users can select a handoff, choose review mode, choose retrieval controls, generate a review, inspect overall verdict and score, review slide diagnostics, see proof gaps, unsupported claims, client input requirements, visual asset requirements, internal-only warnings, recommended fixes, copy-paste improvement notes, and add review notes.

Past reviews remain visible for the same handoff. The original handoff is preserved and is not overwritten.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`

Smoke coverage includes all review modes, slide-level diagnostics, review notes, cross-user blocking, direct RLS checks, persistence through workspace reload, and no-export boundary checks.

## Known Limitations

- No apply-suggestions flow.
- No PPT generation.
- No PDF export.
- No `.pptx` generation.
- No slide rendering.
- No deck design automation.
- No live web research.
- No URL scraping.
- No OCR.
- No multi-model routing.
- No Creative Council.
