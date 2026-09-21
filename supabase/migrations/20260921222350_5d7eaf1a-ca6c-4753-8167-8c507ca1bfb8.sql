-- 1) Security definer helpers
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'admin_staff')
$$;

create or replace function public.owns_project(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = _project_id
      and (p.owner_id = auth.uid() or public.is_admin())
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.owns_project(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.owns_project(uuid) to authenticated, service_role;

-- 2) projects
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- 3) all project-scoped tables
do $$
declare t text;
begin
  foreach t in array array[
    'artifacts','checkpoints','constitution_rule_history','constitution_rules',
    'constitution_sections','constitutions','execution_logs','execution_position',
    'phases','project_decisions','project_description','project_description_history',
    'project_execution_summary','resume_packages','state_conflicts','task_artifacts',
    'task_changes','task_constitution_rules','task_cycles','task_dependencies',
    'task_executions','task_relations','tasks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id))',
      t || '_rw', t);
  end loop;
end $$;

-- 4) profiles
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 5) user_roles (no self-service role grants)
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
drop policy if exists user_roles_select on public.user_roles;
drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_roles_admin_all on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 6) remove duplicated unused severity type
drop type if exists public.rule_severity;
