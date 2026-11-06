-- =============================================================================
-- PERSONAL OS · Migración 8 · Finanzas: movimientos, transferencias y saldos
-- (Sprint 3, paso 2)
-- Tablas: transactions · Vista: account_balances
-- Funciones: create_transfer, archive_transfer
-- Decisiones: D-41, D-44, D-46 a D-48, D-50, D-51 (docs/04-decisiones-sprint-3-finanzas.md)
-- Reglas 4.3: 7 (cuenta válida), 9 (importes y monedas), 10 (transferencias atómicas)
-- =============================================================================

create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  account_id         uuid not null,
  -- D-41: la moneda del movimiento es la de su cuenta; la FK compuesta lo impone.
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  kind               text not null check (kind in ('income', 'expense', 'transfer_in', 'transfer_out')),
  -- D-46: siempre positivo; el tipo da el signo.
  amount             numeric(14, 2) not null check (amount > 0),
  -- D-47: día de calendario; un trigger rechaza fechas futuras.
  transaction_date   date not null,
  category_id        uuid,
  description        text check (description is null or char_length(description) <= 300),
  transfer_group_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz,

  constraint transactions_workspace_id_id_key unique (workspace_id, id),

  -- Regla 7 y D-41: cuenta del mismo workspace y con la misma moneda.
  constraint transactions_account_fk
    foreign key (workspace_id, account_id, currency)
    references public.financial_accounts (workspace_id, id, currency),

  -- D-48: la categoría es del mismo workspace y de un tipo que coincide con el del movimiento.
  -- Con category_id nulo (transferencias) la clave no se evalúa.
  constraint transactions_category_fk
    foreign key (workspace_id, category_id, kind)
    references public.transaction_categories (workspace_id, id, kind),

  -- Ingresos y gastos: categoría obligatoria y sin grupo. Transferencias: sin categoría y con grupo.
  constraint transactions_shape check (
    (kind in ('income', 'expense') and category_id is not null and transfer_group_id is null)
    or (kind in ('transfer_in', 'transfer_out') and category_id is null and transfer_group_id is not null)
  )
);

comment on table public.transactions is 'Movimientos de dinero. Las transferencias son dos filas con el mismo transfer_group_id y se crean solo con create_transfer (D-50).';

-- Una pata de salida y una de entrada por grupo, como máximo.
create unique index transactions_one_leg_per_kind
  on public.transactions (transfer_group_id, kind)
  where transfer_group_id is not null;

create index transactions_workspace_date_idx on public.transactions (workspace_id, transaction_date desc);
create index transactions_account_idx on public.transactions (account_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger transactions_prevent_workspace_change
  before update on public.transactions
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Reglas de estado: sin fechas futuras (zona del perfil), cuenta y categoría activas
-- -----------------------------------------------------------------------------

create or replace function public.validate_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_today date;
  acc_archived timestamptz;
  cat_archived timestamptz;
begin
  if tg_op = 'INSERT' or new.transaction_date is distinct from old.transaction_date then
    select (now() at time zone p.timezone)::date
      into user_today
    from public.workspaces w
    join public.profiles p on p.id = w.owner_id
    where w.id = new.workspace_id;

    if new.transaction_date > coalesce(user_today, (now() at time zone 'UTC')::date) then
      raise exception 'No se pueden registrar movimientos con fecha futura'
        using errcode = '23514';
    end if;
  end if;

  -- Una cuenta archivada no admite movimientos nuevos ni activos (D-45).
  if new.archived_at is null then
    select a.archived_at into acc_archived
    from public.financial_accounts a
    where a.workspace_id = new.workspace_id and a.id = new.account_id;
    if acc_archived is not null then
      raise exception 'La cuenta está archivada' using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null
     and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
    select c.archived_at into cat_archived
    from public.transaction_categories c
    where c.workspace_id = new.workspace_id and c.id = new.category_id;
    if cat_archived is not null then
      raise exception 'La categoría está archivada' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_transaction() from public, anon, authenticated;

create trigger transactions_validate
  before insert or update on public.transactions
  for each row execute function public.validate_transaction();

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos: sin DELETE; columnas explícitas.
-- Cuenta, moneda y tipo no cambian tras crear el movimiento.
-- `transfer_group_id` no es escribible por el cliente: solo create_transfer lo fija.
-- -----------------------------------------------------------------------------

revoke all on table public.transactions from anon, authenticated;

grant select on table public.transactions to authenticated;
grant insert (workspace_id, account_id, currency, kind, amount, transaction_date, category_id, description)
  on table public.transactions to authenticated;
grant update (amount, transaction_date, category_id, description, archived_at)
  on table public.transactions to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security. El cliente solo crea y modifica ingresos y gastos (D-50, D-51):
-- las patas de una transferencia se gestionan únicamente con las funciones de abajo.
-- -----------------------------------------------------------------------------

alter table public.transactions enable row level security;

create policy transactions_select_own on public.transactions
  for select to authenticated using ((select public.owns_workspace(workspace_id)));

create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check ((select public.owns_workspace(workspace_id)) and kind in ('income', 'expense'));

create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)) and kind in ('income', 'expense'))
  with check ((select public.owns_workspace(workspace_id)) and kind in ('income', 'expense'));

