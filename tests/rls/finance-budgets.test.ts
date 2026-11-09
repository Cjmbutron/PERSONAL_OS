import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Finanzas, paso 3: presupuestos, obligaciones y reportes (D-52 a D-55). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
let acc: string;
let accUsdLike: string; // segunda cuenta BOB
let accB: string;
let catFood: string;
let catHome: string;
let catIncome: string;
let catB: string;

const A = () => session(db, a.userId);
const B = () => session(db, b.userId);
type S = ReturnType<typeof A>;

const first = async (s: S, kind: string, name?: string) =>
  (await s.query<{ id: string }>(
    `select id from public.transaction_categories where kind = $1 ${name ? "and name = $2" : ""} order by name limit 1`,
    name ? [kind, name] : [kind],
  )).rows[0].id;

const account = async (s: S, ws: string, name: string, opening = 0) =>
  (await s.query<{ id: string }>(
    "insert into public.financial_accounts (workspace_id, name, account_type, currency, opening_balance) values ($1, $2, 'bank', 'BOB', $3) returning id",
    [ws, name, opening],
  )).rows[0].id;

const today = "(now() at time zone 'America/La_Paz')::date";

const budget = (s: S, ws: string, month: string, cat: string | null, amount: number) =>
  s.query<{ id: string }>(
    "insert into public.budgets (workspace_id, period_month, category_id, currency, amount) values ($1, $2, $3, 'BOB', $4) returning id",
    [ws, month, cat, amount],
  );

const obligation = (s: S, ws: string, o: { name?: string; amount?: number; due?: string; recurrence?: string; cat?: string | null }) =>
  s.query<{ id: string }>(
    `insert into public.financial_obligations (workspace_id, name, amount, currency, due_date, recurrence, category_id)
     values ($1, $2, $3, 'BOB', $4, $5, $6) returning id`,
    [ws, o.name ?? "Alquiler", o.amount ?? 1000, o.due ?? "2026-11-30", o.recurrence ?? "none", o.cat ?? null],
  );

const pay = (s: S, id: string, accountId: string, date: string | null = null, cat: string | null = null) =>
  s.query<{ pay_obligation: string }>(`select public.pay_obligation($1, $2, coalesce($3::date, ${today}), $4)`, [id, accountId, date, cat]);

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  acc = await account(A(), a.workspaceId, "Principal", 5000);
  accUsdLike = await account(A(), a.workspaceId, "Secundaria", 0);
  accB = await account(B(), b.workspaceId, "B", 100);
  catFood = await first(A(), "expense", "Alimentación");
  catHome = await first(A(), "expense", "Vivienda");
  catIncome = await first(A(), "income", "Sueldo");
  catB = await first(B(), "expense", "Alimentación");
});

afterAll(async () => {
  await db.close();
});

