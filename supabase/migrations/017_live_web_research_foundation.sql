create table if not exists web_research_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  query text not null,
  research_depth research_depth not null default 'Standard',
  mode_label text not null default 'Default',
  status text not null default 'completed',
  summary text not null default '',
  model_provider text,
  model_name text,
  usage_json jsonb,
  failure_reason text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists web_research_sources (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references web_research_runs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text,
  url text not null,
  start_index integer,
  end_index integer,
  cited_text text,
  source_kind text not null default 'url_citation',
  created_at timestamptz not null default now()
);

alter table web_research_runs enable row level security;
alter table web_research_sources enable row level security;

drop policy if exists "users can read own web research runs" on web_research_runs;
create policy "users can read own web research runs"
on web_research_runs for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = web_research_runs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own web research runs" on web_research_runs;
create policy "users can manage own web research runs"
on web_research_runs for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = web_research_runs.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = web_research_runs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own web research sources" on web_research_sources;
create policy "users can read own web research sources"
on web_research_sources for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = web_research_sources.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own web research sources" on web_research_sources;
create policy "users can manage own web research sources"
on web_research_sources for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = web_research_sources.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = web_research_sources.project_id
      and projects.user_id = auth.uid()
  )
);

create index if not exists web_research_runs_project_created_idx
  on web_research_runs(project_id, created_at desc);

create index if not exists web_research_sources_run_idx
  on web_research_sources(research_run_id);
