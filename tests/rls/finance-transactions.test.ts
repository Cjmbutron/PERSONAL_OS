import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Finanzas, paso 2: movimientos, transferencias atómicas y saldos (D-41, D-44 a D-51). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
let acc1: string; // BOB, saldo inicial 1000
let acc2: string; // BOB, saldo inicial 0
let accB: string;
let catExpense: string;
let catIncome: string;
let catB: string;

const A = () => session(db, a.userId);
const B = () => session(db, b.userId);

async function account(s: ReturnType<typeof A>, ws: string, name: string, opening: number) {
  return (
    await s.query<{ id: string }>(
      `insert into public.financial_accounts (workspace_id, name, account_type, currency, opening_balance)
       values ($1, $2, 'bank', 'BOB', $3) returning id`,
      [ws, name, opening],
    )
  ).rows[0].id;
}

async function category(s: ReturnType<typeof A>, kind: string) {
  return (await s.query<{ id: string }>("select id from public.transaction_categories where kind = $1 order by name limit 1", [kind])).rows[0].id;
}

const insTx = (s: ReturnType<typeof A>, p: { ws: string; acc: string; kind: string; amount: number; date?: string; cat: string | null; currency?: string }) =>
  s.query<{ id: string }>(
    `insert into public.transactions (workspace_id, account_id, currency, kind, amount, transaction_date, category_id, description)
     values ($1, $2, $3, $4, $5, coalesce($6::date, (now() at time zone 'America/La_Paz')::date), $7, 'prueba') returning id`,
    [p.ws, p.acc, p.currency ?? "BOB", p.kind, p.amount, p.date ?? null, p.cat],
  );

const balance = async (s: ReturnType<typeof A>, acc: string) =>
  Number((await s.query<{ balance: string }>("select balance from public.account_balances where account_id = $1", [acc])).rows[0].balance);

const transfer = (s: ReturnType<typeof A>, ws: string, from: string, to: string, amount: number | null, date: string | null = null) =>
  s.query<{ create_transfer: string }>("select public.create_transfer($1, $2, $3, $4, coalesce($5::date, (now() at time zone 'America/La_Paz')::date), 'ahorro')", [ws, from, to, amount, date]);

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  acc1 = await account(A(), a.workspaceId, "Cuenta 1", 1000);
  acc2 = await account(A(), a.workspaceId, "Cuenta 2", 0);
  accB = await account(B(), b.workspaceId, "Cuenta B", 500);
  catExpense = await category(A(), "expense");
  catIncome = await category(A(), "income");
  catB = await category(B(), "expense");
});

afterAll(async () => {
  await db.close();
});

describe("movimientos: integridad (reglas 4.3 · 7 y 9, D-41, D-48)", () => {
  it("registra ingresos y gastos con categoría del tipo correcto", async () => {
    await insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "income", amount: 200, cat: catIncome });
    await insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 50.5, cat: catExpense });
  });

  it("rechaza categoría de otro tipo", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: catIncome })).rejects.toThrow(/transactions_category_fk/);
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "income", amount: 1, cat: catExpense })).rejects.toThrow(/transactions_category_fk/);
  });

  it("ingreso/gasto exige categoría; importe positivo", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: null })).rejects.toThrow(/transactions_shape/);
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 0, cat: catExpense })).rejects.toThrow(/check constraint/i);
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: -5, cat: catExpense })).rejects.toThrow(/check constraint/i);
  });

  it("la moneda debe coincidir con la de la cuenta", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: catExpense, currency: "USD" })).rejects.toThrow(/transactions_account_fk/);
  });

  it("no mezcla workspaces: cuenta o categoría ajenas", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: accB, kind: "expense", amount: 1, cat: catExpense })).rejects.toThrow(/transactions_account_fk/);
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: catB })).rejects.toThrow(/transactions_category_fk/);
    await expect(insTx(A(), { ws: b.workspaceId, acc: accB, kind: "expense", amount: 1, cat: catB })).rejects.toThrow(/row-level security/i);
  });

  it("rechaza fechas futuras y acepta la de hoy", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: catExpense, date: "2999-01-01" })).rejects.toThrow(/fecha futura/);
    await insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat: catExpense });
  });

  it("no se permiten movimientos en cuentas ni con categorías archivadas", async () => {
    const acc = await account(A(), a.workspaceId, "Archivada", 0);
    await A().query("update public.financial_accounts set archived_at = now() where id = $1", [acc]);
    await expect(insTx(A(), { ws: a.workspaceId, acc, kind: "expense", amount: 1, cat: catExpense })).rejects.toThrow(/cuenta está archivada/);

    const cat = (await A().query<{ id: string }>(
      "insert into public.transaction_categories (workspace_id, name, kind) values ($1, 'Vieja', 'expense') returning id", [a.workspaceId])).rows[0].id;
    await A().query("update public.transaction_categories set archived_at = now() where id = $1", [cat]);
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 1, cat })).rejects.toThrow(/categoría está archivada/);
  });
});

