-- =============================================================================
-- PERSONAL OS · Migración 6 · Entrenamiento y rutinas mensuales (Sprint 2)
-- Tablas: workout_routines, routine_exercises, workout_sessions,
--         workout_exercises, workout_sets
-- Funciones: save_workout_session, save_workout_routine, duplicate_workout_routine
-- Decisiones: D-21, D-33 a D-39 (docs/03-decisiones-sprint-2.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rutinas mensuales (D-34)
-- -----------------------------------------------------------------------------

create table public.workout_routines (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  description   text check (description is null or char_length(description) <= 1000),
  -- Primer día del mes calendario al que pertenece la rutina.
  period_month  date not null check (extract(day from period_month) = 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  -- Soporta las claves foráneas compuestas (D-03, D-38).
  constraint workout_routines_workspace_id_id_key unique (workspace_id, id)
);

comment on table public.workout_routines is 'Rutina de entrenamiento de un mes calendario (D-34). Archivado lógico (D-21).';

-- D-34: una rutina activa por mes. Archivar libera el mes.
create unique index workout_routines_one_per_month
  on public.workout_routines (workspace_id, period_month)
  where archived_at is null;

create trigger workout_routines_set_updated_at
  before update on public.workout_routines
  for each row execute function public.set_updated_at();

create trigger workout_routines_prevent_workspace_change
  before update on public.workout_routines
  for each row execute function public.prevent_workspace_change();

-- Ejercicios planificados de una rutina (D-35).
create table public.routine_exercises (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  routine_id        uuid not null,
  -- ISO 8601: 1 = lunes … 7 = domingo.
  day_of_week       smallint not null check (day_of_week between 1 and 7),
  position          smallint not null check (position between 1 and 500),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  target_sets       smallint not null check (target_sets between 1 and 20),
  target_reps       smallint not null check (target_reps between 1 and 1000),
  target_weight_kg  numeric(6, 1) check (target_weight_kg is null or target_weight_kg between 0 and 1000),
  notes             text check (notes is null or char_length(notes) <= 500),
  created_at        timestamptz not null default now(),

  constraint routine_exercises_routine_same_workspace_fk
    foreign key (workspace_id, routine_id)
    references public.workout_routines (workspace_id, id)
    on delete cascade
);

create index routine_exercises_routine_idx on public.routine_exercises (routine_id, day_of_week, position);

-- -----------------------------------------------------------------------------
-- Lo entrenado: sesiones → ejercicios → series (D-33)
-- -----------------------------------------------------------------------------

create table public.workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  -- D-37: rutina y día de la rutina desde los que se entrenó (opcionales).
  routine_id        uuid,
  routine_day       smallint check (routine_day is null or routine_day between 1 and 7),
  started_at        timestamptz not null,
  -- Día local de started_at (D-22). Lo fija un trigger a partir de profiles.timezone.
  started_date      date not null,
  type              text not null
                    check (type in ('strength', 'cardio', 'mobility', 'sport', 'other')),
  duration_minutes  integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  -- Esfuerzo percibido (RPE) de 1 a 10.
  rpe               smallint check (rpe is null or rpe between 1 and 10),
  notes             text check (notes is null or char_length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,

  constraint workout_sessions_workspace_id_id_key unique (workspace_id, id),
  -- D-38: la sesión solo puede apuntar a una rutina de SU MISMO workspace.
  constraint workout_sessions_routine_same_workspace_fk
    foreign key (workspace_id, routine_id)
    references public.workout_routines (workspace_id, id)
);

comment on table public.workout_sessions is 'Sesiones de entrenamiento. Archivado lógico (D-21).';

create index workout_sessions_workspace_date_idx
  on public.workout_sessions (workspace_id, started_date desc)
  where archived_at is null;

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create trigger workout_sessions_prevent_workspace_change
  before update on public.workout_sessions
  for each row execute function public.prevent_workspace_change();

create or replace function public.prepare_workout_session()
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

  if new.started_at > now() + interval '5 minutes' then
    raise exception 'No se pueden registrar entrenamientos en el futuro'
      using errcode = '23514';
  end if;

  new.started_date := (new.started_at at time zone coalesce(tz, 'UTC'))::date;
  return new;
end;
$$;

create trigger workout_sessions_prepare
  before insert or update of started_at on public.workout_sessions
  for each row execute function public.prepare_workout_session();

create table public.workout_exercises (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  session_id    uuid not null,
  position      smallint not null check (position between 1 and 500),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  notes         text check (notes is null or char_length(notes) <= 500),
  -- Solo cardio: ambos opcionales.
  distance_km   numeric(6, 2) check (distance_km is null or distance_km between 0 and 1000),
  duration_min  integer check (duration_min is null or duration_min between 1 and 1440),
  created_at    timestamptz not null default now(),

  constraint workout_exercises_workspace_id_id_key unique (workspace_id, id),
  constraint workout_exercises_session_same_workspace_fk
    foreign key (workspace_id, session_id)
    references public.workout_sessions (workspace_id, id)
    on delete cascade
);

create index workout_exercises_session_idx on public.workout_exercises (session_id, position);

-- D-33: una fila por serie, para registrar 80 kg × 5 y luego 85 kg × 3.
create table public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  exercise_id   uuid not null,
  set_number    smallint not null check (set_number between 1 and 200),
  reps          smallint not null check (reps between 1 and 1000),
  -- NULL = peso corporal / sin carga.
  weight_kg     numeric(6, 1) check (weight_kg is null or weight_kg between 0 and 1000),
  created_at    timestamptz not null default now(),

  constraint workout_sets_exercise_same_workspace_fk
    foreign key (workspace_id, exercise_id)
    references public.workout_exercises (workspace_id, id)
    on delete cascade,
  constraint workout_sets_exercise_number_key unique (exercise_id, set_number)
);

-- -----------------------------------------------------------------------------
-- Funciones transaccionales (6.5: no depender de varias escrituras desde el navegador).
-- SECURITY INVOKER: corren con los privilegios y la RLS de quien las llama.
-- Editar = reemplazar los hijos (ejercicios y series) dentro de una sola transacción.
-- -----------------------------------------------------------------------------

create or replace function public.save_workout_session(
  p_workspace_id     uuid,
  p_id               uuid,
  p_routine_id       uuid,
  p_routine_day      smallint,
  p_started_at       timestamptz,
  p_type             text,
  p_duration_minutes integer,
  p_rpe              smallint,
  p_notes            text,
  p_exercises        jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id    uuid;
  v_ex_id uuid;
  ex      record;
  st      record;
begin
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'p_exercises debe ser un arreglo JSON' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.workout_sessions
      (workspace_id, routine_id, routine_day, started_at, type, duration_minutes, rpe, notes)
    values
      (p_workspace_id, p_routine_id, p_routine_day, p_started_at, p_type, p_duration_minutes, p_rpe, p_notes)
    returning id into v_id;
  else
    update public.workout_sessions
       set routine_id = p_routine_id,
           routine_day = p_routine_day,
           started_at = p_started_at,
           type = p_type,
           duration_minutes = p_duration_minutes,
           rpe = p_rpe,
           notes = p_notes
     where id = p_id and workspace_id = p_workspace_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Sesión no encontrada' using errcode = 'P0002';
    end if;

    -- Las series caen por ON DELETE CASCADE.
    delete from public.workout_exercises
     where session_id = v_id and workspace_id = p_workspace_id;
  end if;

  for ex in
    select e.value, e.ordinality
    from jsonb_array_elements(p_exercises) with ordinality as e(value, ordinality)
  loop
    insert into public.workout_exercises
      (workspace_id, session_id, position, name, notes, distance_km, duration_min)
    values (
      p_workspace_id, v_id, ex.ordinality::smallint,
      ex.value ->> 'name',
      nullif(ex.value ->> 'notes', ''),
      (ex.value ->> 'distance_km')::numeric,
      (ex.value ->> 'duration_min')::integer
    )
    returning id into v_ex_id;

    for st in
      select s.value, s.ordinality
      from jsonb_array_elements(coalesce(ex.value -> 'sets', '[]'::jsonb)) with ordinality as s(value, ordinality)
    loop
      insert into public.workout_sets (workspace_id, exercise_id, set_number, reps, weight_kg)
      values (
        p_workspace_id, v_ex_id, st.ordinality::smallint,
        (st.value ->> 'reps')::smallint,
        (st.value ->> 'weight_kg')::numeric
      );
    end loop;
  end loop;

  return v_id;
end;
$$;

create or replace function public.save_workout_routine(
  p_workspace_id uuid,
  p_id           uuid,
  p_name         text,
  p_description  text,
  p_period_month date,
  p_exercises    jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'p_exercises debe ser un arreglo JSON' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.workout_routines (workspace_id, name, description, period_month)
    values (p_workspace_id, p_name, p_description, p_period_month)
    returning id into v_id;
  else
    update public.workout_routines
       set name = p_name, description = p_description, period_month = p_period_month
     where id = p_id and workspace_id = p_workspace_id and archived_at is null
    returning id into v_id;

    if v_id is null then
      raise exception 'Rutina no encontrada' using errcode = 'P0002';
    end if;

    delete from public.routine_exercises
     where routine_id = v_id and workspace_id = p_workspace_id;
  end if;

  insert into public.routine_exercises
    (workspace_id, routine_id, day_of_week, position, name, target_sets, target_reps, target_weight_kg, notes)
  select
    p_workspace_id, v_id,
    (e.value ->> 'day_of_week')::smallint,
    e.ordinality::smallint,
    e.value ->> 'name',
    (e.value ->> 'target_sets')::smallint,
    (e.value ->> 'target_reps')::smallint,
    (e.value ->> 'target_weight_kg')::numeric,
    nullif(e.value ->> 'notes', '')
  from jsonb_array_elements(p_exercises) with ordinality as e(value, ordinality);

  return v_id;
end;
$$;

-- D-36: copia una rutina (con sus ejercicios) a otro mes, normalmente el siguiente.
create or replace function public.duplicate_workout_routine(
  p_routine_id   uuid,
  p_target_month date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_new uuid;
begin
  insert into public.workout_routines (workspace_id, name, description, period_month)
  select r.workspace_id, r.name, r.description, p_target_month
  from public.workout_routines r
  where r.id = p_routine_id and r.archived_at is null
  returning id into v_new;

  if v_new is null then
    raise exception 'Rutina no encontrada' using errcode = 'P0002';
  end if;

  insert into public.routine_exercises
    (workspace_id, routine_id, day_of_week, position, name, target_sets, target_reps, target_weight_kg, notes)
  select e.workspace_id, v_new, e.day_of_week, e.position, e.name,
         e.target_sets, e.target_reps, e.target_weight_kg, e.notes
  from public.routine_exercises e
  where e.routine_id = p_routine_id;

  return v_new;
end;
$$;

revoke all on function public.save_workout_session(uuid, uuid, uuid, smallint, timestamptz, text, integer, smallint, text, jsonb) from public, anon;
revoke all on function public.save_workout_routine(uuid, uuid, text, text, date, jsonb) from public, anon;
revoke all on function public.duplicate_workout_routine(uuid, date) from public, anon;
grant execute on function public.save_workout_session(uuid, uuid, uuid, smallint, timestamptz, text, integer, smallint, text, jsonb) to authenticated;
grant execute on function public.save_workout_routine(uuid, uuid, text, text, date, jsonb) to authenticated;
grant execute on function public.duplicate_workout_routine(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos.
-- D-39: sesiones y rutinas (los registros principales) NO se borran: archivado lógico.
-- Ejercicios, series y ejercicios planificados son su composición interna: se
-- reemplazan al editar, por lo que `authenticated` tiene DELETE solo sobre ellos
-- (siempre bajo RLS).
-- -----------------------------------------------------------------------------

revoke all on table public.workout_routines  from anon, authenticated;
revoke all on table public.routine_exercises from anon, authenticated;
revoke all on table public.workout_sessions  from anon, authenticated;
revoke all on table public.workout_exercises from anon, authenticated;
revoke all on table public.workout_sets      from anon, authenticated;

grant select on table public.workout_routines to authenticated;
grant insert (workspace_id, name, description, period_month) on table public.workout_routines to authenticated;
grant update (name, description, period_month, archived_at) on table public.workout_routines to authenticated;

grant select, delete on table public.routine_exercises to authenticated;
grant insert (workspace_id, routine_id, day_of_week, position, name, target_sets, target_reps, target_weight_kg, notes)
  on table public.routine_exercises to authenticated;

grant select on table public.workout_sessions to authenticated;
grant insert (workspace_id, routine_id, routine_day, started_at, type, duration_minutes, rpe, notes)
  on table public.workout_sessions to authenticated;
grant update (routine_id, routine_day, started_at, type, duration_minutes, rpe, notes, archived_at)
  on table public.workout_sessions to authenticated;

grant select, delete on table public.workout_exercises to authenticated;
grant insert (workspace_id, session_id, position, name, notes, distance_km, duration_min)
  on table public.workout_exercises to authenticated;

grant select, delete on table public.workout_sets to authenticated;
grant insert (workspace_id, exercise_id, set_number, reps, weight_kg)
  on table public.workout_sets to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.workout_routines  enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets      enable row level security;

-- Tablas con SELECT, INSERT y UPDATE
create policy workout_routines_select_own on public.workout_routines
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy workout_routines_insert_own on public.workout_routines
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy workout_routines_update_own on public.workout_routines
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy workout_sessions_insert_own on public.workout_sessions
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy workout_sessions_update_own on public.workout_sessions
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

-- Tablas de composición: SELECT, INSERT y DELETE
create policy routine_exercises_select_own on public.routine_exercises
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy routine_exercises_insert_own on public.routine_exercises
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy routine_exercises_delete_own on public.routine_exercises
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));

create policy workout_exercises_select_own on public.workout_exercises
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy workout_exercises_insert_own on public.workout_exercises
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy workout_exercises_delete_own on public.workout_exercises
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));

create policy workout_sets_select_own on public.workout_sets
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated using ((select public.owns_workspace(workspace_id)));
