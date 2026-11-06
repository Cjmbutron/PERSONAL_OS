-- =============================================================================
-- PERSONAL OS · Migración 9 · Finanzas: presupuestos, obligaciones y reportes
-- (Sprint 3, paso 3)
-- Tablas: budgets, financial_obligations
-- Vistas: monthly_totals, monthly_category_totals
-- Funciones: copy_budgets, pay_obligation
-- Decisiones: D-52 a D-56 (docs/04-decisiones-sprint-3-finanzas.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Presupuestos mensuales (D-52): por categoría de gasto o, con category_id nulo,
-- tope del total del mes.
-- -----------------------------------------------------------------------------

create table public.budgets (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  -- Primer día del mes calendario.
  period_month   date not null check (extract(day from period_month) = 1),
  category_id    uuid,
  -- Fuerza que la categoría sea de gasto mediante la FK compuesta (D-48).
  category_kind  text generated always as ('expense') stored,
  currency       text not null check (currency ~ '^[A-Z]{3}$' and currency in ('BOB')),
  amount         numeric(14, 2) not null check (amount > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,

  constraint budgets_workspace_id_id_key unique (workspace_id, id),
  constraint budgets_category_fk
    foreign key (workspace_id, category_id, category_kind)
    references public.transaction_categories (workspace_id, id, kind)
);

comment on table public.budgets is 'Presupuesto mensual por categoría de gasto o total del mes (category_id nulo). Archivado lógico.';

-- Un presupuesto activo por mes, categoría y moneda; y uno de total por mes y moneda.
create unique index budgets_one_per_category
  on public.budgets (workspace_id, period_month, category_id, currency)
  where category_id is not null and archived_at is null;
create unique index budgets_one_total
  on public.budgets (workspace_id, period_month, currency)
  where category_id is null and archived_at is null;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();
create trigger budgets_prevent_workspace_change
  before update on public.budgets
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Obligaciones (D-54)
-- -----------------------------------------------------------------------------

create table public.financial_obligations (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  name                 text not null check (char_length(btrim(name)) between 1 and 100),
  amount               numeric(14, 2) not null check (amount > 0),
  currency             text not null check (currency ~ '^[A-Z]{3}$' and currency in ('BOB')),
  due_date             date not null,
  -- Día del mes del vencimiento original; evita que "31" derive a "28" tras febrero.
  anchor_day           smallint not null check (anchor_day between 1 and 31),
  status               text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  recurrence           text not null default 'none' check (recurrence in ('none', 'monthly')),
  category_id          uuid,
  category_kind        text generated always as ('expense') stored,
  paid_at              timestamptz,
  paid_transaction_id  uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint financial_obligations_workspace_id_id_key unique (workspace_id, id),
  constraint financial_obligations_category_fk
    foreign key (workspace_id, category_id, category_kind)
    references public.transaction_categories (workspace_id, id, kind),
  constraint financial_obligations_transaction_fk
    foreign key (workspace_id, paid_transaction_id)
    references public.transactions (workspace_id, id),
  constraint financial_obligations_paid_consistent check (
    (status = 'paid') = (paid_at is not null and paid_transaction_id is not null)
  )
);

comment on table public.financial_obligations is 'Pagos pendientes con vencimiento. Se pagan con pay_obligation, que registra el gasto. Sin DELETE: se cancelan.';

create index financial_obligations_due_idx
  on public.financial_obligations (workspace_id, status, due_date);

create or replace function public.set_obligation_anchor_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.anchor_day is null then
    new.anchor_day := extract(day from new.due_date)::smallint;
  elsif tg_op = 'UPDATE' and new.due_date is distinct from old.due_date then
    new.anchor_day := extract(day from new.due_date)::smallint;
  end if;
  return new;
end;
$$;

create trigger financial_obligations_anchor_day
  before insert or update on public.financial_obligations
  for each row execute function public.set_obligation_anchor_day();
create trigger financial_obligations_set_updated_at
  before update on public.financial_obligations
  for each row execute function public.set_updated_at();
create trigger financial_obligations_prevent_workspace_change
  before update on public.financial_obligations
  for each row execute function public.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Reportes (D-55): totales mensuales de ingresos y gastos activos, por moneda.
-- Las transferencias no cuentan. security_invoker: se aplica la RLS de quien consulta.
-- -----------------------------------------------------------------------------

create view public.monthly_totals
with (security_invoker = true)
as
select
  workspace_id,
  currency,
  date_trunc('month', transaction_date)::date as month,
  kind,
  sum(amount) as total,
  count(*) as movements
from public.transactions
where archived_at is null and kind in ('income', 'expense')
group by workspace_id, currency, date_trunc('month', transaction_date), kind;

create view public.monthly_category_totals
with (security_invoker = true)
as
select
  workspace_id,
  currency,
  date_trunc('month', transaction_date)::date as month,
  kind,
  category_id,
  sum(amount) as total,
  count(*) as movements
from public.transactions
where archived_at is null and kind in ('income', 'expense')
group by workspace_id, currency, date_trunc('month', transaction_date), kind, category_id;

-- -----------------------------------------------------------------------------
-- Copiar presupuestos a otro mes (D-52). SECURITY INVOKER: usa la RLS de quien llama.
-- Omite los que ya existen en el mes de destino.
-- -----------------------------------------------------------------------------

create or replace function public.copy_budgets(p_workspace_id uuid, p_from_month date, p_to_month date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  copied integer;
begin
  if p_from_month is null or p_to_month is null or p_from_month = p_to_month then
    raise exception 'Los meses de origen y destino deben ser distintos' using errcode = '23514';
  end if;

  insert into public.budgets (workspace_id, period_month, category_id, currency, amount)
  select b.workspace_id, p_to_month, b.category_id, b.currency, b.amount
  from public.budgets b
  where b.workspace_id = p_workspace_id
    and b.period_month = p_from_month
    and b.archived_at is null
    and (
      b.category_id is null
      or exists (
        select 1 from public.transaction_categories c
        where c.workspace_id = b.workspace_id and c.id = b.category_id and c.archived_at is null
      )
    )
  on conflict do nothing;

  get diagnostics copied = row_count;
  return copied;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pagar una obligación (D-54): registra el gasto, marca la obligación como pagada y,
-- si es mensual, crea la del mes siguiente. Todo en una transacción.
-- SECURITY DEFINER porque el cliente no puede marcar obligaciones como pagadas por su cuenta;
-- comprueba la propiedad del workspace de forma explícita.
-- -----------------------------------------------------------------------------

create or replace function public.pay_obligation(
  p_obligation_id  uuid,
  p_account_id     uuid,
  p_paid_date      date,
  p_category_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.financial_obligations;
  acc      public.financial_accounts;
  cat      uuid;
  tx       uuid;
  month1   date;
  next_due date;
begin
  select * into o from public.financial_obligations where id = p_obligation_id for update;
  if o.id is null or not public.owns_workspace(o.workspace_id) then
    raise exception 'La obligación no existe' using errcode = 'P0002';
  end if;
  if o.status <> 'pending' then
    raise exception 'La obligación ya no está pendiente' using errcode = '23514';
  end if;

  select * into acc from public.financial_accounts where workspace_id = o.workspace_id and id = p_account_id;
  if acc.id is null then
    raise exception 'La cuenta no existe en tu workspace' using errcode = 'P0002';
  end if;
  if acc.archived_at is not null then
    raise exception 'La cuenta está archivada' using errcode = '23514';
  end if;
  if acc.currency <> o.currency then
    raise exception 'La cuenta debe tener la misma moneda que la obligación' using errcode = '23514';
  end if;

  cat := coalesce(p_category_id, o.category_id);
  if cat is null then
    raise exception 'Elige una categoría de gasto' using errcode = '23514';
  end if;

  insert into public.transactions
    (workspace_id, account_id, currency, kind, amount, transaction_date, category_id, description)
  values
    (o.workspace_id, acc.id, acc.currency, 'expense', o.amount, p_paid_date, cat, o.name)
  returning id into tx;

  update public.financial_obligations
     set status = 'paid', paid_at = now(), paid_transaction_id = tx
   where id = o.id;

  if o.recurrence = 'monthly' then
    month1 := (date_trunc('month', o.due_date) + interval '1 month')::date;
    next_due := month1 + (least(
      o.anchor_day,
      extract(day from (month1 + interval '1 month' - interval '1 day'))::int
    ) - 1);

    insert into public.financial_obligations
      (workspace_id, name, amount, currency, due_date, anchor_day, recurrence, category_id)
    values
      (o.workspace_id, o.name, o.amount, o.currency, next_due, o.anchor_day, 'monthly', o.category_id);
  end if;

  return tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios SQL mínimos: sin DELETE; columnas explícitas.
-- -----------------------------------------------------------------------------

revoke all on table public.budgets               from anon, authenticated;
revoke all on table public.financial_obligations from anon, authenticated;
revoke all on table public.monthly_totals          from anon, authenticated;
revoke all on table public.monthly_category_totals from anon, authenticated;

grant select on table public.budgets to authenticated;
grant insert (workspace_id, period_month, category_id, currency, amount) on table public.budgets to authenticated;
grant update (amount, archived_at) on table public.budgets to authenticated;

grant select on table public.financial_obligations to authenticated;
grant insert (workspace_id, name, amount, currency, due_date, recurrence, category_id)
  on table public.financial_obligations to authenticated;
-- `status` solo admite pending/cancelled desde el cliente (política RLS); 'paid' lo fija pay_obligation.
grant update (name, amount, due_date, recurrence, category_id, status)
  on table public.financial_obligations to authenticated;

grant select on table public.monthly_totals to authenticated;
grant select on table public.monthly_category_totals to authenticated;

revoke all on function public.copy_budgets(uuid, date, date) from public, anon;
revoke all on function public.pay_obligation(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.copy_budgets(uuid, date, date) to authenticated;
grant execute on function public.pay_obligation(uuid, uuid, date, uuid) to authenticated;
revoke all on function public.set_obligation_anchor_day() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.budgets                enable row level security;
alter table public.financial_obligations  enable row level security;

create policy budgets_select_own on public.budgets
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy budgets_insert_own on public.budgets
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
create policy budgets_update_own on public.budgets
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy financial_obligations_select_own on public.financial_obligations
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
create policy financial_obligations_insert_own on public.financial_obligations
  for insert to authenticated with check ((select public.owns_workspace(workspace_id)));
-- Las pagadas no se editan; y el cliente nunca puede dejar una obligación en 'paid'.
create policy financial_obligations_update_own on public.financial_obligations
  for update to authenticated
  using ((select public.owns_workspace(workspace_id)) and status in ('pending', 'cancelled'))
  with check ((select public.owns_workspace(workspace_id)) and status in ('pending', 'cancelled'));
