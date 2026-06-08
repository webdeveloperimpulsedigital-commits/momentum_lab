alter table routes
  add column if not exists idea_card_id uuid references project_idea_cards(id) on delete set null,
  add column if not exists dossier_id uuid references project_dossiers(id) on delete set null,
  add column if not exists evaluation_id uuid references project_idea_evaluations(id) on delete set null,
  add column if not exists created_by uuid references users(id) on delete set null,
  add column if not exists route_depth text not null default 'Standard route',
  add column if not exists route_summary text,
  add column if not exists core_campaign_thought text,
  add column if not exists category_pressure text,
  add column if not exists brand_product_truth text,
  add column if not exists non_generic_reason text,
  add column if not exists campaign_mechanics text[] not null default '{}',
  add column if not exists execution_system jsonb not null default '{}'::jsonb,
  add column if not exists sample_touchpoints text[] not null default '{}',
  add column if not exists source_grounding_summary text,
  add column if not exists assumptions text[] not null default '{}',
  add column if not exists missing_context text[] not null default '{}',
  add column if not exists next_refinement_questions text[] not null default '{}',
  add column if not exists model_provider text,
  add column if not exists model_name text;

alter table routes
  drop constraint if exists routes_route_depth_check;

alter table routes
  add constraint routes_route_depth_check
    check (route_depth in ('Light route', 'Standard route', 'Deep route'));

create table if not exists route_revision_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  route_id uuid not null references routes(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table routes enable row level security;
alter table route_revision_notes enable row level security;

drop policy if exists "users can read own route revision notes" on route_revision_notes;
create policy "users can read own route revision notes"
on route_revision_notes for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = route_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own route revision notes" on route_revision_notes;
create policy "users can insert own route revision notes"
on route_revision_notes for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from projects
    where projects.id = route_revision_notes.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from routes
    where routes.id = route_revision_notes.route_id
      and routes.project_id = route_revision_notes.project_id
  )
);

create index if not exists routes_project_idea_created_idx
  on routes(project_id, idea_card_id, created_at desc);

create index if not exists route_revision_notes_route_created_idx
  on route_revision_notes(route_id, created_at desc);
