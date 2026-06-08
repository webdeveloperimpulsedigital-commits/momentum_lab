do $$
begin
  if not exists (select 1 from pg_type where typname = 'knowledge_source_type') then
    create type knowledge_source_type as enum (
      'text',
      'markdown',
      'pdf',
      'docx',
      'image',
      'url',
      'note',
      'transcript',
      'other'
    );
  end if;
end $$;

alter table global_sources
  add column if not exists source_type knowledge_source_type not null default 'text',
  add column if not exists tags text[] not null default '{}',
  add column if not exists source_url text,
  add column if not exists content_text text;

create table if not exists project_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  source_role source_role not null default 'context',
  source_type knowledge_source_type not null default 'text',
  tags text[] not null default '{}',
  source_status source_status not null default 'active',
  source_url text,
  content_text text,
  file_name text,
  file_type text,
  storage_bucket text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_project_sources_updated_at
before update on project_sources
for each row execute function touch_updated_at();

alter table project_sources enable row level security;

drop policy if exists "users can read own project sources" on project_sources;
create policy "users can read own project sources"
on project_sources for select
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_sources.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own project sources" on project_sources;
create policy "users can manage own project sources"
on project_sources for all
to authenticated
using (
  exists (
    select 1 from projects
    where projects.id = project_sources.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from projects
    where projects.id = project_sources.project_id
      and projects.user_id = auth.uid()
  )
);

create index if not exists project_sources_project_updated_idx
  on project_sources(project_id, updated_at desc);

create index if not exists project_sources_role_status_idx
  on project_sources(project_id, source_role, source_status);

create index if not exists global_sources_role_status_type_idx
  on global_sources(source_role, source_status, source_type);

drop policy if exists "admins can manage global source files" on storage.objects;
create policy "admins can manage global source files"
on storage.objects for all
to authenticated
using (bucket_id = 'global-sources' and public.is_momentum_admin())
with check (bucket_id = 'global-sources' and public.is_momentum_admin());

drop policy if exists "users can manage own project source files" on storage.objects;
create policy "users can manage own project source files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'project-sources'
  and exists (
    select 1 from projects
    where projects.id::text = split_part(storage.objects.name, '/', 1)
      and projects.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-sources'
  and exists (
    select 1 from projects
    where projects.id::text = split_part(storage.objects.name, '/', 1)
      and projects.user_id = auth.uid()
  )
);