describe("presupuestos (D-52)", () => {
  it("crea presupuestos por categoría de gasto y un total del mes", async () => {
    await budget(A(), a.workspaceId, "2026-11-01", catFood, 800);
    await budget(A(), a.workspaceId, "2026-11-01", null, 3000);
  });

  it("solo categorías de gasto y del propio workspace", async () => {
    await expect(budget(A(), a.workspaceId, "2026-11-01", catIncome, 100)).rejects.toThrow(/budgets_category_fk/);
    await expect(budget(A(), a.workspaceId, "2026-11-01", catB, 100)).rejects.toThrow(/budgets_category_fk/);
    await expect(budget(A(), b.workspaceId, "2026-11-01", catB, 100)).rejects.toThrow(/row-level security/i);
  });

  it("un presupuesto activo por mes y categoría, y uno de total por mes", async () => {
    await expect(budget(A(), a.workspaceId, "2026-11-01", catFood, 1)).rejects.toThrow(/budgets_one_per_category|duplicate key/i);
    await expect(budget(A(), a.workspaceId, "2026-11-01", null, 1)).rejects.toThrow(/budgets_one_total|duplicate key/i);
    await budget(A(), a.workspaceId, "2026-12-01", catFood, 700); // otro mes: permitido
  });

  it("valida importe positivo y primer día del mes", async () => {
    await expect(budget(A(), a.workspaceId, "2026-10-01", catHome, 0)).rejects.toThrow(/check constraint/i);
    await expect(budget(A(), a.workspaceId, "2026-10-01", catHome, -5)).rejects.toThrow(/check constraint/i);
    await expect(budget(A(), a.workspaceId, "2026-10-15", catHome, 5)).rejects.toThrow(/check constraint/i);
  });

  it("solo se edita el importe; archivar libera el hueco; sin DELETE; aislado", async () => {
    const id = (await budget(A(), a.workspaceId, "2026-09-01", catHome, 500)).rows[0].id;
    await A().query("update public.budgets set amount = 600 where id = $1", [id]);
    await expect(A().query("update public.budgets set category_id = null where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await expect(A().query("update public.budgets set period_month = '2026-08-01' where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await A().query("update public.budgets set archived_at = now() where id = $1", [id]);
    await budget(A(), a.workspaceId, "2026-09-01", catHome, 550);
    await expect(A().query("delete from public.budgets")).rejects.toThrow(/permission denied/i);
    expect((await B().query("select * from public.budgets")).rows).toHaveLength(0);
    expect((await B().query("update public.budgets set amount = 1 returning id")).rows).toHaveLength(0);
    await expect(session(db, null).query("select * from public.budgets")).rejects.toThrow(/permission denied/i);
  });

  it("copy_budgets copia al mes siguiente y omite los ya existentes", async () => {
    const copied = await A().query<{ copy_budgets: number }>("select public.copy_budgets($1, '2026-11-01', '2027-01-01')", [a.workspaceId]);
    expect(copied.rows[0].copy_budgets).toBe(2);
    const again = await A().query<{ copy_budgets: number }>("select public.copy_budgets($1, '2026-11-01', '2027-01-01')", [a.workspaceId]);
    expect(again.rows[0].copy_budgets).toBe(0);
    // Copia con "pisar" parcial: el mes 12 ya tiene Alimentación; solo se añade el total.
    const partial = await A().query<{ copy_budgets: number }>("select public.copy_budgets($1, '2026-11-01', '2026-12-01')", [a.workspaceId]);
    expect(partial.rows[0].copy_budgets).toBe(1);
    await expect(A().query("select public.copy_budgets($1, '2026-11-01', '2026-11-01')", [a.workspaceId])).rejects.toThrow(/distintos/);
  });

  it("copy_budgets no copia a ni desde el workspace de otro", async () => {
    await expect(B().query("select public.copy_budgets($1, '2026-11-01', '2027-02-01')", [a.workspaceId])).resolves.toMatchObject({
      rows: [{ copy_budgets: 0 }],
    });
    expect((await A().query("select 1 from public.budgets where period_month = '2027-02-01'")).rows).toHaveLength(0);
    await expect(session(db, null).query("select public.copy_budgets($1, '2026-11-01', '2027-02-01')", [a.workspaceId])).rejects.toThrow(/permission denied/i);
  });
});

describe("obligaciones (D-54)", () => {
  it("crea, edita y cancela; el día ancla sigue al vencimiento", async () => {
    const id = (await obligation(A(), a.workspaceId, { due: "2026-11-30" })).rows[0].id;
    const row = async () => (await A().query<{ anchor_day: number; status: string }>("select anchor_day, status from public.financial_obligations where id = $1", [id])).rows[0];
    expect((await row()).anchor_day).toBe(30);
    await A().query("update public.financial_obligations set due_date = '2026-12-15', amount = 1200 where id = $1", [id]);
    expect((await row()).anchor_day).toBe(15);
    await A().query("update public.financial_obligations set status = 'cancelled' where id = $1", [id]);
    await A().query("update public.financial_obligations set status = 'pending' where id = $1", [id]);
  });

  it("validaciones: importe, nombre, categoría de gasto del propio workspace", async () => {
    await expect(obligation(A(), a.workspaceId, { amount: 0 })).rejects.toThrow(/check constraint/i);
    await expect(obligation(A(), a.workspaceId, { name: "  " })).rejects.toThrow(/check constraint/i);
    await expect(obligation(A(), a.workspaceId, { cat: catIncome })).rejects.toThrow(/financial_obligations_category_fk/);
    await expect(obligation(A(), a.workspaceId, { cat: catB })).rejects.toThrow(/financial_obligations_category_fk/);
    await expect(obligation(A(), b.workspaceId, {})).rejects.toThrow(/row-level security/i);
  });

  it("el cliente no puede marcar como pagada ni tocar campos de pago o ancla", async () => {
    const id = (await obligation(A(), a.workspaceId, {})).rows[0].id;
    await expect(A().query("update public.financial_obligations set status = 'paid' where id = $1", [id])).rejects.toThrow(/row-level security|violates/i);
    for (const col of ["paid_at = now()", "paid_transaction_id = gen_random_uuid()", "anchor_day = 1", "currency = 'USD'", `workspace_id = '${b.workspaceId}'`]) {
      await expect(A().query(`update public.financial_obligations set ${col} where id = $1`, [id])).rejects.toThrow(/permission denied/i);
    }
    await expect(A().query("delete from public.financial_obligations")).rejects.toThrow(/permission denied/i);
    expect((await B().query("update public.financial_obligations set amount = 1 where id = $1 returning id", [id])).rows).toHaveLength(0);
  });

  it("pagar registra el gasto, marca como pagada y mueve el saldo", async () => {
    const before = Number((await A().query<{ balance: string }>("select balance from public.account_balances where account_id = $1", [acc])).rows[0].balance);
    const id = (await obligation(A(), a.workspaceId, { amount: 250.5, cat: catHome })).rows[0].id;
    const tx = (await pay(A(), id, acc)).rows[0].pay_obligation;

    const t = (await A().query<{ kind: string; amount: string; category_id: string; description: string }>("select kind, amount, category_id, description from public.transactions where id = $1", [tx])).rows[0];
    expect(t).toMatchObject({ kind: "expense", amount: "250.50", category_id: catHome, description: "Alquiler" });
    const o = (await A().query<{ status: string; paid_transaction_id: string }>("select status, paid_transaction_id from public.financial_obligations where id = $1", [id])).rows[0];
    expect(o).toEqual({ status: "paid", paid_transaction_id: tx });
    const after = Number((await A().query<{ balance: string }>("select balance from public.account_balances where account_id = $1", [acc])).rows[0].balance);
    expect(after).toBe(before - 250.5);
    // Una pagada no se edita ni se vuelve a pagar.
    expect((await A().query("update public.financial_obligations set amount = 1 where id = $1 returning id", [id])).rows).toHaveLength(0);
    await expect(pay(A(), id, acc)).rejects.toThrow(/ya no está pendiente/);
  });

  it("pagar exige categoría y valida la cuenta", async () => {
    const id = (await obligation(A(), a.workspaceId, {})).rows[0].id;
    await expect(pay(A(), id, acc)).rejects.toThrow(/categoría de gasto/);
    await expect(pay(A(), id, accB, null, catFood)).rejects.toThrow(/no existe en tu workspace/);
    const arch = await account(A(), a.workspaceId, "Cerrada", 0);
    await A().query("update public.financial_accounts set archived_at = now() where id = $1", [arch]);
    await expect(pay(A(), id, arch, null, catFood)).rejects.toThrow(/archivada/);
    await expect(pay(A(), id, acc, "2999-01-01", catFood)).rejects.toThrow(/fecha futura/);
    await expect(pay(A(), id, acc, null, catIncome)).rejects.toThrow(/transactions_category_fk/);
    // Todo falló: sigue pendiente y no se creó ningún gasto.
    expect((await A().query("select status from public.financial_obligations where id = $1", [id])).rows).toEqual([{ status: "pending" }]);
    await pay(A(), id, acc, null, catFood); // categoría explícita: funciona
  });

  it("es atómica: si el gasto falla, la obligación no cambia", async () => {
    const id = (await obligation(A(), a.workspaceId, { cat: catHome })).rows[0].id;
    const count = async () => Number((await A().query<{ n: string }>("select count(*) n from public.transactions")).rows[0].n);
    const n = await count();
    await expect(pay(A(), id, acc, "2999-01-01")).rejects.toThrow();
    expect(await count()).toBe(n);
    expect((await A().query("select status from public.financial_obligations where id = $1", [id])).rows).toEqual([{ status: "pending" }]);
  });

  it("no se puede pagar la obligación de otro ni sin sesión", async () => {
    const id = (await obligation(A(), a.workspaceId, { cat: catHome })).rows[0].id;
    await expect(pay(B(), id, accB)).rejects.toThrow(/no existe/);
    await expect(pay(session(db, null), id, acc)).rejects.toThrow(/permission denied/i);
  });

  it("recurrencia mensual: crea la siguiente y conserva el día (31 → feb 28 → mar 31)", async () => {
    const id = (await obligation(A(), a.workspaceId, { name: "Internet", due: "2027-01-31", recurrence: "monthly", cat: catHome })).rows[0].id;
    await pay(A(), id, acc);
    const next = (await A().query<{ id: string; due_date: string; status: string; anchor_day: number; recurrence: string; category_id: string }>(
      "select id, to_char(due_date, 'YYYY-MM-DD') as due_date, status, anchor_day, recurrence, category_id from public.financial_obligations where name = 'Internet' and status = 'pending'")).rows;
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ due_date: "2027-02-28", anchor_day: 31, recurrence: "monthly", category_id: catHome });

    await pay(A(), next[0].id, acc);
    const third = (await A().query<{ due_date: string }>("select to_char(due_date, 'YYYY-MM-DD') as due_date from public.financial_obligations where name = 'Internet' and status = 'pending'")).rows;
    expect(third).toEqual([{ due_date: "2027-03-31" }]);
  });

  it("una obligación sin recurrencia no genera otra", async () => {
    const id = (await obligation(A(), a.workspaceId, { name: "Única", cat: catHome })).rows[0].id;
    await pay(A(), id, acc);
    expect((await A().query("select 1 from public.financial_obligations where name = 'Única'")).rows).toHaveLength(1);
  });
});

