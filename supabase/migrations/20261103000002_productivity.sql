-- =============================================================================
-- PERSONAL OS · Migración 2 · Productividad
-- Tablas: projects, tasks
-- Decisiones: D-02, D-03, D-04, D-07, D-08, D-09, D-15
-- =============================================================================

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  life_area_id  uuid references public.life_areas (id),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  description   text check (description is null or char_length(description) <= 2000),
  status        text not null default 'active'
                check (status in ('active', 'on_hold', 'completed')),
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  -- Soporta la clave foránea compuesta de tasks (D-03).
  constraint projects_workspace_id_id_key unique (workspace_id, id)
);

comment on table public.projects is 'Proyectos del usuario. Archivado lógico mediante archived_at (DEC-004).';

create index projects_workspace_status_idx
  on public.projects (workspace_id, status)
  where archived_at is null;

create index projects_life_area_idx on public.projects (life_area_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger projects_prevent_workspace_change
  before update on public.projects
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  project_id    uuid,
  life_area_id  uuid references public.life_areas (id),
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  description   text check (description is null or char_length(description) <= 4000),
  status        text not null default 'pending'
                check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  priority      text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,

  -- D-03: la tarea solo puede apuntar a un proyecto de SU MISMO workspace.
  -- Con MATCH SIMPLE (por defecto) la restricción no se evalúa si project_id es NULL (D-15).
  constraint tasks_project_same_workspace_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),

  -- D-09: completed_at existe si y solo si la tarea está completada.
  constraint tasks_completed_at_consistent
    check ((status = 'completed') = (completed_at is not null))
);

comment on table public.tasks is 'Tareas. project_id y life_area_id son opcionales (D-15).';

create index tasks_workspace_status_due_idx
  on public.tasks (workspace_id, status, due_date)
  where archived_at is null;

create index tasks_workspace_project_idx on public.tasks (workspace_id, project_id);
create index tasks_life_area_idx on public.tasks (life_area_id);

-- D-09: completed_at lo gobierna la base de datos, no el cliente.
create or replace function public.sync_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'UPDATE' and old.status = 'completed' and old.completed_at is not null then
      new.completed_at := old.completed_at;
    else
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at
  before insert or update on public.tasks
  for each row execute function public.sync_task_completed_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger tasks_prevent_workspace_change
  before update on public.tasks
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (D-02): sin DELETE; columnas explícitas.
-- id, created_at, updated_at y completed_at no son escribibles por el cliente.
-- -----------------------------------------------------------------------------

revoke all on table public.projects from anon, authenticated;
revoke all on table public.tasks    from anon, authenticated;

grant select on table public.projects to authenticated;
grant insert (workspace_id, life_area_id, name, description, status, due_date)
  on table public.projects to authenticated;
grant update (life_area_id, name, description, status, due_date, archived_at)
  on table public.projects to authenticated;

grant select on table public.tasks to authenticated;
grant insert (workspace_id, project_id, life_area_id, title, description, status, priority, due_date)
  on table public.tasks to authenticated;
grant update (project_id, life_area_id, title, description, status, priority, due_date, archived_at)
  on table public.tasks to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

create policy projects_select_own on public.projects
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy projects_insert_own on public.projects
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy projects_update_own on public.projects
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
