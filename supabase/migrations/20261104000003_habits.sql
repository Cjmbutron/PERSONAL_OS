-- =============================================================================
-- PERSONAL OS · Migración 3 · Hábitos (Sprint 2, parte 1)
-- Tablas: habits, habit_logs
-- Decisiones: D-16 a D-20 (docs/02-decisiones-habitos.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- habits
-- -----------------------------------------------------------------------------

create table public.habits (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  life_area_id    uuid references public.life_areas (id),
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  description     text check (description is null or char_length(description) <= 1000),
  frequency_type  text not null
                  check (frequency_type in ('daily', 'days_of_week', 'times_per_week')),
  -- ISO 8601: 1 = lunes … 7 = domingo. Solo para frequency_type = 'days_of_week'.
  days_of_week    smallint[],
  -- Veces por semana (1–7). Solo para frequency_type = 'times_per_week'.
  target_per_week smallint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,

  -- D-16: los campos de frecuencia deben ser coherentes con el tipo elegido.
  constraint habits_frequency_consistent check (
    (frequency_type = 'daily'
       and days_of_week is null and target_per_week is null)
    or
    (frequency_type = 'days_of_week'
       and days_of_week is not null
       and cardinality(days_of_week) between 1 and 7
       and days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
       and target_per_week is null)
    or
    (frequency_type = 'times_per_week'
       and days_of_week is null
       and target_per_week is not null
       and target_per_week between 1 and 7)
  ),

  -- Soporta la clave foránea compuesta de habit_logs (D-03).
  constraint habits_workspace_id_id_key unique (workspace_id, id)
);

comment on table public.habits is 'Definición de hábitos. Archivado lógico mediante archived_at (DEC-004).';

create index habits_workspace_active_idx
  on public.habits (workspace_id, created_at)
  where archived_at is null;

create index habits_life_area_idx on public.habits (life_area_id);

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

create trigger habits_prevent_workspace_change
  before update on public.habits
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- habit_logs: un registro por hábito y fecha (regla 6.4.6)
-- -----------------------------------------------------------------------------

create table public.habit_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  habit_id      uuid not null,
  -- Día de calendario del usuario (D-08): DATE, sin zona horaria.
  log_date      date not null,
  -- D-17: deshacer un cumplimiento = completed = false (el cliente no tiene DELETE).
  completed     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- D-03: el registro solo puede apuntar a un hábito de SU MISMO workspace.
  constraint habit_logs_habit_same_workspace_fk
    foreign key (workspace_id, habit_id)
    references public.habits (workspace_id, id)
    on delete cascade,

  -- Regla 6.4.6: no se admiten dos registros para la misma fecha.
  constraint habit_logs_habit_date_key unique (habit_id, log_date)
);

comment on table public.habit_logs is 'Cumplimiento diario de hábitos. Única por (habit_id, log_date).';

create index habit_logs_workspace_date_idx on public.habit_logs (workspace_id, log_date desc);

create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

create trigger habit_logs_prevent_workspace_change
  before update on public.habit_logs
  for each row execute function public.prevent_workspace_change();

-- D-17: no se registran fechas futuras. "Hoy" es el día del usuario según su zona (D-08).
-- Corre con los privilegios de quien inserta: lee su propio perfil y workspace bajo RLS.
create or replace function public.reject_future_habit_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  user_today date;
begin
  select (now() at time zone p.timezone)::date
    into user_today
  from public.workspaces w
  join public.profiles p on p.id = w.owner_id
  where w.id = new.workspace_id;

  if new.log_date > coalesce(user_today, (now() at time zone 'UTC')::date) then
    raise exception 'No se pueden registrar fechas futuras'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger habit_logs_reject_future
  before insert on public.habit_logs
  for each row execute function public.reject_future_habit_log();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (D-02): sin DELETE; columnas explícitas.
-- log_date y habit_id no son modificables tras la inserción.
-- -----------------------------------------------------------------------------

revoke all on table public.habits     from anon, authenticated;
revoke all on table public.habit_logs from anon, authenticated;

grant select on table public.habits to authenticated;
grant insert (workspace_id, life_area_id, name, description, frequency_type, days_of_week, target_per_week)
  on table public.habits to authenticated;
grant update (life_area_id, name, description, frequency_type, days_of_week, target_per_week, archived_at)
  on table public.habits to authenticated;

grant select on table public.habit_logs to authenticated;
grant insert (workspace_id, habit_id, log_date, completed)
  on table public.habit_logs to authenticated;
grant update (completed)
  on table public.habit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

create policy habits_select_own on public.habits
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy habits_insert_own on public.habits
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy habits_update_own on public.habits
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy habit_logs_select_own on public.habit_logs
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy habit_logs_insert_own on public.habit_logs
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy habit_logs_update_own on public.habit_logs
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
