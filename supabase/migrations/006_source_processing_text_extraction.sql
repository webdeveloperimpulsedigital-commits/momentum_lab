do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_processing_status') then
    create type source_processing_status as enum (
      'not_processed',
      'queued',
      'processing',
      'processed',
      'failed',
      'unsupported'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'source_scope') then
    create type source_scope as enum ('global', 'project');
  end if;
end $$;

alter table global_sources
  add column if not exists processing_status source_processing_status not null default 'not_processed',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists extracted_text_available boolean not null default false,
  add column if not exists extracted_character_count integer not null default 0,
  add column if not exists detected_source_type text;

alter table project_sources
  add column if not exists processing_status source_processing_status not null default 'not_processed',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists extracted_text_available boolean not null default false,
  add column if not exists extracted_character_count integer not null default 0,
  add column if not exists detected_source_type text;

create table if not exists source_contents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  source_scope source_scope not null,
  project_id uuid references projects(id) on delete cascade,
  extracted_text text not null default '',
  extraction_method text not null,
  character_count integer not null default 0,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_by uuid references users(id) on delete set null,
  unique(source_id, source_scope)
);

create table if not exists source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  source_scope source_scope not null,
  project_id uuid references projects(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  character_count integer not null default 0,
  token_estimate integer not null default 0,
  created_at timestamptz not null default now(),
  unique(source_id, source_scope, chunk_index)
);

create trigger touch_source_contents_updated_at
before update on source_contents
for each row execute function touch_updated_at();

alter table source_contents enable row level security;
alter table source_chunks enable row level security;

drop policy if exists "users can read own project source contents" on source_contents;
create policy "users can read own project source contents"
on source_contents for select
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_contents.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

drop policy if exists "users can manage own project source contents" on source_contents;
create policy "users can manage own project source contents"
on source_contents for all
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_contents.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
)
with check (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_contents.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

drop policy if exists "users can read own project source chunks" on source_chunks;
create policy "users can read own project source chunks"
on source_chunks for select
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunks.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

drop policy if exists "users can manage own project source chunks" on source_chunks;
create policy "users can manage own project source chunks"
on source_chunks for all
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunks.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
)
with check (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunks.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

create index if not exists source_contents_source_idx
  on source_contents(source_scope, source_id);

create index if not exists source_contents_project_idx
  on source_contents(project_id);

create index if not exists source_chunks_source_idx
  on source_chunks(source_scope, source_id, chunk_index);

create index if not exists source_chunks_project_idx
  on source_chunks(project_id);
