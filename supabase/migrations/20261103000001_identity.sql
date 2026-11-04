-- =============================================================================
-- PERSONAL OS · Migración 1 · Identidad y configuración
-- Tablas: profiles, workspaces, life_areas
-- Decisiones: D-01, D-04, D-05, D-06 (docs/01-revision-y-decisiones-sprint-1.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones utilitarias (todas con search_path vacío: regla 7.2)
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Impide mover un registro a otro workspace (7.2: "no cambiar arbitrariamente su workspace_id").
create or replace function public.prevent_workspace_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id no puede modificarse'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: 1 fila por usuario de auth.users
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(btrim(full_name)) between 1 and 100),
  timezone    text not null default 'America/La_Paz'
              check (char_length(timezone) between 1 and 64),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil básico del usuario. id = auth.users.id (D-05).';
comment on column public.profiles.timezone is 'Zona IANA usada para calcular "hoy" (D-08). La validez se comprueba en la aplicación.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspaces: exactamente uno por usuario (DEC-001, regla 6.4.1 y 6.4.2)
-- -----------------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  name        text not null default 'Mi espacio'
              check (char_length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workspaces is 'Espacio personal. owner_id UNIQUE garantiza un workspace por usuario (DEC-001).';

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id no puede modificarse'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workspaces_prevent_owner_change
  before update on public.workspaces
  for each row execute function public.prevent_owner_change();

-- -----------------------------------------------------------------------------
-- life_areas: catálogo global de las seis dimensiones (DEC-002, D-01)
-- -----------------------------------------------------------------------------

create table public.life_areas (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique
              check (code in ('WORK', 'FITNESS', 'NUTRITION', 'SLEEP', 'FINANCE', 'PERSONAL')),
  name        text not null,
  description text not null,
  sort_order  smallint not null unique
);

comment on table public.life_areas is 'Catálogo fijo de dimensiones. Solo se modifica mediante migraciones (DEC-002).';

insert into public.life_areas (code, name, description, sort_order) values
  ('WORK',      'Trabajo y productividad', 'Tareas, proyectos, calendario y objetivos profesionales.', 1),
  ('FITNESS',   'Entrenamiento',           'Sesiones de ejercicio, rutinas y seguimiento físico.',     2),
  ('NUTRITION', 'Alimentación',            'Registro de comidas y seguimiento nutricional.',           3),
  ('SLEEP',     'Sueño y recuperación',    'Registro de descanso y análisis de patrones.',             4),
  ('FINANCE',   'Finanzas personales',     'Cuentas, ingresos, gastos, presupuestos y obligaciones.',  5),
  ('PERSONAL',  'Vida personal',           'Actividades, objetivos y organización del tiempo libre.',  6);

-- -----------------------------------------------------------------------------
-- owns_workspace(): validación centralizada de propiedad (7.1, D-06)
-- SECURITY DEFINER para poder leer workspaces sin recursión de RLS.
-- -----------------------------------------------------------------------------

create or replace function public.owns_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
      and w.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_workspace(uuid) from public, anon;
grant execute on function public.owns_workspace(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Alta automática de perfil + workspace al registrarse (S1-08, D-05)
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100)), '')
  )
  on conflict (id) do nothing;

  insert into public.workspaces (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

-- Función de trigger: no debe ser invocable como RPC por ningún rol de la API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (7.2) — se parte de cero porque Supabase concede
-- privilegios amplios por defecto a anon/authenticated.
-- -----------------------------------------------------------------------------

revoke all on table public.profiles   from anon, authenticated;
revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.life_areas from anon, authenticated;

grant select on table public.profiles   to authenticated;
grant update (full_name, timezone) on table public.profiles to authenticated;

grant select on table public.workspaces to authenticated;
grant update (name) on table public.workspaces to authenticated;

grant select on table public.life_areas to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.workspaces enable row level security;
alter table public.life_areas enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy workspaces_select_own on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy workspaces_update_own on public.workspaces
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy life_areas_select_all on public.life_areas
  for select to authenticated
  using (true);
