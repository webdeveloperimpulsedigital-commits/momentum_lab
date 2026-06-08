create table if not exists project_pitch_deck_handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  campaign_blueprint_id uuid not null references project_campaign_blueprints(id) on delete restrict,
  final_selection_id uuid references final_campaign_truths(id) on delete set null,
  developed_route_id uuid references routes(id) on delete set null,
  idea_card_id uuid references project_idea_cards(id) on delete set null,
  evaluation_id uuid references project_idea_evaluations(id) on delete set null,
  dossier_id uuid references project_dossiers(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  handoff_type text not null default 'PPT design team handoff',
  deck_depth text not null default 'Standard deck',
  audience_type text not null default 'Client leadership',
  deck_purpose jsonb not null default '{}'::jsonb,
  core_campaign_truth jsonb not null default '{}'::jsonb,
  narrative_arc jsonb not null default '{}'::jsonb,
  slide_structure jsonb not null default '[]'::jsonb,
  section_breaks text[] not null default '{}',
  visual_design_notes jsonb not null default '{}'::jsonb,
  proof_claim_control jsonb not null default '{}'::jsonb,
  open_questions text[] not null default '{}',
  copy_paste_handoff text not null,
  source_grounding_summary text not null,
  assumptions text[] not null default '{}',
  missing_context text[] not null default '{}',
  internal_only_notes text[] not null default '{}',
  model_provider text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_pitch_deck_handoffs
  drop constraint if exists project_pitch_deck_handoffs_handoff_type_check,
  drop constraint if exists project_pitch_deck_handoffs_deck_depth_check,
  drop constraint if exists project_pitch_deck_handoffs_audience_type_check;

alter table project_pitch_deck_handoffs
  add constraint project_pitch_deck_handoffs_handoff_type_check
  check (handoff_type in ('Internal pitch structure', 'Client pitch structure', 'Founder review structure', 'Creative team handoff', 'PPT design team handoff')),
  add constraint project_pitch_deck_handoffs_deck_depth_check
  check (deck_depth in ('Short deck', 'Standard deck', 'Detailed deck')),
  add constraint project_pitch_deck_handoffs_audience_type_check
  check (audience_type in ('Internal team', 'Client leadership', 'Marketing team', 'B2B boardroom', 'Employer branding team', 'Creative review', 'General'));

create table if not exists pitch_deck_handoff_revision_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  handoff_id uuid not null references project_pitch_deck_handoffs(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create trigger touch_project_pitch_deck_handoffs_updated_at
before update on project_pitch_deck_handoffs
for each row execute function touch_updated_at();

alter table project_pitch_deck_handoffs enable row level security;
alter table pitch_deck_handoff_revision_notes enable row level security;

drop policy if exists "users can read own pitch deck handoffs" on project_pitch_deck_handoffs;
create policy "users can read own pitch deck handoffs"
on project_pitch_deck_handoffs for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_pitch_deck_handoffs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own pitch deck handoffs" on project_pitch_deck_handoffs;
create policy "users can manage own pitch deck handoffs"
on project_pitch_deck_handoffs for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_pitch_deck_handoffs.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = project_pitch_deck_handoffs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own pitch deck handoff notes" on pitch_deck_handoff_revision_notes;
create policy "users can read own pitch deck handoff notes"
on pitch_deck_handoff_revision_notes for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own pitch deck handoff notes" on pitch_deck_handoff_revision_notes;
create policy "users can manage own pitch deck handoff notes"
on pitch_deck_handoff_revision_notes for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = pitch_deck_handoff_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from project_pitch_deck_handoffs
    where project_pitch_deck_handoffs.id = pitch_deck_handoff_revision_notes.handoff_id
      and project_pitch_deck_handoffs.project_id = pitch_deck_handoff_revision_notes.project_id
  )
);

create index if not exists project_pitch_deck_handoffs_project_created_idx
  on project_pitch_deck_handoffs(project_id, created_at desc);

create index if not exists project_pitch_deck_handoffs_blueprint_idx
  on project_pitch_deck_handoffs(campaign_blueprint_id);

create index if not exists pitch_deck_handoff_revision_notes_project_created_idx
  on pitch_deck_handoff_revision_notes(project_id, created_at desc);
