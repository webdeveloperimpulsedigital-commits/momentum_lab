create extension if not exists "pgcrypto";

create type project_stage as enum (
  'Intake',
  'Research',
  'Thought starters',
  'Shortlist',
  'Route development',
  'Final campaign truth'
);

create type bravery_level as enum (
  'Safe',
  'Sharp',
  'Bold',
  'Wild',
  'Chaos first'
);

create type message_role as enum ('user', 'assistant', 'system');

create type message_type as enum (
  'normal_chat',
  'research_dossier',
  'thought_starters',
  'shortlist',
  'route_development',
  'final_route',
  'critique',
  'export'
);

create type source_role as enum (
  'context',
  'strategy',
  'inspiration',
  'evaluation',
  'mandatory_rule'
);

create type source_status as enum ('active', 'inactive', 'archived', 'replaced');

create type upload_label as enum (
  'project_context',
  'client_brief',
  'call_transcript',
  'brand_guideline',
  'competitor_reference',
  'creative_reference',
  'research_source',
  'temporary_input',
  'global_source_candidate'
);

create type processing_status as enum ('uploaded', 'processing', 'processed', 'failed');

create type energy_level as enum ('safe', 'sharp', 'bold', 'wild', 'chaos');
create type difficulty_level as enum ('easy', 'moderate', 'complex', 'heavy');
create type idea_status as enum ('active', 'rejected', 'shortlisted', 'merged', 'developed');
create type route_status as enum (
  'shortlisted',
  'developing',
  'final_candidate',
  'final_selected',
  'rejected'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_name text not null,
  client_name text,
  category text,
  market text,
  audience text,
  objective text,
  known_constraints text,
  bravery_level bravery_level default 'Sharp',
  default_model_mode text default 'Balanced',
  default_research_depth text default 'Standard',
  current_stage project_stage not null default 'Intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role message_role not null,
  content text not null,
  message_type message_type not null default 'normal_chat',
  model_used text,
  created_at timestamptz not null default now()
);

create table global_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text,
  file_type text,
  storage_path text,
  source_role source_role not null,
  source_status source_status not null default 'active',
  description text,
  notes text,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  file_type text,
  storage_path text not null,
  upload_label upload_label not null,
  processing_status processing_status not null default 'uploaded',
  summary text,
  promoted_to_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table idea_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_message_id uuid references project_messages(id) on delete set null,
  idea_name text not null,
  one_line_concept text,
  why_it_could_work text,
  possible_expression text,
  what_makes_it_different text,
  watchout text,
  energy_level energy_level,
  difficulty_level difficulty_level,
  status idea_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  route_name text not null,
  campaign_platform text,
  core_thought text,
  audience_tension text,
  brand_role text,
  creative_leap text,
  hero_execution text,
  supporting_executions text,
  proof_needed text,
  risk_notes text,
  feasibility_notes text,
  sellability_notes text,
  route_status route_status not null default 'shortlisted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  default_model_mode text not null default 'Balanced',
  default_research_depth text not null default 'Standard',
  default_bravery_level bravery_level not null default 'Sharp',
  monthly_usage_warning_level integer not null default 80,
  active_model_providers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger touch_users_updated_at
before update on users
for each row execute function touch_updated_at();

create trigger touch_projects_updated_at
before update on projects
for each row execute function touch_updated_at();

create trigger touch_global_sources_updated_at
before update on global_sources
for each row execute function touch_updated_at();

create trigger touch_project_files_updated_at
before update on project_files
for each row execute function touch_updated_at();

create trigger touch_idea_cards_updated_at
before update on idea_cards
for each row execute function touch_updated_at();

create trigger touch_routes_updated_at
before update on routes
for each row execute function touch_updated_at();

create trigger touch_settings_updated_at
before update on settings
for each row execute function touch_updated_at();

create index projects_user_id_idx on projects(user_id);
create index project_messages_project_id_idx on project_messages(project_id);
create index global_sources_source_role_idx on global_sources(source_role);
create index project_files_project_id_idx on project_files(project_id);
create index idea_cards_project_id_idx on idea_cards(project_id);
create index routes_project_id_idx on routes(project_id);
