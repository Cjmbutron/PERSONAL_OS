-- Sprint 5 · Revisión y planificación semanal (D-71 a D-78)
-- Tablas: weekly_reviews (una por semana, lunes a domingo) y weekly_priorities (hasta 5 por semana).

-- Necesario para vincular prioridades a tareas del mismo workspace con clave compuesta (D-03).
alter table public.tasks add constraint tasks_workspace_id_id_key unique (workspace_id, id);

-- -----------------------------------------------------------------------------
-- Revisiones semanales
-- -----------------------------------------------------------------------------
create table public.weekly_reviews (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  -- Lunes de la semana revisada (D-71).
  week_start    date not null check (extract(isodow from week_start) = 1),
  status        text not null default 'draft' check (status in ('draft', 'completed')),
  went_well     text check (went_well is null or char_length(went_well) <= 2000),
  to_improve    text check (to_improve is null or char_length(to_improve) <= 2000),
  learnings     text check (learnings is null or char_length(learnings) <= 2000),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint weekly_reviews_workspace_week_key unique (workspace_id, week_start),
  constraint weekly_reviews_completed_at_consistent check ((status = 'completed') = (completed_at is not null))
);

comment on table public.weekly_reviews is 'Una revisión por semana ISO (lunes a domingo). Editable siempre (D-72). Sin borrado.';

-- completed_at lo fija el servidor; no se admiten revisiones de semanas futuras (D-71).
create or replace function public.prepare_weekly_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  this_monday date;
begin
  if tg_op = 'INSERT' then
    select p.timezone into tz
    from public.workspaces w
    join public.profiles p on p.id = w.owner_id
    where w.id = new.workspace_id;
    this_monday := date_trunc('week', (now() at time zone coalesce(tz, 'UTC'))::timestamp)::date;
    if new.week_start > this_monday then
      raise exception 'No se puede revisar una semana que aún no empieza' using errcode = '23514';
    end if;
  end if;

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

revoke all on function public.prepare_weekly_review() from public, anon, authenticated;

create trigger weekly_reviews_prepare
  before insert or update on public.weekly_reviews
  for each row execute function public.prepare_weekly_review();
create trigger weekly_reviews_set_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();
create trigger weekly_reviews_prevent_workspace_change
  before update on public.weekly_reviews
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Prioridades de la semana (D-73, D-74). Tabla de composición: admite DELETE (D-39).
-- -----------------------------------------------------------------------------
create table public.weekly_priorities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  -- Lunes de la semana a la que aplica la prioridad.
  week_start    date not null check (extract(isodow from week_start) = 1),
  position      integer not null default 0 check (position >= 0),
  title         text not null check (char_length(btrim(title)) between 1 and 150),
  done          boolean not null default false,
  done_at       timestamptz,
  -- Vínculos opcionales (D-74): solo del mismo workspace por clave compuesta.
  task_id       uuid,
  goal_id       uuid,
  created_at    timestamptz not null default now(),

  constraint weekly_priorities_done_at_consistent check (done = (done_at is not null)),
  constraint weekly_priorities_task_fk
    foreign key (workspace_id, task_id) references public.tasks (workspace_id, id),
  constraint weekly_priorities_goal_fk
    foreign key (workspace_id, goal_id) references public.goals (workspace_id, id)
);

create index weekly_priorities_week_idx on public.weekly_priorities (workspace_id, week_start, position);

create or replace function public.prepare_weekly_priority()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into n
    from public.weekly_priorities
    where workspace_id = new.workspace_id and week_start = new.week_start;
    if n >= 5 then
      raise exception 'Una semana admite como máximo 5 prioridades' using errcode = '23514';
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

create trigger weekly_priorities_prepare
  before insert or update on public.weekly_priorities
  for each row execute function public.prepare_weekly_priority();
create trigger weekly_priorities_prevent_workspace_change
  before update on public.weekly_priorities
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.weekly_reviews    from anon, authenticated;
revoke all on table public.weekly_priorities from anon, authenticated;

grant select on table public.weekly_reviews to authenticated;
grant insert (workspace_id, week_start, status, went_well, to_improve, learnings) on table public.weekly_reviews to authenticated;
grant update (status, went_well, to_improve, learnings) on table public.weekly_reviews to authenticated;

grant select, delete on table public.weekly_priorities to authenticated;
grant insert (workspace_id, week_start, position, title, task_id, goal_id) on table public.weekly_priorities to authenticated;
grant update (position, title, done) on table public.weekly_priorities to authenticated;

alter table public.weekly_reviews    enable row level security;
alter table public.weekly_priorities enable row level security;

create policy weekly_reviews_select_own on public.weekly_reviews
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy weekly_reviews_insert_own on public.weekly_reviews
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy weekly_reviews_update_own on public.weekly_reviews
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy weekly_priorities_select_own on public.weekly_priorities
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy weekly_priorities_insert_own on public.weekly_priorities
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy weekly_priorities_update_own on public.weekly_priorities
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
create policy weekly_priorities_delete_own on public.weekly_priorities
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));
