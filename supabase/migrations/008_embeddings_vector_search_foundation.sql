create extension if not exists vector;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_embedding_status') then
    create type source_embedding_status as enum (
      'not_embedded',
      'queued',
      'embedding',
      'embedded',
      'failed',
      'skipped'
    );
  end if;
end $$;

alter table global_sources
  add column if not exists embedding_status source_embedding_status not null default 'not_embedded',
  add column if not exists embedding_error text,
  add column if not exists embedded_chunk_count integer not null default 0,
  add column if not exists failed_embedding_count integer not null default 0,
  add column if not exists last_embedded_at timestamptz,
  add column if not exists embedding_model text;

alter table project_sources
  add column if not exists embedding_status source_embedding_status not null default 'not_embedded',
  add column if not exists embedding_error text,
  add column if not exists embedded_chunk_count integer not null default 0,
  add column if not exists failed_embedding_count integer not null default 0,
  add column if not exists last_embedded_at timestamptz,
  add column if not exists embedding_model text;

create table if not exists source_chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references source_chunks(id) on delete cascade,
  source_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  source_scope source_scope not null,
  embedding vector(1536) not null,
  embedding_provider text not null,
  embedding_model text not null,
  embedding_dimensions integer not null,
  embedding_status source_embedding_status not null default 'embedded',
  embedding_error text,
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chunk_id, embedding_provider, embedding_model, embedding_dimensions)
);

drop trigger if exists touch_source_chunk_embeddings_updated_at on source_chunk_embeddings;
create trigger touch_source_chunk_embeddings_updated_at
before update on source_chunk_embeddings
for each row execute function touch_updated_at();

alter table source_chunk_embeddings enable row level security;

drop policy if exists "users can read own project chunk embeddings" on source_chunk_embeddings;
create policy "users can read own project chunk embeddings"
on source_chunk_embeddings for select
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunk_embeddings.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

drop policy if exists "users can manage own project chunk embeddings" on source_chunk_embeddings;
create policy "users can manage own project chunk embeddings"
on source_chunk_embeddings for all
to authenticated
using (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunk_embeddings.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
)
with check (
  (source_scope = 'project' and exists (
    select 1 from projects
    where projects.id = source_chunk_embeddings.project_id
      and projects.user_id = auth.uid()
  ))
  or (source_scope = 'global' and public.is_momentum_admin())
);

create index if not exists source_chunk_embeddings_chunk_idx
  on source_chunk_embeddings(chunk_id);

create index if not exists source_chunk_embeddings_scope_project_idx
  on source_chunk_embeddings(source_scope, project_id, source_id);

create index if not exists source_chunk_embeddings_vector_idx
  on source_chunk_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_source_chunk_embeddings(
  query_embedding vector(1536),
  match_scope text,
  match_project_id uuid,
  match_source_role text,
  match_source_type text,
  allow_global boolean,
  match_limit integer
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_scope text,
  project_id uuid,
  source_title text,
  source_role text,
  source_type text,
  source_status text,
  chunk_index integer,
  chunk_text text,
  character_count integer,
  token_estimate integer,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
as $$
  with project_matches as (
    select
      c.id as chunk_id,
      c.source_id,
      c.source_scope::text,
      c.project_id,
      ps.title as source_title,
      ps.source_role::text,
      ps.source_type::text,
      ps.source_status::text,
      c.chunk_index,
      c.chunk_text,
      c.character_count,
      c.token_estimate,
      1 - (e.embedding <=> query_embedding) as similarity,
      c.created_at
    from source_chunk_embeddings e
    join source_chunks c on c.id = e.chunk_id
    join project_sources ps on ps.id = c.source_id and ps.project_id = c.project_id
    where c.source_scope = 'project'
      and (match_scope in ('project', 'combined'))
      and c.project_id = match_project_id
      and ps.source_status = 'active'
      and ps.processing_status = 'processed'
      and (match_source_role is null or ps.source_role::text = match_source_role)
      and (match_source_type is null or ps.source_type::text = match_source_type)
  ),
  global_matches as (
    select
      c.id as chunk_id,
      c.source_id,
      c.source_scope::text,
      c.project_id,
      gs.title as source_title,
      gs.source_role::text,
      gs.source_type::text,
      gs.source_status::text,
      c.chunk_index,
      c.chunk_text,
      c.character_count,
      c.token_estimate,
      1 - (e.embedding <=> query_embedding) as similarity,
      c.created_at
    from source_chunk_embeddings e
    join source_chunks c on c.id = e.chunk_id
    join global_sources gs on gs.id = c.source_id
    where c.source_scope = 'global'
      and (match_scope in ('global', 'combined'))
      and gs.source_status = 'active'
      and gs.processing_status = 'processed'
      and allow_global
      and (match_source_role is null or gs.source_role::text = match_source_role)
      and (match_source_type is null or gs.source_type::text = match_source_type)
  )
  select * from (
    select * from project_matches
    union all
    select * from global_matches
  ) matches
  order by similarity desc
  limit least(greatest(match_limit, 1), 20);
$$;
