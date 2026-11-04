-- =============================================================================
-- PERSONAL OS · Migración 4 · Sueño (Sprint 2)
-- Tablas: sleep_records · Cambio en profiles: sleep_goal_hours
-- Decisiones: D-21, D-25 a D-29 (docs/03-decisiones-sprint-2.md)
-- =============================================================================

-- Necesaria para la restricción de exclusión (igualdad de uuid + solapamiento de rangos).
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- D-28: meta de horas de sueño en el perfil
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column sleep_goal_hours numeric(3, 1) not null default 8
  constraint profiles_sleep_goal_range check (sleep_goal_hours between 4 and 12);

comment on column public.profiles.sleep_goal_hours is 'Meta de sueño por noche, en horas (D-28). Referencia de los indicadores.';

grant update (sleep_goal_hours) on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- sleep_records
-- -----------------------------------------------------------------------------

create table public.sleep_records (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  bedtime          timestamptz not null,
  wake_time        timestamptz not null,
  -- Día local de despertar (D-26). Lo fija un trigger a partir de profiles.timezone.
  sleep_date       date not null,
  -- D-25: la duración la calcula la base de datos; el cliente no la envía.
  duration_minutes integer generated always as
                     ((extract(epoch from (wake_time - bedtime)) / 60)::integer) stored,
  quality          smallint check (quality between 1 and 5),
  notes            text check (notes is null or char_length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,

  -- D-27
  constraint sleep_records_wake_after_bed check (wake_time > bedtime),
  constraint sleep_records_duration_range
    check (wake_time - bedtime between interval '1 hour' and interval '16 hours'),
  -- Sin solapamiento entre registros vigentes del mismo workspace.
  constraint sleep_records_no_overlap
    exclude using gist (workspace_id with =, tstzrange(bedtime, wake_time) with &&)
    where (archived_at is null)
);

comment on table public.sleep_records is 'Registros de sueño. Una noche por día de despertar (D-26). Archivado lógico (D-21).';

-- D-26: una noche por día de despertar entre los registros no archivados.
create unique index sleep_records_one_per_day
  on public.sleep_records (workspace_id, sleep_date)
  where archived_at is null;

create trigger sleep_records_set_updated_at
  before update on public.sleep_records
  for each row execute function public.set_updated_at();

create trigger sleep_records_prevent_workspace_change
  before update on public.sleep_records
  for each row execute function public.prevent_workspace_change();

-- D-26 y D-27: fija sleep_date con la zona horaria del usuario y rechaza instantes futuros
-- (5 minutos de tolerancia por desfase de reloj). Corre con los privilegios de quien guarda:
-- lee su propio perfil y workspace bajo RLS.
create or replace function public.prepare_sleep_record()
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

  if new.wake_time > now() + interval '5 minutes' then
    raise exception 'No se pueden registrar horas futuras'
      using errcode = '23514';
  end if;

  new.sleep_date := (new.wake_time at time zone coalesce(tz, 'UTC'))::date;
  return new;
end;
$$;

create trigger sleep_records_prepare
  before insert or update of bedtime, wake_time on public.sleep_records
  for each row execute function public.prepare_sleep_record();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (D-02, D-21): sin DELETE; columnas explícitas.
-- sleep_date y duration_minutes no son escribibles por el cliente.
-- -----------------------------------------------------------------------------

revoke all on table public.sleep_records from anon, authenticated;

grant select on table public.sleep_records to authenticated;
grant insert (workspace_id, bedtime, wake_time, quality, notes)
  on table public.sleep_records to authenticated;
grant update (bedtime, wake_time, quality, notes, archived_at)
  on table public.sleep_records to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.sleep_records enable row level security;

create policy sleep_records_select_own on public.sleep_records
  for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy sleep_records_insert_own on public.sleep_records
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)));

create policy sleep_records_update_own on public.sleep_records
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