describe("privilegios y aislamiento", () => {
  it("sin DELETE; anon no accede", async () => {
    await expect(A().query("delete from public.transactions")).rejects.toThrow(/permission denied/i);
    await expect(session(db, null).query("select * from public.transactions")).rejects.toThrow(/permission denied/i);
    await expect(session(db, null).query("select * from public.account_balances")).rejects.toThrow(/permission denied/i);
  });

  it("cada usuario solo ve lo suyo, incluidos los saldos", async () => {
    const mine = await B().query<{ workspace_id: string }>("select workspace_id from public.transactions");
    expect(mine.rows.every((r) => r.workspace_id === b.workspaceId)).toBe(true);
    const bal = await B().query<{ account_id: string }>("select account_id from public.account_balances");
    expect(bal.rows.map((r) => r.account_id)).toEqual([accB]);
  });

  it("cuenta, moneda, tipo y grupo no se modifican; lo ajeno no se actualiza", async () => {
    const id = (await insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "expense", amount: 3, cat: catExpense })).rows[0].id;
    for (const col of [`account_id = '${acc2}'`, "currency = 'USD'", "kind = 'income'", "transfer_group_id = gen_random_uuid()", `workspace_id = '${b.workspaceId}'`]) {
      await expect(A().query(`update public.transactions set ${col} where id = $1`, [id])).rejects.toThrow(/permission denied/i);
    }
    const other = await B().query("update public.transactions set amount = 9 where id = $1 returning id", [id]);
    expect(other.rows).toHaveLength(0);
  });

  it("se puede editar importe, fecha, categoría y descripción; archivar y restaurar", async () => {
    const id = (await insTx(A(), { ws: a.workspaceId, acc: acc2, kind: "income", amount: 10, cat: catIncome })).rows[0].id;
    await A().query("update public.transactions set amount = 12.5, description = 'editado' where id = $1", [id]);
    await expect(A().query("update public.transactions set transaction_date = '2999-01-01' where id = $1", [id])).rejects.toThrow(/fecha futura/);
    await expect(A().query("update public.transactions set category_id = $2 where id = $1", [id, catExpense])).rejects.toThrow(/transactions_category_fk/);
    await A().query("update public.transactions set archived_at = now() where id = $1", [id]);
    await A().query("update public.transactions set archived_at = null where id = $1", [id]);
    await A().query("update public.transactions set archived_at = now() where id = $1", [id]);
  });
});

describe("saldo calculado (D-44)", () => {
  it("saldo inicial + ingresos − gastos, ignorando archivados", async () => {
    const acc = await account(A(), a.workspaceId, "Saldo", 100);
    expect(await balance(A(), acc)).toBe(100);
    await insTx(A(), { ws: a.workspaceId, acc, kind: "income", amount: 50.25, cat: catIncome });
    const gasto = (await insTx(A(), { ws: a.workspaceId, acc, kind: "expense", amount: 20.1, cat: catExpense })).rows[0].id;
    expect(await balance(A(), acc)).toBe(130.15);
    await A().query("update public.transactions set archived_at = now() where id = $1", [gasto]);
    expect(await balance(A(), acc)).toBe(150.25);
  });

  it("una cuenta sin movimientos muestra su saldo inicial; cambiarlo lo desplaza", async () => {
    const acc = await account(A(), a.workspaceId, "Vacía", -40);
    expect(await balance(A(), acc)).toBe(-40);
    await A().query("update public.financial_accounts set opening_balance = 10 where id = $1", [acc]);
    expect(await balance(A(), acc)).toBe(10);
  });
});

