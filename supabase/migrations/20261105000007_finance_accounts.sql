-- =============================================================================
-- PERSONAL OS · Migración 7 · Finanzas: cuentas y categorías (Sprint 3, paso 1)
-- Tablas: financial_accounts, transaction_categories
-- Decisiones: D-40, D-43, D-44, D-45, D-49 (docs/04-decisiones-sprint-3-finanzas.md)
-- Los movimientos, las transferencias y las claves compuestas que usan estas
-- tablas llegan en la migración 8.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cuentas financieras (DEC-003, D-43)
-- -----------------------------------------------------------------------------

create table public.financial_accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  account_type     text not null check (account_type in ('cash', 'bank', 'savings', 'other')),
  -- D-40: ISO 4217. Solo BOB al inicio; ampliar = reemplazar la restricción con otra migración.
  currency         text not null check (currency ~ '^[A-Z]{3}$'),
  -- D-44: el saldo no se guarda; se calcula a partir de este valor y de los movimientos.
  opening_balance  numeric(14, 2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,

  constraint financial_accounts_currency_enabled check (currency in ('BOB')),
  -- Soportan las claves foráneas compuestas de la migración 8 (D-03, D-41).
  constraint financial_accounts_workspace_id_id_key unique (workspace_id, id),
  constraint financial_accounts_workspace_id_id_currency_key unique (workspace_id, id, currency)
);

comment on table public.financial_accounts is 'Cuentas del usuario. Archivado lógico (D-45); sin DELETE (regla 8).';

-- Dos cuentas activas no pueden llamarse igual (sin distinguir mayúsculas).
create unique index financial_accounts_active_name_key
  on public.financial_accounts (workspace_id, lower(btrim(name)))
  where archived_at is null;

create trigger financial_accounts_set_updated_at
  before update on public.financial_accounts
  for each row execute function public.set_updated_at();

create trigger financial_accounts_prevent_workspace_change
  before update on public.financial_accounts
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Categorías de ingreso y gasto (D-48, D-49)
-- -----------------------------------------------------------------------------

create table public.transaction_categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  kind          text not null check (kind in ('income', 'expense')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,

  constraint transaction_categories_workspace_id_id_key unique (workspace_id, id),
  -- Permite que un movimiento exija que su categoría sea del mismo tipo (D-48).
  constraint transaction_categories_workspace_id_id_kind_key unique (workspace_id, id, kind)
);

comment on table public.transaction_categories is 'Categorías por workspace (D-49). Archivado lógico; el tipo no cambia.';

create unique index transaction_categories_active_name_key
  on public.transaction_categories (workspace_id, kind, lower(btrim(name)))
  where archived_at is null;

create trigger transaction_categories_set_updated_at
  before update on public.transaction_categories
  for each row execute function public.set_updated_at();

create trigger transaction_categories_prevent_workspace_change
  before update on public.transaction_categories
  for each row execute function public.prevent_workspace_change();

-- Categorías por defecto (D-49), sembradas al crear el workspace y para los existentes.
create or replace function public.seed_default_categories(target_workspace uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.transaction_categories (workspace_id, name, kind)
  select target_workspace, c.name, c.kind
  from (values
    ('Alimentación', 'expense'), ('Transporte', 'expense'), ('Vivienda', 'expense'),
    ('Salud', 'expense'), ('Educación', 'expense'), ('Ocio', 'expense'), ('Otros gastos', 'expense'),
    ('Sueldo', 'income'), ('Otros ingresos', 'income')
  ) as c (name, kind)
  on conflict do nothing;
$$;

create or replace function public.seed_categories_for_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

-- Funciones internas: no deben ser invocables como RPC.
revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke all on function public.seed_categories_for_new_workspace() from public, anon, authenticated;

create trigger workspaces_seed_categories
  after insert on public.workspaces
  for each row execute function public.seed_categories_for_new_workspace();

select public.seed_default_categories(id) from public.workspaces;

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos (D-02, D-45): sin DELETE; columnas explícitas.
-- `currency` y `kind` no se modifican tras la creación.
-- -----------------------------------------------------------------------------

revoke all on table public.financial_accounts     from anon, authenticated;
revoke all on table public.transaction_categories from anon, authenticated;

grant select on table public.financial_accounts to authenticated;
grant insert (workspace_id, name, account_type, currency, opening_balance)
  on table public.financial_accounts to authenticated;
grant update (name, account_type, opening_balance, archived_at)
  on table public.financial_accounts to authenticated;

grant select on table public.transaction_categories to authenticated;
grant insert (workspace_id, name, kind)
  on table public.transaction_categories to authenticated;
grant update (name, archived_at)
  on table public.transaction_categories to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security (7.1)
-- -----------------------------------------------------------------------------

alter table public.financial_accounts     enable row level security;
alter table public.transaction_categories enable row level security;

create policy financial_accounts_select_own on public.financial_accounts
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy financial_accounts_insert_own on public.financial_accounts
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy financial_accounts_update_own on public.financial_accounts
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy transaction_categories_select_own on public.transaction_categories
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy transaction_categories_insert_own on public.transaction_categories
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy transaction_categories_update_own on public.transaction_categories
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));
