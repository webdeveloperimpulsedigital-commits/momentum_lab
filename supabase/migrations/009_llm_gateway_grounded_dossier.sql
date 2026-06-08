create table if not exists project_dossiers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  title text not null,
  task_query text not null,
  retrieval_scope text not null,
  retrieval_mode text not null,
  selected_roles text[] not null default '{}',
  selected_source_types text[] not null default '{}',
  dossier_content jsonb not null default '{}'::jsonb,
  grounding_metadata jsonb not null default '{}'::jsonb,
  assumptions text[] not null default '{}',
  missing_context text[] not null default '{}',
  model_provider text not null,
  model_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_project_dossiers_updated_at on project_dossiers;
create trigger touch_project_dossiers_updated_at
before update on project_dossiers
for each row execute function touch_updated_at();

alter table project_dossiers enable row level security;

drop policy if exists "users can read own project dossiers" on project_dossiers;
create policy "users can read own project dossiers"
on project_dossiers for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_dossiers.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own project dossiers" on project_dossiers;
create policy "users can insert own project dossiers"
on project_dossiers for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_dossiers.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can update own project dossiers" on project_dossiers;
create policy "users can update own project dossiers"
on project_dossiers for update
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_dossiers.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = project_dossiers.project_id
      and projects.user_id = auth.uid()
  )
);

create index if not exists project_dossiers_project_created_idx
  on project_dossiers(project_id, created_at desc);

create index if not exists project_dossiers_created_by_idx
  on project_dossiers(created_by);