-- -----------------------------------------------------------------------------
-- Saldo por cuenta (D-44): saldo inicial + movimientos activos. Se calcula siempre.
-- security_invoker: la RLS de quien consulta se aplica a las tablas base.
-- -----------------------------------------------------------------------------

create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.workspace_id,
  a.currency,
  a.opening_balance
    + coalesce(sum(
        case when t.kind in ('income', 'transfer_in') then t.amount else -t.amount end
      ) filter (where t.archived_at is null), 0) as balance
from public.financial_accounts a
left join public.transactions t
  on t.workspace_id = a.workspace_id and t.account_id = a.id
group by a.id, a.workspace_id, a.currency, a.opening_balance;

revoke all on table public.account_balances from anon, authenticated;
grant select on table public.account_balances to authenticated;

-- -----------------------------------------------------------------------------
-- Transferencias atómicas (6.5, D-50). SECURITY DEFINER porque las patas no son
-- insertables por el cliente; comprueba la propiedad del workspace de forma explícita.
-- -----------------------------------------------------------------------------

create or replace function public.create_transfer(
  p_workspace_id  uuid,
  p_from_account  uuid,
  p_to_account    uuid,
  p_amount        numeric,
  p_date          date,
  p_description   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  from_acc public.financial_accounts;
  to_acc   public.financial_accounts;
  group_id uuid := gen_random_uuid();
  descr    text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if not public.owns_workspace(p_workspace_id) then
    raise exception 'Sin acceso al workspace' using errcode = '42501';
  end if;
  if p_from_account is null or p_to_account is null or p_from_account = p_to_account then
    raise exception 'Las cuentas de origen y destino deben ser distintas' using errcode = '23514';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor que cero' using errcode = '23514';
  end if;

  -- Bloquea ambas cuentas (en orden estable) para que no se archiven a mitad de la operación.
  select * into from_acc from public.financial_accounts
    where workspace_id = p_workspace_id and id = least(p_from_account, p_to_account) for share;
  select * into to_acc from public.financial_accounts
    where workspace_id = p_workspace_id and id = greatest(p_from_account, p_to_account) for share;
  select * into from_acc from public.financial_accounts where workspace_id = p_workspace_id and id = p_from_account;
  select * into to_acc   from public.financial_accounts where workspace_id = p_workspace_id and id = p_to_account;

  if from_acc.id is null or to_acc.id is null then
    raise exception 'La cuenta no existe en tu workspace' using errcode = 'P0002';
  end if;
  if from_acc.archived_at is not null or to_acc.archived_at is not null then
    raise exception 'La cuenta está archivada' using errcode = '23514';
  end if;
  if from_acc.currency <> to_acc.currency then
    raise exception 'Las cuentas deben tener la misma moneda' using errcode = '23514';
  end if;

  insert into public.transactions
    (workspace_id, account_id, currency, kind, amount, transaction_date, description, transfer_group_id)
  values
    (p_workspace_id, from_acc.id, from_acc.currency, 'transfer_out', p_amount, p_date, descr, group_id),
    (p_workspace_id, to_acc.id,   to_acc.currency,   'transfer_in',  p_amount, p_date, descr, group_id);

  return group_id;
end;
$$;

-- D-51: una transferencia se archiva (o restaura) completa, nunca una sola pata.
create or replace function public.archive_transfer(p_group_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  legs integer;
begin
  select workspace_id into ws from public.transactions where transfer_group_id = p_group_id limit 1;
  if ws is null or not public.owns_workspace(ws) then
    raise exception 'La transferencia no existe' using errcode = 'P0002';
  end if;

  update public.transactions
     set archived_at = case when p_archived then now() else null end
   where workspace_id = ws and transfer_group_id = p_group_id;
  get diagnostics legs = row_count;

  if legs <> 2 then
    raise exception 'Transferencia incompleta' using errcode = 'XX000';
  end if;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, date, text) from public, anon;
revoke all on function public.archive_transfer(uuid, boolean) from public, anon;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.archive_transfer(uuid, boolean) to authenticated;
