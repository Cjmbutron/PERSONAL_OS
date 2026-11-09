-- Sprint 6 · Automatización (D-94 a D-103)
-- 1) Tareas recurrentes: columnas + función transaccional complete_task.
-- 2) notice_states: estado (leído / descartado) de los avisos, que se calculan al abrir la app.

-- -----------------------------------------------------------------------------
-- Recurrencia de tareas
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column recurrence           text check (recurrence in ('daily', 'weekly', 'monthly')),
  add column recurrence_day       smallint check (recurrence_day between 1 and 31),
  add column recurrence_source_id uuid,
  add constraint tasks_recurrence_needs_due_date check (recurrence is null or due_date is not null),
  add constraint tasks_recurrence_source_fk
    foreign key (workspace_id, recurrence_source_id) references public.tasks (workspace_id, id);

-- Una tarea tiene como máximo UNA sucesora: completar dos veces no duplica (D-96).
create unique index tasks_recurrence_source_key
  on public.tasks (recurrence_source_id) where recurrence_source_id is not null;

-- El día ancla de las tareas mensuales lo fija la base de datos (31 → 28 en febrero → 31 en marzo).
create or replace function public.prepare_task_recurrence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recurrence = 'monthly' then
    if new.recurrence_day is null
       or (tg_op = 'UPDATE' and (old.recurrence is distinct from 'monthly' or old.due_date is distinct from new.due_date)) then
      new.recurrence_day := extract(day from new.due_date)::smallint;
    end if;
  else
    new.recurrence_day := null;
  end if;
  return new;
end;
$$;

create trigger tasks_prepare_recurrence
  before insert or update on public.tasks
  for each row execute function public.prepare_task_recurrence();

-- Próxima fecha de la serie: estrictamente posterior a p_from Y a p_today (D-95).
-- Si completas con retraso, la siguiente cae en el próximo hueco de la serie, no en el pasado.
create or replace function public.next_recurrence_date(p_rec text, p_from date, p_anchor int, p_today date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  d date := p_from;
  m date;
  last_day int;
  i int := 0;
begin
  loop
    i := i + 1;
    if p_rec = 'daily' then
      d := d + 1;
    elsif p_rec = 'weekly' then
      d := d + 7;
    elsif p_rec = 'monthly' then
      m := (date_trunc('month', d::timestamp) + interval '1 month')::date;
      last_day := extract(day from (m + interval '1 month - 1 day'))::int;
      d := m + (least(coalesce(p_anchor, extract(day from p_from)::int), last_day) - 1);
    else
      raise exception 'Recurrencia no válida' using errcode = '22023';
    end if;
    exit when (d > p_today and d > p_from) or i > 1000;
  end loop;
  return d;
end;
$$;

-- Completa una tarea y, si es recurrente, crea la siguiente en la misma transacción (D-94).
-- SECURITY INVOKER: se ejecuta con los permisos y la RLS de quien llama.
create or replace function public.complete_task(p_task_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.tasks%rowtype;
  tz text;
  today date;
  next_id uuid;
begin
  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Tarea no encontrada' using errcode = 'P0002';
  end if;

  update public.tasks set status = 'completed' where id = t.id;

  if t.recurrence is null or t.due_date is null then
    return null;
  end if;
  if exists (select 1 from public.tasks where recurrence_source_id = t.id) then
    return null; -- ya tiene sucesora
  end if;

  select p.timezone into tz
  from public.workspaces w join public.profiles p on p.id = w.owner_id
  where w.id = t.workspace_id;
  today := (now() at time zone coalesce(tz, 'UTC'))::date;

  insert into public.tasks
    (workspace_id, project_id, life_area_id, title, description, priority, due_date,
     recurrence, recurrence_day, recurrence_source_id)
  values
    (t.workspace_id, t.project_id, t.life_area_id, t.title, t.description, t.priority,
     public.next_recurrence_date(t.recurrence, t.due_date, t.recurrence_day, today),
     t.recurrence, t.recurrence_day, t.id)
  returning id into next_id;

  return next_id;
end;
$$;

revoke all on function public.complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated;

-- Permisos de columnas: el cliente elige la recurrencia; el día ancla lo fija el trigger.
grant insert (recurrence, recurrence_day, recurrence_source_id) on table public.tasks to authenticated;
grant update (recurrence) on table public.tasks to authenticated;

-- -----------------------------------------------------------------------------
-- Estado de los avisos (D-98): los avisos NO se guardan; solo si fueron leídos o descartados.
-- notice_key es determinista (p. ej. "task:<id>:<fecha>:overdue"), por lo que cambia cuando cambia la situación.
-- -----------------------------------------------------------------------------
create table public.notice_states (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  notice_key   text not null check (char_length(notice_key) between 1 and 200),
  state        text not null check (state in ('read', 'dismissed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, notice_key)
);

comment on table public.notice_states is 'Avisos leídos o descartados. Los avisos se calculan al abrir la app (D-97, D-98).';

create trigger notice_states_set_updated_at
  before update on public.notice_states
  for each row execute function public.set_updated_at();

create trigger notice_states_prevent_workspace_change
  before update on public.notice_states
  for each row execute function public.prevent_workspace_change();

revoke all on table public.notice_states from anon, authenticated;
grant select, delete on table public.notice_states to authenticated;
grant insert (workspace_id, notice_key, state) on table public.notice_states to authenticated;
grant update (state) on table public.notice_states to authenticated;

alter table public.notice_states enable row level security;

create policy notice_states_select_own on public.notice_states
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy notice_states_insert_own on public.notice_states
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy notice_states_update_own on public.notice_states
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
create policy notice_states_delete_own on public.notice_states
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));
