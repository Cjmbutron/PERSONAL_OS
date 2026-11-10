-- Subcategorías de finanzas (D-109 a D-114): un solo nivel (categoría → subcategoría).
-- Los movimientos, presupuestos y obligaciones siguen apuntando a category_id: puede ser
-- una categoría o una subcategoría. Los totales del padre se suman en la aplicación.

alter table public.transaction_categories
  add column parent_id uuid,
  add constraint transaction_categories_not_own_parent check (parent_id is null or parent_id <> id),
  -- Misma persona y mismo tipo que el padre (ingreso con ingreso, gasto con gasto).
  add constraint transaction_categories_parent_fk
    foreign key (workspace_id, parent_id, kind)
    references public.transaction_categories (workspace_id, id, kind);

-- El nombre es único dentro de su padre (o entre las categorías de primer nivel).
drop index public.transaction_categories_active_name_key;
create unique index transaction_categories_active_name_key
  on public.transaction_categories (workspace_id, kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)))
  where archived_at is null;

create index transaction_categories_parent_idx
  on public.transaction_categories (parent_id) where parent_id is not null;

-- Reglas que una clave foránea no expresa: un solo nivel y padre activo (D-110, D-111).
create or replace function public.check_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.transaction_categories%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into p from public.transaction_categories where id = new.parent_id;
  if p.parent_id is not null then
    raise exception 'Una subcategoría no puede tener subcategorías' using errcode = '23514';
  end if;
  if new.archived_at is null and p.archived_at is not null then
    raise exception 'La categoría principal está archivada' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transaction_categories_check_parent
  before insert or update of archived_at on public.transaction_categories
  for each row execute function public.check_category_parent();

-- parent_id se fija solo al crear (como kind): sin permiso de UPDATE.
grant insert (parent_id) on table public.transaction_categories to authenticated;
