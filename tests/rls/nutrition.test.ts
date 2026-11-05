import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/**
 * Alimentación (Sprint 2): aislamiento, rangos, día local, sin futuro y sin DELETE (D-30 a D-32).
 * Los días se comprueban con instantes fijos en el pasado (La Paz = UTC-4, sin horario de verano).
 */

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };
let mealA: string;

const insertSql = `insert into public.meal_logs
  (workspace_id, meal_type, eaten_at, description, calories, protein_g, carbs_g, fat_g)
  values ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8)
  returning id, eaten_date::text as eaten_date`;

type Meal = Partial<{
  type: string;
  at: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}>;

const params = (workspaceId: string, m: Meal = {}) => [
  workspaceId,
  m.type ?? "lunch",
  m.at ?? "2020-03-10 13:00-04",
  m.description ?? "Arroz con pollo",
  m.calories === undefined ? 650 : m.calories,
  m.protein === undefined ? 35 : m.protein,
  m.carbs === undefined ? 80 : m.carbs,
  m.fat === undefined ? 18 : m.fat,
];

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  mealA = (await session(db, a.userId).query<{ id: string }>(insertSql, params(a.workspaceId))).rows[0].id;
});

afterAll(async () => {
  await db.close();
});

describe("D-30 · campos y rangos", () => {
  const A = () => session(db, a.userId);

  it("acepta una comida completa y una con solo lo obligatorio (NULL ≠ 0)", async () => {
    const full = await A().query(insertSql, params(a.workspaceId, { type: "breakfast", at: "2020-03-11 08:00-04" }));
    const min = await A().query<{ id: string }>(
      insertSql,
      params(a.workspaceId, { type: "snack", description: "Fruta", calories: null, protein: null, carbs: null, fat: null }),
    );
    expect(full.rows).toHaveLength(1);
    const row = await A().query<{ calories: number | null; protein_g: string | null }>(
      "select calories, protein_g from public.meal_logs where id = $1",
      [min.rows[0].id],
    );
    expect(row.rows[0]).toEqual({ calories: null, protein_g: null });
    const zero = await A().query<{ id: string }>(
      insertSql,
      params(a.workspaceId, { type: "snack", description: "Café", calories: 0, protein: 0, carbs: 0, fat: 0 }),
    );
    const z = await A().query<{ calories: number }>("select calories from public.meal_logs where id = $1", [zero.rows[0].id]);
    expect(z.rows[0].calories).toBe(0);
  });

  it("acepta los extremos de los rangos", async () => {
    const r = await A().query(
      insertSql,
      params(a.workspaceId, { at: "2020-03-12 13:00-04", calories: 10000, protein: 2000, carbs: 2000, fat: 2000 }),
    );
    expect(r.rows).toHaveLength(1);
  });

  it("rechaza tipo de comida, descripción y rangos inválidos", async () => {
    const bad = (m: Meal) => expect(A().query(insertSql, params(a.workspaceId, m))).rejects.toThrow(/check constraint/i);
    await bad({ type: "brunch" });
    await bad({ description: "   " });
    await bad({ description: "x".repeat(501) });
    await bad({ calories: -1 });
    await bad({ calories: 10001 });
    await bad({ protein: -0.1 });
    await bad({ carbs: 2000.1 });
    await bad({ fat: -5 });
  });

  it("rechaza comidas en el futuro", async () => {
    await expect(
      A().query(insertSql, params(a.workspaceId, { at: new Date(Date.now() + 3 * 3600_000).toISOString() })),
    ).rejects.toThrow(/en el futuro/i);
  });
});

describe("D-31 · el día es el día local del usuario", () => {
  const A = () => session(db, a.userId);

  it("una cena a las 00:30 cuenta para el día nuevo, no para el anterior", async () => {
    const late = await A().query<{ eaten_date: string; id: string }>(
      insertSql,
      params(a.workspaceId, { type: "dinner", at: "2020-05-02 00:30-04", description: "Cena tardía" }),
    );
    expect(late.rows[0].eaten_date).toBe("2020-05-02");
    const early = await A().query<{ eaten_date: string }>(
      insertSql,
      params(a.workspaceId, { type: "dinner", at: "2020-05-01 23:30-04", description: "Cena" }),
    );
    expect(early.rows[0].eaten_date).toBe("2020-05-01");
  });

  it("usa la zona horaria del perfil, no UTC", async () => {
    // 2020-06-02 02:00 UTC = 2020-06-01 22:00 en La Paz.
    const r = await A().query<{ eaten_date: string }>(
      insertSql,
      params(a.workspaceId, { at: "2020-06-02 02:00+00", description: "Cena en UTC" }),
    );
    expect(r.rows[0].eaten_date).toBe("2020-06-01");
  });

  it("al editar eaten_at se recalcula el día", async () => {
    const id = (await A().query<{ id: string }>(insertSql, params(a.workspaceId, { at: "2020-07-01 12:00-04" }))).rows[0].id;
    await A().query("update public.meal_logs set eaten_at = '2020-07-03 12:00-04' where id = $1", [id]);
    const r = await A().query<{ d: string }>("select eaten_date::text as d from public.meal_logs where id = $1", [id]);
    expect(r.rows[0].d).toBe("2020-07-03");
  });

  it("el cliente no puede escribir eaten_date", async () => {
    await expect(
      A().query("update public.meal_logs set eaten_date = '2020-01-01' where id = $1", [mealA]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      A().query(
        "insert into public.meal_logs (workspace_id, meal_type, eaten_at, eaten_date, description) values ($1, 'lunch', '2020-03-10 13:00-04', '2020-01-01', 'x')",
        [a.workspaceId],
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("7.4 · aislamiento", () => {
  it("B no ve ni modifica las comidas de A", async () => {
    const B = session(db, b.userId);
    expect((await B.query("select id from public.meal_logs")).rows).toHaveLength(0);
    const upd = await B.query("update public.meal_logs set description = 'hackeado' where id = $1", [mealA]);
    expect(upd.affectedRows).toBe(0);
    const arch = await B.query("update public.meal_logs set archived_at = now() where id = $1", [mealA]);
    expect(arch.affectedRows).toBe(0);
  });

  it("A no puede insertar en el workspace de B", async () => {
    await expect(session(db, a.userId).query(insertSql, params(b.workspaceId))).rejects.toThrow(/row-level security/i);
  });

  it("no se puede mover una comida a otro workspace", async () => {
    await expect(
      session(db, a.userId).query("update public.meal_logs set workspace_id = $1 where id = $2", [b.workspaceId, mealA]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("anon no accede y nadie puede borrar (D-21)", async () => {
    await expect(session(db, null).query("select * from public.meal_logs")).rejects.toThrow(/permission denied/i);
    await expect(session(db, a.userId).query("delete from public.meal_logs where id = $1", [mealA])).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("archivar y restaurar con archived_at", async () => {
    const A = session(db, a.userId);
    await A.query("update public.meal_logs set archived_at = now() where id = $1", [mealA]);
    expect((await A.query("select 1 from public.meal_logs where id = $1 and archived_at is null", [mealA])).rows).toHaveLength(0);
    await A.query("update public.meal_logs set archived_at = null where id = $1", [mealA]);
    expect((await A.query("select 1 from public.meal_logs where id = $1 and archived_at is null", [mealA])).rows).toHaveLength(1);
  });
});