describe("reportes (D-55)", () => {
  it("monthly_totals agrupa por mes y moneda, sin transferencias ni archivados", async () => {
    const A2 = A();
    const tx = (kind: string, cat: string, amount: number, date: string) =>
      A2.query("insert into public.transactions (workspace_id, account_id, currency, kind, amount, transaction_date, category_id) values ($1, $2, 'BOB', $3, $4, $5, $6)",
        [a.workspaceId, accUsdLike, kind, amount, date, cat]);
    await tx("income", catIncome, 1000, "2026-05-10");
    await tx("expense", catFood, 100, "2026-05-11");
    await tx("expense", catFood, 50.5, "2026-05-20");
    await tx("expense", catHome, 300, "2026-05-21");
    await tx("expense", catFood, 70, "2026-04-02");
    const gone = (await A2.query<{ id: string }>("insert into public.transactions (workspace_id, account_id, currency, kind, amount, transaction_date, category_id) values ($1, $2, 'BOB', 'expense', 999, '2026-05-22', $3) returning id", [a.workspaceId, accUsdLike, catFood])).rows[0].id;
    await A2.query("update public.transactions set archived_at = now() where id = $1", [gone]);
    await A2.query("select public.create_transfer($1, $2, $3, 500, '2026-05-15', null)", [a.workspaceId, acc, accUsdLike]);

    const totals = await A2.query<{ month: string; kind: string; total: string }>(
      "select to_char(month, 'YYYY-MM-DD') as month, kind, total from public.monthly_totals where month in ('2026-04-01', '2026-05-01') and workspace_id = $1 and currency = 'BOB' order by month, kind", [a.workspaceId]);
    expect(totals.rows.map((r) => [r.month, r.kind, Number(r.total)])).toEqual([
      ["2026-04-01", "expense", 70],
      ["2026-05-01", "expense", 450.5],
      ["2026-05-01", "income", 1000],
    ]);

    const cats = await A2.query<{ category_id: string; total: string }>(
      "select category_id, total from public.monthly_category_totals where month = '2026-05-01' and kind = 'expense' and workspace_id = $1 order by total desc", [a.workspaceId]);
    expect(cats.rows.map((r) => [r.category_id, Number(r.total)])).toEqual([[catHome, 300], [catFood, 150.5]]);
  });

  it("las vistas solo muestran lo del propio usuario y no son para anon", async () => {
    expect((await B().query("select * from public.monthly_totals")).rows).toHaveLength(0);
    expect((await B().query("select * from public.monthly_category_totals")).rows).toHaveLength(0);
    await expect(session(db, null).query("select * from public.monthly_totals")).rejects.toThrow(/permission denied/i);
    await expect(session(db, null).query("select * from public.monthly_category_totals")).rejects.toThrow(/permission denied/i);
  });

  it("funciones internas no invocables", async () => {
    await expect(A().query("select public.set_obligation_anchor_day()")).rejects.toThrow(/permission denied/i);
  });
});
