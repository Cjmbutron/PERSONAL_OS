/** Subcategorías (D-109 a D-114): un solo nivel. Lógica pura, sin base de datos. */

export type CategoryLike = { id: string; name: string; kind: string; parent_id: string | null };

/** "IAN › Tenis" para una subcategoría; el nombre solo para una categoría principal. */
export function categoryPath<T extends CategoryLike>(c: T, byId: ReadonlyMap<string, T>): string {
  const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/**
 * Devuelve las categorías ordenadas (cada principal seguida de sus subcategorías) y con el nombre
 * completo en `name`, para usarlas tal cual en selectores y etiquetas.
 */
export function withPaths<T extends CategoryLike>(categories: readonly T[]): T[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const collator = new Intl.Collator("es", { sensitivity: "base" });
  const roots = categories
    .filter((c) => !c.parent_id || !byId.has(c.parent_id))
    .sort((a, b) => collator.compare(a.kind, b.kind) || collator.compare(a.name, b.name));
  const out: T[] = [];
  for (const root of roots) {
    out.push({ ...root, name: categoryPath(root, byId) });
    const children = categories.filter((c) => c.parent_id === root.id).sort((a, b) => collator.compare(a.name, b.name));
    for (const child of children) out.push({ ...child, name: categoryPath(child, byId) });
  }
  return out;
}

export type TotalLike = { currency: string; category_id: string; total: number };
export type RolledTotal = {
  id: string;
  name: string;
  /** Lo gastado directamente en esta categoría. */
  own: number;
  /** Propio + todas sus subcategorías. */
  total: number;
  children: { id: string; name: string; total: number }[];
};

/** Totales por categoría principal, con el desglose de sus subcategorías. Una moneda a la vez. */
export function rollupTotals(totals: readonly TotalLike[], categories: readonly CategoryLike[], currency: string): RolledTotal[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = new Map<string, RolledTotal>();
  const rootOf = (id: string) => {
    const c = byId.get(id);
    return c?.parent_id && byId.has(c.parent_id) ? c.parent_id : id;
  };
  for (const t of totals) {
    if (t.currency !== currency) continue;
    const rootId = rootOf(t.category_id);
    const row = rows.get(rootId) ?? { id: rootId, name: byId.get(rootId)?.name ?? "Categoría", own: 0, total: 0, children: [] };
    row.total += t.total;
    if (rootId === t.category_id) row.own += t.total;
    else row.children.push({ id: t.category_id, name: byId.get(t.category_id)?.name ?? "Subcategoría", total: t.total });
    rows.set(rootId, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, children: r.children.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);
}

/** Gasto por `${moneda}:${categoría}`: cada principal incluye a sus subcategorías; cada subcategoría, solo lo suyo. */
export function spentIncludingChildren(totals: readonly TotalLike[], categories: readonly CategoryLike[]): Map<string, number> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out = new Map<string, number>();
  const add = (key: string, n: number) => out.set(key, (out.get(key) ?? 0) + n);
  for (const t of totals) {
    add(`${t.currency}:${t.category_id}`, t.total);
    const parent = byId.get(t.category_id)?.parent_id;
    if (parent) add(`${t.currency}:${parent}`, t.total);
  }
  return out;
}
