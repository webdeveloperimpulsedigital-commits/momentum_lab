create table if not exists project_campaign_blueprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  final_selection_id uuid not null references final_campaign_truths(id) on delete restrict,
  developed_route_id uuid not null references routes(id) on delete restrict,
  idea_card_id uuid references project_idea_cards(id) on delete set null,
  evaluation_id uuid references project_idea_evaluations(id) on delete set null,
  dossier_id uuid references project_dossiers(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  blueprint_depth text not null default 'Standard blueprint',
  blueprint_title text not null,
  selected_campaign_truth text not null,
  route_summary text not null,
  strategic_problem text not null,
  audience_tension text not null,
  category_pressure text not null,
  brand_product_truth text not null,
  brand_role text not null,
  campaign_platform_statement text not null,
  campaign_promise text not null,
  message_hierarchy jsonb not null default '{}'::jsonb,
  core_narrative_arc text not null,
  execution_pillars jsonb not null default '[]'::jsonb,
  campaign_mechanics text[] not null default '{}',
  touchpoint_system jsonb not null default '[]'::jsonb,
  proof_stack_required text[] not null default '{}',
  assets_formats_to_explore text[] not null default '{}',
  rollout_logic text not null,
  risks_watchouts text[] not null default '{}',
  feasibility_notes text not null,
  assumptions text[] not null default '{}',
  missing_context text[] not null default '{}',
  open_questions text[] not null default '{}',
  next_recommended_action text not null,
  model_provider text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_campaign_blueprints
  drop constraint if exists project_campaign_blueprints_depth_check;

alter table project_campaign_blueprints
  add constraint project_campaign_blueprints_depth_check
  check (blueprint_depth in ('Lean blueprint', 'Standard blueprint', 'Detailed blueprint'));

create table if not exists campaign_blueprint_revision_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blueprint_id uuid not null references project_campaign_blueprints(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create trigger touch_project_campaign_blueprints_updated_at
before update on project_campaign_blueprints
for each row execute function touch_updated_at();

alter table project_campaign_blueprints enable row level security;
alter table campaign_blueprint_revision_notes enable row level security;

drop policy if exists "users can read own campaign blueprints" on project_campaign_blueprints;
create policy "users can read own campaign blueprints"
on project_campaign_blueprints for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_campaign_blueprints.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own campaign blueprints" on project_campaign_blueprints;
create policy "users can manage own campaign blueprints"
on project_campaign_blueprints for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_campaign_blueprints.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = project_campaign_blueprints.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own campaign blueprint notes" on campaign_blueprint_revision_notes;
create policy "users can read own campaign blueprint notes"
on campaign_blueprint_revision_notes for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = campaign_blueprint_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own campaign blueprint notes" on campaign_blueprint_revision_notes;
create policy "users can manage own campaign blueprint notes"
on campaign_blueprint_revision_notes for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = campaign_blueprint_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = campaign_blueprint_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from project_campaign_blueprints
    where project_campaign_blueprints.id = campaign_blueprint_revision_notes.blueprint_id
      and project_campaign_blueprints.project_id = campaign_blueprint_revision_notes.project_id
  )
);

create index if not exists project_campaign_blueprints_project_created_idx
  on project_campaign_blueprints(project_id, created_at desc);

create index if not exists project_campaign_blueprints_final_selection_idx
  on project_campaign_blueprints(final_selection_id);

create index if not exists campaign_blueprint_revision_notes_project_created_idx
  on campaign_blueprint_revision_notes(project_id, created_at desc);
