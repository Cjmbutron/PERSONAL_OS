-- =============================================================================
-- PERSONAL OS · Migración 5 · Alimentación (Sprint 2)
-- Tablas: meal_logs
-- Decisiones: D-21, D-30, D-31, D-32 (docs/03-decisiones-sprint-2.md)
-- =============================================================================

create table public.meal_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  meal_type     text not null
                check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at      timestamptz not null,
  -- D-31: día local de eaten_at. Lo fija un trigger a partir de profiles.timezone.
  eaten_date    date not null,
  description   text not null check (char_length(btrim(description)) between 1 and 500),
  -- D-30: datos nutricionales opcionales; NULL = "no lo sé", distinto de 0.
  calories      integer check (calories is null or calories between 0 and 10000),
  protein_g     numeric(6, 1) check (protein_g is null or protein_g between 0 and 2000),
  carbs_g       numeric(6, 1) check (carbs_g is null or carbs_g between 0 and 2000),
  fat_g         numeric(6, 1) check (fat_g is null or fat_g between 0 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

comment on table public.meal_logs is 'Registro de comidas. Sin metas ni recomendaciones nutricionales (D-32). Archivado lógico (D-21).';
comment on column public.meal_logs.eaten_date is 'Día local de eaten_at según profiles.timezone (D-31). Lo fija un trigger.';

-- Consulta principal: comidas de un día, y el historial por rango de días.
create index meal_logs_workspace_date_idx
  on public.meal_logs (workspace_id, eaten_date desc, eaten_at)
  where archived_at is null;

create trigger meal_logs_set_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

create trigger meal_logs_prevent_workspace_change
  before update on public.meal_logs
  for each row execute function public.prevent_workspace_change();

-- D-31: fija eaten_date con la zona horaria del usuario y rechaza instantes futuros
-- (5 minutos de tolerancia por desfase de reloj). Corre con los privilegios de quien guarda:
-- lee su propio perfil y workspace bajo RLS.
create or replace function public.prepare_meal_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tz text;
begin
  select p.timezone
    into tz
  from public.workspaces w
  join public.profiles p on p.id = w.owner_id
  where w.id = new.workspace_id;

  if new.eaten_at > now() + interval '5 minutes' then
    raise exception 'No se pueden registrar comidas en el futuro'
      using errcode = '23514';
  end if;

  new.eaten_date := (new.eaten_at at time zone coalesce(tz, 'UTC'))::date;
  return new;
end;
$$;

create trigger meal_logs_prepare
  before insert or update of eaten_at on public.meal_logs
  for each row execute function public.prepare_meal_log();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (D-02, D-21): sin DELETE; columnas explícitas.
-- eaten_date no es escribible por el cliente.
-- -----------------------------------------------------------------------------

revoke all on table public.meal_logs from anon, authenticated;

grant select on table public.meal_logs to authenticated;
grant insert (workspace_id, meal_type, eaten_at, description, calories, protein_g, carbs_g, fat_g)
  on table public.meal_logs to authenticated;
grant update (meal_type, eaten_at, description, calories, protein_g, carbs_g, fat_g, archived_at)
  on table public.meal_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.meal_logs enable row level security;

create policy meal_logs_select_own on public.meal_logs
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy meal_logs_insert_own on public.meal_logs
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy meal_logs_update_own on public.meal_logs
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
