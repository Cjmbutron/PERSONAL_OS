-- =============================================================================
-- PERSONAL OS · Migración 10 · Calendario, objetivos e hitos (Sprint 4)
-- Tablas: calendar_events, goals, goal_milestones · Vista: goal_progress
-- Decisiones: D-57 a D-64, D-68 (docs/05-decisiones-sprint-4-vida-personal.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Eventos de calendario (D-57 a D-61)
-- -----------------------------------------------------------------------------

create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  life_area_id  uuid references public.life_areas (id),
  title         text not null check (char_length(btrim(title)) between 1 and 150),
  description   text check (description is null or char_length(description) <= 2000),
  location      text check (location is null or char_length(location) <= 200),
  all_day       boolean not null,
  -- Con hora: instantes (D-58).
  starts_at     timestamptz,
  ends_at       timestamptz,
  -- De todo el día: fechas de calendario, fin inclusivo; sin zona horaria (D-58).
  start_date    date,
  end_date      date,
  -- D-61: días locales que cubre el evento; los fija un trigger, no el cliente.
  first_day     date not null,
  last_day      date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,

  constraint calendar_events_workspace_id_id_key unique (workspace_id, id),

  -- D-57 y D-59: exactamente un tipo, con fin no anterior al inicio y duración acotada.
  constraint calendar_events_shape check (
    (
      all_day
      and start_date is not null and end_date is not null
      and starts_at is null and ends_at is null
      and end_date >= start_date
      and end_date - start_date <= 30
    ) or (
      not all_day
      and starts_at is not null and ends_at is not null
      and start_date is null and end_date is null
      and ends_at >= starts_at
      and ends_at - starts_at <= interval '14 days'
    )
  )
);

comment on table public.calendar_events is 'Eventos con hora o de todo el día. first_day/last_day los fija un trigger (D-61). Archivado lógico.';

create index calendar_events_workspace_days_idx
  on public.calendar_events (workspace_id, first_day, last_day)
  where archived_at is null;
create index calendar_events_life_area_idx on public.calendar_events (life_area_id);

create or replace function public.set_event_days()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  if new.all_day then
    new.first_day := new.start_date;
    new.last_day := new.end_date;
  else
    select p.timezone into tz
    from public.workspaces w
    join public.profiles p on p.id = w.owner_id
    where w.id = new.workspace_id;
    tz := coalesce(tz, 'UTC');
    new.first_day := (new.starts_at at time zone tz)::date;
    new.last_day := (new.ends_at at time zone tz)::date;
  end if;
  return new;
end;
$$;

revoke all on function public.set_event_days() from public, anon, authenticated;

-- first_day y last_day son NOT NULL y se recalculan en cada inserción o actualización.
create trigger calendar_events_set_days
  before insert or update on public.calendar_events
  for each row execute function public.set_event_days();

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();
create trigger calendar_events_prevent_workspace_change
  before update on public.calendar_events
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Objetivos (D-62 a D-64)
-- -----------------------------------------------------------------------------

create table public.goals (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  life_area_id     uuid references public.life_areas (id),
  title            text not null check (char_length(btrim(title)) between 1 and 150),
  description      text check (description is null or char_length(description) <= 2000),
  target_date      date,
  status           text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  -- Se usa solo cuando el objetivo no tiene hitos (D-68).
  manual_progress  smallint not null default 0 check (manual_progress between 0 and 100),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,

  constraint goals_workspace_id_id_key unique (workspace_id, id),
  -- D-63: completed_at existe si y solo si el objetivo está completado.
  constraint goals_completed_at_consistent check ((status = 'completed') = (completed_at is not null))
);

comment on table public.goals is 'Objetivos transversales a las dimensiones (D-64). Archivado lógico.';

create index goals_workspace_status_idx on public.goals (workspace_id, status) where archived_at is null;
create index goals_life_area_idx on public.goals (life_area_id);

create or replace function public.sync_goal_completed_at()
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

create trigger goals_sync_completed_at
  before insert or update on public.goals
  for each row execute function public.sync_goal_completed_at();
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();
create trigger goals_prevent_workspace_change
  before update on public.goals
  for each row execute function public.prevent_workspace_change();

-- Hitos de un objetivo (D-68): tabla de composición.
create table public.goal_milestones (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  goal_id       uuid not null,
  position      integer not null default 0 check (position >= 0),
  title         text not null check (char_length(btrim(title)) between 1 and 150),
  done          boolean not null default false,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),

  constraint goal_milestones_goal_fk
    foreign key (workspace_id, goal_id) references public.goals (workspace_id, id),
  constraint goal_milestones_done_at_consistent check (done = (done_at is not null))
);

create index goal_milestones_goal_idx on public.goal_milestones (goal_id, position);

create or replace function public.prepare_goal_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into n from public.goal_milestones where goal_id = new.goal_id;
    if n >= 50 then
      raise exception 'Un objetivo admite como máximo 50 hitos' using errcode = '23514';
    end if;
  end if;

  if new.done then
    if tg_op = 'UPDATE' and old.done and old.done_at is not null then
      new.done_at := old.done_at;
    else
      new.done_at := now();
    end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger goal_milestones_prepare
  before insert or update on public.goal_milestones
  for each row execute function public.prepare_goal_milestone();
create trigger goal_milestones_prevent_workspace_change
  before update on public.goal_milestones
  for each row execute function public.prevent_workspace_change();

-- Avance por objetivo (D-68). security_invoker: se aplica la RLS de quien consulta.
create view public.goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.workspace_id,
  count(m.id)::integer as milestones_total,
  (count(m.id) filter (where m.done))::integer as milestones_done
from public.goals g
left join public.goal_milestones m on m.workspace_id = g.workspace_id and m.goal_id = g.id
group by g.id, g.workspace_id;

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos. Sin DELETE salvo en los hitos (tabla de composición, D-39).
-- -----------------------------------------------------------------------------

revoke all on table public.calendar_events  from anon, authenticated;
revoke all on table public.goals            from anon, authenticated;
revoke all on table public.goal_milestones  from anon, authenticated;
revoke all on table public.goal_progress    from anon, authenticated;

grant select on table public.calendar_events to authenticated;
grant insert (workspace_id, life_area_id, title, description, location, all_day, starts_at, ends_at, start_date, end_date)
  on table public.calendar_events to authenticated;
grant update (life_area_id, title, description, location, all_day, starts_at, ends_at, start_date, end_date, archived_at)
  on table public.calendar_events to authenticated;

grant select on table public.goals to authenticated;
grant insert (workspace_id, life_area_id, title, description, target_date, status, manual_progress)
  on table public.goals to authenticated;
grant update (life_area_id, title, description, target_date, status, manual_progress, archived_at)
  on table public.goals to authenticated;

grant select, delete on table public.goal_milestones to authenticated;
grant insert (workspace_id, goal_id, position, title, done) on table public.goal_milestones to authenticated;
grant update (position, title, done) on table public.goal_milestones to authenticated;

grant select on table public.goal_progress to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.calendar_events enable row level security;
alter table public.goals           enable row level security;
alter table public.goal_milestones enable row level security;

create policy calendar_events_select_own on public.calendar_events
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy calendar_events_insert_own on public.calendar_events
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy calendar_events_update_own on public.calendar_events
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy goals_select_own on public.goals
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy goals_insert_own on public.goals
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy goals_update_own on public.goals
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy goal_milestones_select_own on public.goal_milestones
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy goal_milestones_insert_own on public.goal_milestones
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy goal_milestones_update_own on public.goal_milestones
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
create policy goal_milestones_delete_own on public.goal_milestones
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));
