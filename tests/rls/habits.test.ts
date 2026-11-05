import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/**
 * Hábitos (Sprint 2): aislamiento por workspace, integridad entre workspaces,
 * una fila por hábito y fecha, sin fechas futuras y sin DELETE (D-16 a D-20).
 */

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };
let habitA: string;
let habitB: string;

const insertHabit =
  "insert into public.habits (workspace_id, name, frequency_type) values ($1, $2, 'daily') returning id";

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  habitA = (await session(db, a.userId).query<{ id: string }>(insertHabit, [a.workspaceId, "Leer"])).rows[0].id;
  habitB = (await session(db, b.userId).query<{ id: string }>(insertHabit, [b.workspaceId, "Correr"])).rows[0].id;
});

afterAll(async () => {
  await db.close();
});

describe("D-16 · coherencia de la frecuencia", () => {
  const A = () => session(db, a.userId);
  const ins = (type: string, days: string, target: string) =>
    A().query(
      `insert into public.habits (workspace_id, name, frequency_type, days_of_week, target_per_week)
       values ($1, 'X', $2, ${days}, ${target})`,
      [a.workspaceId, type],
    );

  it("acepta las tres formas válidas", async () => {
    await ins("daily", "null", "null");
    await ins("days_of_week", "array[1,3,5]::smallint[]", "null");
    await ins("times_per_week", "null", "3");
  });

  it("rechaza combinaciones incoherentes", async () => {
    await expect(ins("daily", "array[1]::smallint[]", "null")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("daily", "null", "3")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("days_of_week", "null", "null")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("days_of_week", "array[]::smallint[]", "null")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("days_of_week", "array[0,8]::smallint[]", "null")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("times_per_week", "null", "null")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("times_per_week", "null", "8")).rejects.toThrow(/habits_frequency_consistent/);
    await expect(ins("times_per_week", "array[1]::smallint[]", "3")).rejects.toThrow(/habits_frequency_consistent/);
  });

  it("rechaza tipos y nombres inválidos", async () => {
    await expect(ins("monthly", "null", "null")).rejects.toThrow(/check constraint/i);
    await expect(
      A().query("insert into public.habits (workspace_id, name, frequency_type) values ($1, '   ', 'daily')", [
        a.workspaceId,
      ]),
    ).rejects.toThrow(/check constraint/i);
  });
});

