create table if not exists project_ideation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  dossier_id uuid references project_dossiers(id) on delete set null,
  task_query text not null,
  bravery_level bravery_level not null default 'Sharp',
  retrieval_scope text not null,
  retrieval_mode text not null,
  selected_roles text[] not null default '{}',
  selected_source_types text[] not null default '{}',
  model_provider text not null,
  model_name text not null,
  idea_count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists project_idea_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  dossier_id uuid references project_dossiers(id) on delete set null,
  generation_run_id uuid references project_ideation_runs(id) on delete set null,
  title text not null,
  one_line_idea text not null,
  core_collision text not null,
  audience_tension text not null,
  product_truth text not null,
  execution_format text not null,
  why_it_may_work text not null,
  non_generic_reason text not null,
  risk_watchout text not null,
  source_grounding_note text not null,
  assumptions text[] not null default '{}',
  bravery_level bravery_level not null default 'Sharp',
  retrieval_scope text not null,
  retrieval_mode text not null,
  selected_roles text[] not null default '{}',
  selected_source_types text[] not null default '{}',
  status text not null default 'generated',
  rejection_reason text,
  shortlist_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_idea_cards_status_check
    check (status in ('generated', 'rejected', 'shortlisted', 'developed', 'archived'))
);

drop trigger if exists touch_project_idea_cards_updated_at on project_idea_cards;
create trigger touch_project_idea_cards_updated_at
before update on project_idea_cards
for each row execute function touch_updated_at();

alter table project_ideation_runs enable row level security;
alter table project_idea_cards enable row level security;

drop policy if exists "users can read own project ideation runs" on project_ideation_runs;
create policy "users can read own project ideation runs"
on project_ideation_runs for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_ideation_runs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own project ideation runs" on project_ideation_runs;
create policy "users can insert own project ideation runs"
on project_ideation_runs for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_ideation_runs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own project idea cards" on project_idea_cards;
create policy "users can read own project idea cards"
on project_idea_cards for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_idea_cards.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own project idea cards" on project_idea_cards;
create policy "users can insert own project idea cards"
on project_idea_cards for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_idea_cards.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can update own project idea cards" on project_idea_cards;
create policy "users can update own project idea cards"
on project_idea_cards for update
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_idea_cards.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_idea_cards.project_id
      and projects.user_id = auth.uid()
  )
);

create index if not exists project_ideation_runs_project_created_idx
  on project_ideation_runs(project_id, created_at desc);

create index if not exists project_idea_cards_project_status_idx
  on project_idea_cards(project_id, status, created_at desc);

create index if not exists project_idea_cards_run_idx
  on project_idea_cards(generation_run_id);
