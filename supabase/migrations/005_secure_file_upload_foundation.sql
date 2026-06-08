alter table global_sources
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists storage_bucket text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists uploaded_by uuid references users(id) on delete set null;

alter table project_sources
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists uploaded_by uuid references users(id) on delete set null;

create index if not exists global_sources_uploaded_by_idx
  on global_sources(uploaded_by);

create index if not exists project_sources_uploaded_by_idx
  on project_sources(uploaded_by);

drop policy if exists "users can manage own project source files" on storage.objects;
create policy "users can manage own project source files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'project-sources'
  and exists (
    select 1 from projects
    where projects.user_id::text = split_part(storage.objects.name, '/', 1)
      and projects.id::text = split_part(storage.objects.name, '/', 2)
      and projects.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-sources'
  and exists (
    select 1 from projects
    where projects.user_id::text = split_part(storage.objects.name, '/', 1)
      and projects.id::text = split_part(storage.objects.name, '/', 2)
      and projects.user_id = auth.uid()
  )
);