describe("transferencias atómicas (6.5, D-50, D-51)", () => {
  it("crea dos patas vinculadas y mueve los saldos sin alterar el total", async () => {
    const before1 = await balance(A(), acc1);
    const before2 = await balance(A(), acc2);
    const group = (await transfer(A(), a.workspaceId, acc1, acc2, 100.5)).rows[0].create_transfer;

    const legs = await A().query<{ kind: string; account_id: string; amount: string; currency: string; category_id: string | null }>(
      "select kind, account_id, amount, currency, category_id from public.transactions where transfer_group_id = $1 order by kind", [group]);
    expect(legs.rows).toHaveLength(2);
    expect(legs.rows.map((l) => l.kind)).toEqual(["transfer_in", "transfer_out"]);
    expect(legs.rows.every((l) => Number(l.amount) === 100.5 && l.currency === "BOB" && l.category_id === null)).toBe(true);

    expect(await balance(A(), acc1)).toBe(before1 - 100.5);
    expect(await balance(A(), acc2)).toBe(before2 + 100.5);
  });

  it("valida cuentas distintas, importe, fecha y pertenencia", async () => {
    await expect(transfer(A(), a.workspaceId, acc1, acc1, 5)).rejects.toThrow(/distintas/);
    await expect(transfer(A(), a.workspaceId, acc1, acc2, 0)).rejects.toThrow(/mayor que cero/);
    await expect(transfer(A(), a.workspaceId, acc1, acc2, -3)).rejects.toThrow(/mayor que cero/);
    await expect(transfer(A(), a.workspaceId, acc1, acc2, null)).rejects.toThrow(/mayor que cero/);
    await expect(transfer(A(), a.workspaceId, acc1, acc2, 5, "2999-01-01")).rejects.toThrow(/fecha futura/);
    await expect(transfer(A(), a.workspaceId, acc1, accB, 5)).rejects.toThrow(/no existe en tu workspace/);
    await expect(transfer(A(), b.workspaceId, accB, acc1, 5)).rejects.toThrow(/Sin acceso/);
    await expect(transfer(B(), a.workspaceId, acc1, acc2, 5)).rejects.toThrow(/Sin acceso/);
  });

  it("es atómica: si una validación falla, no queda ninguna pata", async () => {
    const before = Number((await A().query<{ n: string }>("select count(*) n from public.transactions")).rows[0].n);
    await expect(transfer(A(), a.workspaceId, acc1, acc2, 5, "2999-01-01")).rejects.toThrow();
    const after = Number((await A().query<{ n: string }>("select count(*) n from public.transactions")).rows[0].n);
    expect(after).toBe(before);
  });

  it("no admite cuentas archivadas", async () => {
    const arch = await account(A(), a.workspaceId, "Cerrada", 0);
    await A().query("update public.financial_accounts set archived_at = now() where id = $1", [arch]);
    await expect(transfer(A(), a.workspaceId, acc1, arch, 5)).rejects.toThrow(/archivada/);
    await expect(transfer(A(), a.workspaceId, arch, acc1, 5)).rejects.toThrow(/archivada/);
  });

  it("el cliente no puede crear ni modificar patas por su cuenta", async () => {
    await expect(insTx(A(), { ws: a.workspaceId, acc: acc1, kind: "transfer_out", amount: 5, cat: null })).rejects.toThrow(/row-level security|transactions_shape/i);
    await expect(
      A().query(
        `insert into public.transactions (workspace_id, account_id, currency, kind, amount, transaction_date, transfer_group_id)
         values ($1, $2, 'BOB', 'transfer_in', 5, current_date, gen_random_uuid())`, [a.workspaceId, acc1]),
    ).rejects.toThrow(/permission denied/i);

    const group = (await transfer(A(), a.workspaceId, acc1, acc2, 7)).rows[0].create_transfer;
    const upd = await A().query("update public.transactions set amount = 1 where transfer_group_id = $1 returning id", [group]);
    expect(upd.rows).toHaveLength(0);
    const arch = await A().query("update public.transactions set archived_at = now() where transfer_group_id = $1 returning id", [group]);
    expect(arch.rows).toHaveLength(0);
  });

  it("se archiva y restaura completa; los saldos vuelven y regresan", async () => {
    const b1 = await balance(A(), acc1);
    const b2 = await balance(A(), acc2);
    const group = (await transfer(A(), a.workspaceId, acc1, acc2, 40)).rows[0].create_transfer;
    expect(await balance(A(), acc1)).toBe(b1 - 40);

    await A().query("select public.archive_transfer($1, true)", [group]);
    expect(await balance(A(), acc1)).toBe(b1);
    expect(await balance(A(), acc2)).toBe(b2);
    const archived = await A().query("select 1 from public.transactions where transfer_group_id = $1 and archived_at is not null", [group]);
    expect(archived.rows).toHaveLength(2);

    await A().query("select public.archive_transfer($1, false)", [group]);
    expect(await balance(A(), acc1)).toBe(b1 - 40);
  });

  it("no se puede restaurar si una cuenta quedó archivada, ni tocar transferencias ajenas", async () => {
    const x = await account(A(), a.workspaceId, "X", 100);
    const y = await account(A(), a.workspaceId, "Y", 0);
    const group = (await transfer(A(), a.workspaceId, x, y, 10)).rows[0].create_transfer;
    await A().query("select public.archive_transfer($1, true)", [group]);
    await A().query("update public.financial_accounts set archived_at = now() where id = $1", [y]);
    await expect(A().query("select public.archive_transfer($1, false)", [group])).rejects.toThrow(/archivada/);
    await expect(B().query("select public.archive_transfer($1, true)", [group])).rejects.toThrow(/no existe/);
    await expect(A().query("select public.archive_transfer(gen_random_uuid(), true)")).rejects.toThrow(/no existe/);
  });

  it("anon no puede ejecutar las funciones", async () => {
    const anon = session(db, null);
    await expect(anon.query("select public.create_transfer($1, $2, $3, 1, current_date, null)", [a.workspaceId, acc1, acc2])).rejects.toThrow(/permission denied/i);
    await expect(anon.query("select public.archive_transfer(gen_random_uuid(), true)")).rejects.toThrow(/permission denied/i);
  });

  it("el trigger interno no es invocable como RPC", async () => {
    await expect(A().query("select public.validate_transaction()")).rejects.toThrow(/permission denied/i);
  });
});
