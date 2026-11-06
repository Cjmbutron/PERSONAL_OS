import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Finanzas, paso 1: cuentas y categorías (D-40, D-43, D-44, D-45, D-48, D-49). */

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };
let accountA: string;

const insAccount = (ws: string, name: string, type = "bank", currency = "BOB", opening = "0") =>
  `insert into public.financial_accounts (workspace_id, name, account_type, currency, opening_balance)
   values ('${ws}', '${name}', '${type}', '${currency}', ${opening}) returning id`;

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  accountA = (await session(db, a.userId).query<{ id: string }>(insAccount(a.workspaceId, "Cuenta BNB"))).rows[0].id;
  await session(db, b.userId).query(insAccount(b.workspaceId, "Efectivo", "cash"));
});

afterAll(async () => {
  await db.close();
});

describe("aislamiento entre workspaces", () => {
  it("cada usuario solo ve sus cuentas y categorías", async () => {
    const accounts = await session(db, a.userId).query<{ name: string }>("select name from public.financial_accounts");
    expect(accounts.rows.map((r) => r.name)).toEqual(["Cuenta BNB"]);
    const cats = await session(db, a.userId).query<{ workspace_id: string }>("select workspace_id from public.transaction_categories");
    expect(cats.rows.length).toBeGreaterThan(0);
    expect(new Set(cats.rows.map((r) => r.workspace_id))).toEqual(new Set([a.workspaceId]));
  });

  it("no se puede insertar en el workspace de otro", async () => {
    await expect(session(db, a.userId).query(insAccount(b.workspaceId, "Intrusa"))).rejects.toThrow(/row-level security/i);
    await expect(
      session(db, a.userId).query(
        `insert into public.transaction_categories (workspace_id, name, kind) values ('${b.workspaceId}', 'X', 'expense')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("no se puede modificar lo ajeno (0 filas) ni mover una cuenta de workspace", async () => {
    const r = await session(db, b.userId).query("update public.financial_accounts set name = 'Hack' where id = $1 returning id", [accountA]);
    expect(r.rows).toHaveLength(0);
    await expect(
      session(db, a.userId).query("update public.financial_accounts set workspace_id = $2 where id = $1", [accountA, b.workspaceId]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("anon no accede", async () => {
    const anon = session(db, null);
    await expect(anon.query("select * from public.financial_accounts")).rejects.toThrow(/permission denied/i);
    await expect(anon.query("select * from public.transaction_categories")).rejects.toThrow(/permission denied/i);
  });
});

describe("D-45 · sin DELETE; D-40 · moneda inmutable", () => {
  it("authenticated no puede borrar", async () => {
    await expect(session(db, a.userId).query("delete from public.financial_accounts")).rejects.toThrow(/permission denied/i);
    await expect(session(db, a.userId).query("delete from public.transaction_categories")).rejects.toThrow(/permission denied/i);
  });

  it("la moneda, el workspace y el tipo de categoría no se pueden cambiar", async () => {
    const A = session(db, a.userId);
    await expect(A.query("update public.financial_accounts set currency = 'USD' where id = $1", [accountA])).rejects.toThrow(/permission denied/i);
    await expect(A.query("update public.transaction_categories set kind = 'income' where kind = 'expense'")).rejects.toThrow(/permission denied/i);
  });

  it("archivar y restaurar", async () => {
    const A = session(db, a.userId);
    const id = (await A.query<{ id: string }>(insAccount(a.workspaceId, "Temporal"))).rows[0].id;
    await A.query("update public.financial_accounts set archived_at = now() where id = $1", [id]);
    expect((await A.query("select 1 from public.financial_accounts where id = $1 and archived_at is not null", [id])).rows).toHaveLength(1);
    await A.query("update public.financial_accounts set archived_at = null where id = $1", [id]);
  });
});

describe("D-40 · validaciones de cuenta", () => {
  const A = () => session(db, a.userId);

  it("solo BOB está habilitada", async () => {
    await expect(A().query(insAccount(a.workspaceId, "Dólares", "bank", "USD"))).rejects.toThrow(/financial_accounts_currency_enabled/);
    await expect(A().query(insAccount(a.workspaceId, "Raro", "bank", "bob"))).rejects.toThrow(/check constraint/i);
    await expect(A().query(insAccount(a.workspaceId, "Raro", "bank", "BO"))).rejects.toThrow(/check constraint/i);
  });

  it("tipo y nombre válidos; saldo inicial puede ser negativo o decimal", async () => {
    await expect(A().query(insAccount(a.workspaceId, "X", "crypto"))).rejects.toThrow(/check constraint/i);
    await expect(A().query(insAccount(a.workspaceId, "   "))).rejects.toThrow(/check constraint/i);
    await expect(A().query(insAccount(a.workspaceId, "n".repeat(101)))).rejects.toThrow(/check constraint/i);
    const r = await A().query<{ opening_balance: string }>(insAccount(a.workspaceId, "Con deuda", "other", "BOB", "-150.5"));
    expect(r.rows).toHaveLength(1);
    await expect(A().query(insAccount(a.workspaceId, "Enorme", "bank", "BOB", "1000000000000"))).rejects.toThrow(/numeric field overflow/i);
  });

  it("nombre único entre activas, sin distinguir mayúsculas; archivada libera el nombre", async () => {
    await expect(A().query(insAccount(a.workspaceId, "  cuenta bnb "))).rejects.toThrow(/financial_accounts_active_name_key|duplicate key/i);
    const id = (await A().query<{ id: string }>(insAccount(a.workspaceId, "Reutilizable"))).rows[0].id;
    await A().query("update public.financial_accounts set archived_at = now() where id = $1", [id]);
    await A().query(insAccount(a.workspaceId, "Reutilizable"));
    // Restaurar la archivada choca con la activa del mismo nombre.
    await expect(A().query("update public.financial_accounts set archived_at = null where id = $1", [id])).rejects.toThrow(/duplicate key/i);
  });

  it("otro usuario puede usar el mismo nombre", async () => {
    await session(db, b.userId).query(insAccount(b.workspaceId, "Cuenta BNB"));
  });
});

describe("D-49 · categorías", () => {
  it("se siembran por defecto al registrarse", async () => {
    const r = await session(db, a.userId).query<{ name: string; kind: string }>(
      "select name, kind from public.transaction_categories order by kind, name",
    );
    expect(r.rows.filter((c) => c.kind === "expense")).toHaveLength(7);
    expect(r.rows.filter((c) => c.kind === "income").map((c) => c.name)).toEqual(["Otros ingresos", "Sueldo"]);
  });

  it("se pueden crear, renombrar y archivar; mismo nombre solo en tipos distintos", async () => {
    const A = session(db, a.userId);
    const ins = (name: string, kind: string) =>
      A.query<{ id: string }>(
        `insert into public.transaction_categories (workspace_id, name, kind) values ('${a.workspaceId}', '${name}', '${kind}') returning id`,
      );
    const id = (await ins("Mascotas", "expense")).rows[0].id;
    await ins("Mascotas", "income");
    await expect(ins("  MASCOTAS", "expense")).rejects.toThrow(/duplicate key/i);
    await A.query("update public.transaction_categories set name = 'Mascotas y vet' where id = $1", [id]);
    await A.query("update public.transaction_categories set archived_at = now() where id = $1", [id]);
    await ins("Mascotas", "expense");
  });

  it("rechaza tipo y nombre inválidos", async () => {
    const A = session(db, a.userId);
    await expect(A.query(`insert into public.transaction_categories (workspace_id, name, kind) values ('${a.workspaceId}', 'Z', 'transfer')`)).rejects.toThrow(/check constraint/i);
    await expect(A.query(`insert into public.transaction_categories (workspace_id, name, kind) values ('${a.workspaceId}', ' ', 'expense')`)).rejects.toThrow(/check constraint/i);
  });

  it("las funciones de siembra no son invocables por la API", async () => {
    const A = session(db, a.userId);
    await expect(A.query("select public.seed_default_categories($1)", [a.workspaceId])).rejects.toThrow(/permission denied/i);
    await expect(A.query("select public.seed_categories_for_new_workspace()")).rejects.toThrow(/permission denied/i);
  });
});