describe("7.4 · aislamiento de hábitos y registros", () => {
  it("B no ve los hábitos de A y no puede modificarlos", async () => {
    const B = session(db, b.userId);
    const seen = await B.query("select id from public.habits where id = $1", [habitA]);
    expect(seen.rows).toHaveLength(0);

    const upd = await B.query("update public.habits set name = 'hackeado' where id = $1", [habitA]);
    expect(upd.affectedRows).toBe(0);
    const arch = await B.query("update public.habits set archived_at = now() where id = $1", [habitA]);
    expect(arch.affectedRows).toBe(0);
  });

  it("A no puede crear hábitos en el workspace de B", async () => {
    await expect(session(db, a.userId).query(insertHabit, [b.workspaceId, "Intruso"])).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("B no ve los registros de A", async () => {
    await session(db, a.userId).query(
      "insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date - 1)",
      [a.workspaceId, habitA],
    );
    const seen = await session(db, b.userId).query("select id from public.habit_logs");
    expect(seen.rows).toHaveLength(0);
  });

  it("A no puede registrar cumplimiento en un hábito de B (integridad entre workspaces, D-03)", async () => {
    const A = session(db, a.userId);
    // Con su propio workspace_id: la clave foránea compuesta lo rechaza.
    await expect(
      A.query("insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date - 1)", [
        a.workspaceId,
        habitB,
      ]),
    ).rejects.toThrow(/foreign key/i);
    // Con el workspace_id de B: RLS lo rechaza.
    await expect(
      A.query("insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date - 1)", [
        b.workspaceId,
        habitB,
      ]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("anon no puede leer ni escribir", async () => {
    const anon = session(db, null);
    await expect(anon.query("select * from public.habits")).rejects.toThrow(/permission denied/i);
    await expect(anon.query("select * from public.habit_logs")).rejects.toThrow(/permission denied/i);
  });

  it("nadie con rol authenticated puede borrar hábitos ni registros (D-02)", async () => {
    const A = session(db, a.userId);
    await expect(A.query("delete from public.habits where id = $1", [habitA])).rejects.toThrow(/permission denied/i);
    await expect(A.query("delete from public.habit_logs")).rejects.toThrow(/permission denied/i);
  });
});

describe("D-17 · registros diarios", () => {
  it("regla 6.4.6: no admite dos registros para la misma fecha", async () => {
    const A = session(db, a.userId);
    await A.query(
      "insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date - 3)",
      [a.workspaceId, habitA],
    );
    await expect(
      A.query("insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date - 3)", [
        a.workspaceId,
        habitA,
      ]),
    ).rejects.toThrow(/habit_logs_habit_date_key|duplicate key/i);
  });

  it("deshacer y rehacer funciona con upsert (sin DELETE)", async () => {
    const A = session(db, a.userId);
    const upsert = (completed: boolean) =>
      A.query(
        `insert into public.habit_logs (workspace_id, habit_id, log_date, completed)
         values ($1, $2, current_date - 5, $3)
         on conflict (habit_id, log_date) do update set completed = excluded.completed`,
        [a.workspaceId, habitA, completed],
      );
    await upsert(true);
    await upsert(false);
    let row = await A.query<{ completed: boolean; n: number }>(
      "select completed, count(*) over ()::int as n from public.habit_logs where habit_id = $1 and log_date = current_date - 5",
      [habitA],
    );
    expect(row.rows).toEqual([{ completed: false, n: 1 }]);
    await upsert(true);
    row = await A.query("select completed from public.habit_logs where habit_id = $1 and log_date = current_date - 5", [
      habitA,
    ]);
    expect(row.rows[0]).toEqual({ completed: true });
  });

  it("no se pueden registrar fechas futuras", async () => {
    await expect(
      session(db, a.userId).query(
        "insert into public.habit_logs (workspace_id, habit_id, log_date) values ($1, $2, current_date + 2)",
        [a.workspaceId, habitA],
      ),
    ).rejects.toThrow(/fechas futuras/i);
  });

  it("'hoy' se calcula con la zona horaria del perfil (D-08)", async () => {
    const tz = "Pacific/Kiritimati"; // UTC+14
    await db.query("update public.profiles set timezone = $1 where id = $2", [tz, a.userId]);
    const { rows } = await db.query<{ today: string; tomorrow: string }>(
      "select (now() at time zone $1)::date::text as today, ((now() at time zone $1)::date + 1)::text as tomorrow",
      [tz],
    );
    const A = session(db, a.userId);
    const ins = (date: string) =>
      A.query(
        "insert into public.habit_logs (workspace_id, habit_id, log_date, completed) values ($1, $2, $3::date, true)",
        [a.workspaceId, habitA, date],
      );
    await ins(rows[0].today);
    await expect(ins(rows[0].tomorrow)).rejects.toThrow(/fechas futuras/i);
    await db.query("update public.profiles set timezone = 'America/La_Paz' where id = $1", [a.userId]);
  });

  it("habit_id y log_date no son modificables tras crear el registro", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("update public.habit_logs set log_date = current_date - 20 where habit_id = $1", [habitA]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      A.query("update public.habit_logs set habit_id = $1 where habit_id = $2", [habitB, habitA]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("D-20 · archivado", () => {
  it("se archiva y restaura con archived_at y conserva sus registros", async () => {
    const A = session(db, a.userId);
    await A.query("update public.habits set archived_at = now() where id = $1", [habitA]);
    const hidden = await A.query("select id from public.habits where id = $1 and archived_at is null", [habitA]);
    expect(hidden.rows).toHaveLength(0);
    const logs = await A.query("select id from public.habit_logs where habit_id = $1", [habitA]);
    expect(logs.rows.length).toBeGreaterThan(0);
    await A.query("update public.habits set archived_at = null where id = $1", [habitA]);
    const back = await A.query("select id from public.habits where id = $1 and archived_at is null", [habitA]);
    expect(back.rows).toHaveLength(1);
  });

  it("no se puede mover un hábito a otro workspace (7.2)", async () => {
    await expect(
      session(db, a.userId).query("update public.habits set workspace_id = $1 where id = $2", [b.workspaceId, habitA]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("marcar cumplimiento (regresión: no se guardaba)", () => {
  it("un upsert con DO UPDATE sobre todas las columnas es rechazado por los privilegios de columna", async () => {
    // Es lo que genera PostgREST con .upsert({workspace_id, habit_id, log_date, completed}).
    await expect(
      session(db, a.userId).query(
        `insert into public.habit_logs (workspace_id, habit_id, log_date, completed)
         values ($1, $2, current_date - 5, true)
         on conflict (habit_id, log_date) do update
           set workspace_id = excluded.workspace_id, habit_id = excluded.habit_id,
               log_date = excluded.log_date, completed = excluded.completed`,
        [a.workspaceId, habitA],
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("actualizar y luego insertar sí funciona (marcar, desmarcar y volver a marcar)", async () => {
    const A = session(db, a.userId);
    const setLog = async (done: boolean) => {
      const up = await A.query(
        "update public.habit_logs set completed = $2 where habit_id = $1 and log_date = current_date - 6 returning id",
        [habitA, done],
      );
      if (up.rows.length === 0) {
        await A.query(
          "insert into public.habit_logs (workspace_id, habit_id, log_date, completed) values ($1, $2, current_date - 6, $3)",
          [a.workspaceId, habitA, done],
        );
      }
    };
    await setLog(true);
    await setLog(false);
    await setLog(true);
    const rows = await A.query<{ completed: boolean }>(
      "select completed from public.habit_logs where habit_id = $1 and log_date = current_date - 6",
      [habitA],
    );
    expect(rows.rows).toEqual([{ completed: true }]);
  });
});
