do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum (
      'Draft',
      'Research',
      'Ideation',
      'Shortlisted',
      'Developed',
      'Finalised',
      'Archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'research_depth') then
    create type research_depth as enum ('Light', 'Standard', 'Deep');
  end if;
end $$;

alter table projects
  add column if not exists research_depth research_depth not null default 'Standard',
  add column if not exists desired_output_type text,
  add column if not exists status project_status not null default 'Draft',
  add column if not exists brief_notes text;

update projects
set research_depth = 'Standard'
where research_depth is null;

update projects
set status = 'Draft'
where status is null;

create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rejected_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  idea_text text,
  reason_for_rejection text,
  created_at timestamptz not null default now()
);

create table if not exists shortlisted_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  idea_text text,
  why_shortlisted text,
  created_at timestamptz not null default now()
);

alter table routes
  add column if not exists route_title text,
  add column if not exists execution_notes text,
  add column if not exists risks text;

update routes
set route_title = route_name
where route_title is null;

alter table routes
  alter column route_name drop not null;

create table if not exists final_campaign_truths (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  route_id uuid references routes(id) on delete set null,
  final_route_title text,
  final_campaign_truth text,
  rationale text,
  next_action text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists final_campaign_truths_one_active_idx
  on final_campaign_truths(project_id)
  where is_active;

create trigger touch_project_notes_updated_at
before update on project_notes
for each row execute function touch_updated_at();

create trigger touch_final_campaign_truths_updated_at
before update on final_campaign_truths
for each row execute function touch_updated_at();

alter table project_notes enable row level security;
alter table rejected_ideas enable row level security;
alter table shortlisted_ideas enable row level security;
alter table final_campaign_truths enable row level security;

drop policy if exists "users can read own project notes" on project_notes;
create policy "users can read own project notes"
on project_notes for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own project notes" on project_notes;
create policy "users can manage own project notes"
on project_notes for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_notes.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = project_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own rejected ideas" on rejected_ideas;
create policy "users can read own rejected ideas"
on rejected_ideas for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = rejected_ideas.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own rejected ideas" on rejected_ideas;
create policy "users can manage own rejected ideas"
on rejected_ideas for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = rejected_ideas.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = rejected_ideas.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own shortlisted ideas" on shortlisted_ideas;
create policy "users can read own shortlisted ideas"
on shortlisted_ideas for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = shortlisted_ideas.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own shortlisted ideas" on shortlisted_ideas;
create policy "users can manage own shortlisted ideas"
on shortlisted_ideas for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = shortlisted_ideas.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = shortlisted_ideas.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own final campaign truths" on final_campaign_truths;
create policy "users can read own final campaign truths"
on final_campaign_truths for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = final_campaign_truths.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own final campaign truths" on final_campaign_truths;
create policy "users can manage own final campaign truths"
on final_campaign_truths for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = final_campaign_truths.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = final_campaign_truths.project_id
      and projects.user_id = auth.uid()
  )
);

create index if not exists project_notes_project_updated_idx
  on project_notes(project_id, updated_at desc);

create index if not exists rejected_ideas_project_created_idx
  on rejected_ideas(project_id, created_at desc);

create index if not exists shortlisted_ideas_project_created_idx
  on shortlisted_ideas(project_id, created_at desc);

create index if not exists routes_project_updated_idx
  on routes(project_id, updated_at desc);

create index if not exists final_campaign_truths_project_active_idx
  on final_campaign_truths(project_id, is_active);
