import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Subcategorías de finanzas (D-109 a D-114). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
const A = () => session(db, a.userId);
const B = () => session(db, b.userId);

const cat = async (s: ReturnType<typeof A>, ws: string, name: string, kind = "expense", parent: string | null = null) =>
  (
    await s.query<{ id: string }>(
      "insert into public.transaction_categories (workspace_id, name, kind, parent_id) values ($1, $2, $3, $4) returning id",
      [ws, name, kind, parent],
    )
  ).rows[0].id;

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
});
afterAll(async () => {
  await db.close();
});

describe("subcategorías", () => {
  it("crea una subcategoría bajo una categoría del mismo tipo", async () => {
    const ian = await cat(A(), a.workspaceId, "IAN");
    const tenis = await cat(A(), a.workspaceId, "Tenis", "expense", ian);
    const r = await A().query<{ parent_id: string }>("select parent_id from public.transaction_categories where id = $1", [tenis]);
    expect(r.rows[0].parent_id).toBe(ian);
  });

  it("el mismo nombre se permite bajo padres distintos, no dentro del mismo", async () => {
    const x = await cat(A(), a.workspaceId, "Colegio");
    const y = await cat(A(), a.workspaceId, "Casa");
    await cat(A(), a.workspaceId, "Pensión", "expense", x);
    await cat(A(), a.workspaceId, "Pensión", "expense", y);
    await expect(cat(A(), a.workspaceId, "pensión ", "expense", x)).rejects.toThrow(/duplicate key/);
  });

  it("no mezcla tipos: una subcategoría de ingreso no cuelga de un gasto", async () => {
    const g = await cat(A(), a.workspaceId, "Gasto raíz");
    await expect(cat(A(), a.workspaceId, "Ingreso hijo", "income", g)).rejects.toThrow(/foreign key/);
  });

  it("solo un nivel: una subcategoría no puede tener hijos", async () => {
    const p = await cat(A(), a.workspaceId, "Nivel 1");
    const h = await cat(A(), a.workspaceId, "Nivel 2", "expense", p);
    await expect(cat(A(), a.workspaceId, "Nivel 3", "expense", h)).rejects.toThrow(/no puede tener subcategorías/);
  });

  it("no se crea bajo un padre archivado, ni se restaura el hijo con el padre archivado", async () => {
    const p = await cat(A(), a.workspaceId, "Archivable");
    const h = await cat(A(), a.workspaceId, "Hijo", "expense", p);
    await A().query("update public.transaction_categories set archived_at = now() where id in ($1, $2)", [p, h]);
    await expect(cat(A(), a.workspaceId, "Otro hijo", "expense", p)).rejects.toThrow(/archivada/);
    await expect(A().query("update public.transaction_categories set archived_at = null where id = $1", [h])).rejects.toThrow(/archivada/);
    await A().query("update public.transaction_categories set archived_at = null where id = $1", [p]);
    await A().query("update public.transaction_categories set archived_at = null where id = $1", [h]);
  });

  it("parent_id no se cambia después de crear y no se cruza entre personas", async () => {
    const p = await cat(A(), a.workspaceId, "Fijo");
    const q = await cat(A(), a.workspaceId, "Otro");
    const h = await cat(A(), a.workspaceId, "Hijo fijo", "expense", p);
    await expect(A().query("update public.transaction_categories set parent_id = $1 where id = $2", [q, h])).rejects.toThrow(/permission denied/);
    await expect(cat(B(), b.workspaceId, "Intruso", "expense", p)).rejects.toThrow(/foreign key/);
  });

  it("un movimiento puede usar la subcategoría", async () => {
    const acc = (
      await A().query<{ id: string }>(
        "insert into public.financial_accounts (workspace_id, name, account_type, currency, opening_balance) values ($1, 'Caja', 'cash', 'BOB', 0) returning id",
        [a.workspaceId],
      )
    ).rows[0].id;
    const p = await cat(A(), a.workspaceId, "Hogar");
    const h = await cat(A(), a.workspaceId, "Luz", "expense", p);
    await A().query(
      "insert into public.transactions (workspace_id, account_id, currency, kind, amount, transaction_date, category_id) values ($1, $2, 'BOB', 'expense', 120, current_date, $3)",
      [a.workspaceId, acc, h],
    );
    const r = await A().query<{ n: number }>("select count(*)::int as n from public.transactions where category_id = $1", [h]);
    expect(r.rows[0].n).toBe(1);
  });
});
