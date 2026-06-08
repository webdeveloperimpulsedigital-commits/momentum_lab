alter table users enable row level security;
alter table projects enable row level security;
alter table project_messages enable row level security;
alter table global_sources enable row level security;
alter table project_files enable row level security;
alter table idea_cards enable row level security;
alter table routes enable row level security;
alter table settings enable row level security;

create or replace function is_momentum_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from users
    where users.id = auth.uid()
      and users.role = 'admin'
  );
$$;

drop policy if exists "users can read own profile" on users;
create policy "users can read own profile"
on users for select
to authenticated
using (id = auth.uid());

drop policy if exists "users can insert own profile" on users;
create policy "users can insert own profile"
on users for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users can update own profile" on users;
create policy "users can update own profile"
on users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can manage own projects" on projects;
create policy "users can manage own projects"
on projects for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own project messages" on project_messages;
create policy "users can read own project messages"
on project_messages for select
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = project_messages.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own project messages" on project_messages;
create policy "users can insert own project messages"
on project_messages for insert
to authenticated
with check (
  exists (
    select 1
    from projects
    where projects.id = project_messages.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own project files" on project_files;
create policy "users can read own project files"
on project_files for select
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own project files" on project_files;
create policy "users can manage own project files"
on project_files for all
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own idea cards" on idea_cards;
create policy "users can read own idea cards"
on idea_cards for select
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = idea_cards.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own idea cards" on idea_cards;
create policy "users can manage own idea cards"
on idea_cards for all
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = idea_cards.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects
    where projects.id = idea_cards.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can read own routes" on routes;
create policy "users can read own routes"
on routes for select
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = routes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own routes" on routes;
create policy "users can manage own routes"
on routes for all
to authenticated
using (
  exists (
    select 1
    from projects
    where projects.id = routes.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects
    where projects.id = routes.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "admins can manage global sources" on global_sources;
create policy "admins can manage global sources"
on global_sources for all
to authenticated
using (is_momentum_admin())
with check (is_momentum_admin());

drop policy if exists "admins can manage settings" on settings;
create policy "admins can manage settings"
on settings for all
to authenticated
using (is_momentum_admin())
with check (is_momentum_admin());

create index if not exists users_role_idx on users(role);
create index if not exists projects_user_updated_idx on projects(user_id, updated_at desc);
create index if not exists project_messages_project_created_idx
  on project_messages(project_id, created_at asc);
create index if not exists project_files_project_status_idx
  on project_files(project_id, processing_status);
create index if not exists idea_cards_project_status_idx
  on idea_cards(project_id, status);
create index if not exists routes_project_status_idx
  on routes(project_id, route_status);
create index if not exists global_sources_role_status_idx
  on global_sources(source_role, source_status);
