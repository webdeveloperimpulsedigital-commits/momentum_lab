create table if not exists project_idea_evaluations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  idea_card_id uuid not null references project_idea_cards(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  evaluation_mode text not null default 'Strategic review',
  dossier_id uuid references project_dossiers(id) on delete set null,
  retrieval_scope text not null,
  retrieval_mode text not null,
  selected_roles text[] not null default '{}',
  selected_source_types text[] not null default '{}',
  scores_json jsonb not null,
  overall_sharpness_score integer not null,
  genericness_risk_score integer not null,
  development_readiness text not null,
  overall_verdict text not null,
  strongest_aspect text not null,
  weakest_aspect text not null,
  source_grounding_assessment text not null,
  unsupported_claims text[] not null default '{}',
  feasibility_risks text[] not null default '{}',
  sharpness_suggestions text[] not null default '{}',
  recommended_action text not null,
  model_provider text not null,
  model_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_idea_evaluations_mode_check
    check (evaluation_mode in (
      'Quick screen',
      'Strategic review',
      'Creative red-team',
      'Commercial feasibility check',
      'Anti-generic audit'
    )),
  constraint project_idea_evaluations_readiness_check
    check (development_readiness in ('Low', 'Medium', 'High')),
  constraint project_idea_evaluations_action_check
    check (recommended_action in ('Reject', 'Revise', 'Shortlist', 'Develop', 'Park for later')),
  constraint project_idea_evaluations_sharpness_check
    check (overall_sharpness_score between 1 and 10),
  constraint project_idea_evaluations_genericness_check
    check (genericness_risk_score between 1 and 10)
);

drop trigger if exists touch_project_idea_evaluations_updated_at on project_idea_evaluations;
create trigger touch_project_idea_evaluations_updated_at
before update on project_idea_evaluations
for each row execute function touch_updated_at();

alter table project_idea_evaluations enable row level security;

drop policy if exists "users can read own project idea evaluations" on project_idea_evaluations;
create policy "users can read own project idea evaluations"
on project_idea_evaluations for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_idea_evaluations.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own project idea evaluations" on project_idea_evaluations;
create policy "users can insert own project idea evaluations"
on project_idea_evaluations for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_idea_evaluations.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from project_idea_cards
    where project_idea_cards.id = project_idea_evaluations.idea_card_id
      and project_idea_cards.project_id = project_idea_evaluations.project_id
  )
);

create index if not exists project_idea_evaluations_project_created_idx
  on project_idea_evaluations(project_id, created_at desc);

create index if not exists project_idea_evaluations_idea_created_idx
  on project_idea_evaluations(idea_card_id, created_at desc);
