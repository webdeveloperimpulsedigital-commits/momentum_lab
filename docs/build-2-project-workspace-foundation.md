# Build 2: Project Workspace Foundation

Date: 2026-06-05

## What Was Built

Build 2 turns each Momentum Lab project into a persisted creative strategy workspace.

The workspace now supports:

- Project brief editing
- Notes
- Rejected ideas
- Shortlisted ideas
- Developed routes
- One active final selected route / campaign truth

No AI generation, file upload, vector search, model routing, Creative Council, or prompt engine work was added.

## Tables And Columns Added

Migration: `supabase/migrations/003_project_workspace_foundation.sql`

Added to `projects`:

- `research_depth`
- `desired_output_type`
- `status`
- `brief_notes`

New tables:

- `project_notes`
- `rejected_ideas`
- `shortlisted_ideas`
- `final_campaign_truths`

Updated `routes` with:

- `route_title`
- `execution_notes`
- `risks`

`final_campaign_truths` has a partial unique index so only one active final truth exists per project.

## API Routes Added

- `GET /api/projects/:id/workspace`
- `POST /api/projects/:id/notes`
- `PATCH /api/projects/:id/notes/:noteId`
- `DELETE /api/projects/:id/notes/:noteId`
- `POST /api/projects/:id/rejected-ideas`
- `POST /api/projects/:id/shortlisted-ideas`
- `POST /api/projects/:id/routes`
- `PATCH /api/projects/:id/routes/:routeId`
- `PUT /api/projects/:id/final-truth`

Existing project create/update routes now accept Build 2 project metadata.

## UI Screens Added

The existing Project Workspace screen now includes:

- Project brief section
- Notes section
- Rejected ideas section
- Shortlisted ideas section
- Developed routes section
- Final selected route / campaign truth section

The create project screen now includes research depth, status, desired output type, and brief notes.

## Permissions And RLS Summary

RLS is enabled for all new workspace tables:

- `project_notes`
- `rejected_ideas`
- `shortlisted_ideas`
- `final_campaign_truths`

Policies follow the existing project ownership pattern:

- A user can access workspace data only when the related project belongs to that user.
- Another user cannot read or write notes, rejected ideas, shortlisted ideas, routes, or final truth for someone else's project.
- Admin/non-admin policies for settings and global sources remain in place.

## Tests Run

- `npm run typecheck`
- `npm run build`
- `npm run smoke:test`
- Direct Supabase RLS verification for the new workspace tables
- Backend restart persistence verification for workspace data
- Secret scan excluding `.env`, build output, dependencies, and lockfile

## Known Limitations

- Notes can be edited and deleted; rejected ideas, shortlisted ideas, routes, and final truth can be added or updated through the current core flows, but there is not yet a full management UI for deleting every workspace item.
- Routes use the existing `routes` table, with additive Build 2 fields.
- The frontend is intentionally simple and workmanlike.
- The Express server still uses service-role credentials server-side, so API route ownership checks remain important.

## Future Builds

- Add richer workspace item editing/deletion controls.
- Add file uploads and source handling.
- Add research dossier creation.
- Add thought starter generation and model routing.
- Add idea scoring and Creative Council workflows.
