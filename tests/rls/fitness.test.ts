import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/**
 * Entrenamiento (Sprint 2): aislamiento, series individuales, rutinas mensuales,
 * funciones transaccionales y reglas de borrado (D-33 a D-39).
 * Fechas fijas en el pasado; La Paz = UTC-4 sin horario de verano.
 */

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };

const A = () => session(db, a.userId);
const B = () => session(db, b.userId);

type Ex = { name: string; notes?: string; distance_km?: number | null; duration_min?: number | null; sets?: { reps: number; weight_kg: number | null }[] };

const squat: Ex = {
  name: "Sentadilla",
  sets: [
    { reps: 5, weight_kg: 80 },
    { reps: 3, weight_kg: 85 },
  ],
};

/** Llama a save_workout_session con valores por omisión razonables. */
function saveSession(
  s: ReturnType<typeof session>,
  ws: string,
  over: Partial<{
    id: string | null;
    routineId: string | null;
    routineDay: number | null;
    startedAt: string;
    type: string;
    duration: number | null;
    rpe: number | null;
    notes: string | null;
    exercises: unknown;
  }> = {},
) {
  const o = {
    id: null,
    routineId: null,
    routineDay: null,
    startedAt: "2020-03-10 18:00-04",
    type: "strength",
    duration: 60,
    rpe: 7,
    notes: null,
    exercises: [squat],
    ...over,
  };
  return s.query<{ id: string }>(
    "select public.save_workout_session($1::uuid, $2::uuid, $3::uuid, $4::smallint, $5::timestamptz, $6, $7::integer, $8::smallint, $9, $10::jsonb) as id",
    [ws, o.id, o.routineId, o.routineDay, o.startedAt, o.type, o.duration, o.rpe, o.notes, JSON.stringify(o.exercises)],
  );
}

function saveRoutine(
  s: ReturnType<typeof session>,
  ws: string,
  over: Partial<{ id: string | null; name: string; description: string | null; month: string; exercises: unknown }> = {},
) {
  const o = {
    id: null,
    name: "Fuerza A",
    description: null,
    month: "2020-03-01",
    exercises: [
      { day_of_week: 1, name: "Sentadilla", target_sets: 4, target_reps: 8, target_weight_kg: 60 },
      { day_of_week: 1, name: "Press banca", target_sets: 4, target_reps: 8, target_weight_kg: 50 },
      { day_of_week: 3, name: "Peso muerto", target_sets: 3, target_reps: 5, target_weight_kg: null },
    ],
    ...over,
  };
  return s.query<{ id: string }>(
    "select public.save_workout_routine($1::uuid, $2::uuid, $3, $4, $5::date, $6::jsonb) as id",
    [ws, o.id, o.name, o.description, o.month, JSON.stringify(o.exercises)],
  );
}

const count = async (s: ReturnType<typeof session>, sql: string, params: unknown[] = []) =>
  (await s.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params)).rows[0].n;

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
});

afterAll(async () => {
  await db.close();
});

describe("D-33 · sesiones con series individuales", () => {
  it("guarda sesión, ejercicios y series en orden, con día local calculado", async () => {
    const id = (await saveSession(A(), a.workspaceId, {
      startedAt: "2020-05-02 00:30-04",
      exercises: [squat, { name: "Remo", sets: [{ reps: 10, weight_kg: null }] }],
    })).rows[0].id;

    const s = await A().query<{ started_date: string; type: string }>(
      "select started_date::text as started_date, type from public.workout_sessions where id = $1",
      [id],
    );
    expect(s.rows[0]).toEqual({ started_date: "2020-05-02", type: "strength" }); // 00:30 local = día nuevo

    const ex = await A().query<{ name: string; position: number; id: string }>(
      "select id, name, position from public.workout_exercises where session_id = $1 order by position",
      [id],
    );
    expect(ex.rows.map((r) => [r.position, r.name])).toEqual([[1, "Sentadilla"], [2, "Remo"]]);

    const sets = await A().query<{ set_number: number; reps: number; weight_kg: string | null }>(
      "select set_number, reps, weight_kg::text as weight_kg from public.workout_sets where exercise_id = $1 order by set_number",
      [ex.rows[0].id],
    );
    expect(sets.rows).toEqual([
      { set_number: 1, reps: 5, weight_kg: "80.0" },
      { set_number: 2, reps: 3, weight_kg: "85.0" },
    ]);
    const bodyweight = await A().query<{ weight_kg: string | null }>(
      "select weight_kg from public.workout_sets where exercise_id = $1",
      [ex.rows[1].id],
    );
    expect(bodyweight.rows[0].weight_kg).toBeNull(); // peso corporal
  });

  it("cardio: distancia y duración sin series", async () => {
    const id = (await saveSession(A(), a.workspaceId, {
      startedAt: "2020-05-03 07:00-04",
      type: "cardio",
      exercises: [{ name: "Correr", distance_km: 5.25, duration_min: 28 }],
    })).rows[0].id;
    const r = await A().query<{ d: string; m: number }>(
      "select distance_km::text as d, duration_min as m from public.workout_exercises where session_id = $1",
      [id],
    );
    expect(r.rows[0]).toEqual({ d: "5.25", m: 28 });
  });

  it("editar reemplaza ejercicios y series en una sola transacción", async () => {
    const id = (await saveSession(A(), a.workspaceId, { startedAt: "2020-06-01 18:00-04" })).rows[0].id;
    await saveSession(A(), a.workspaceId, {
      id,
      startedAt: "2020-06-01 18:00-04",
      notes: "Editada",
      exercises: [{ name: "Dominadas", sets: [{ reps: 8, weight_kg: null }, { reps: 6, weight_kg: null }, { reps: 5, weight_kg: null }] }],
    });
    expect(await count(A(), "public.workout_exercises where session_id = $1", [id])).toBe(1);
    expect(
      await count(A(), "public.workout_sets s join public.workout_exercises e on e.id = s.exercise_id where e.session_id = $1", [id]),
    ).toBe(3);
    const r = await A().query<{ notes: string }>("select notes from public.workout_sessions where id = $1", [id]);
    expect(r.rows[0].notes).toBe("Editada");
  });

  it("un error a mitad de la función revierte todo (atomicidad)", async () => {
    const before = await count(A(), "public.workout_sessions");
    await expect(
      saveSession(A(), a.workspaceId, {
        startedAt: "2020-06-02 18:00-04",
        exercises: [squat, { name: "Malo", sets: [{ reps: 0, weight_kg: 10 }] }], // reps 0 viola el CHECK
      }),
    ).rejects.toThrow(/check constraint/i);
    expect(await count(A(), "public.workout_sessions")).toBe(before);
    expect(await count(A(), "public.workout_exercises where name = 'Malo'")).toBe(0);
  });

  it("rechaza valores fuera de rango", async () => {
    const bad = (over: Parameters<typeof saveSession>[2]) =>
      expect(saveSession(A(), a.workspaceId, { startedAt: "2020-06-03 18:00-04", ...over })).rejects.toThrow(/check constraint/i);
    await bad({ type: "yoga" });
    await bad({ duration: 0 });
    await bad({ duration: 1441 });
    await bad({ rpe: 0 });
    await bad({ rpe: 11 });
    await bad({ exercises: [{ name: "  ", sets: [] }] });
    await bad({ exercises: [{ name: "X", sets: [{ reps: 5, weight_kg: -1 }] }] });
    await bad({ exercises: [{ name: "X", sets: [{ reps: 1001, weight_kg: 10 }] }] });
    await bad({ exercises: [{ name: "X", distance_km: 1001 }] });
  });

  it("rechaza entrenamientos en el futuro y exercises que no es un arreglo", async () => {
    await expect(
      saveSession(A(), a.workspaceId, { startedAt: new Date(Date.now() + 3 * 3600_000).toISOString() }),
    ).rejects.toThrow(/en el futuro/i);
    await expect(saveSession(A(), a.workspaceId, { startedAt: "2020-06-04 18:00-04", exercises: { a: 1 } })).rejects.toThrow(
      /arreglo/i,
    );
  });

  it("el cliente no puede escribir started_date", async () => {
    const id = (await saveSession(A(), a.workspaceId, { startedAt: "2020-06-05 18:00-04" })).rows[0].id;
    await expect(
      A().query("update public.workout_sessions set started_date = '2020-01-01' where id = $1", [id]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("D-34 a D-36 · rutinas mensuales", () => {
  let routineId: string;

  it("crea la rutina del mes con sus ejercicios planificados", async () => {
    routineId = (await saveRoutine(A(), a.workspaceId)).rows[0].id;
    const ex = await A().query<{ day_of_week: number; name: string; position: number }>(
      "select day_of_week, name, position from public.routine_exercises where routine_id = $1 order by position",
      [routineId],
    );
    expect(ex.rows.map((r) => [r.day_of_week, r.name])).toEqual([[1, "Sentadilla"], [1, "Press banca"], [3, "Peso muerto"]]);
  });

  it("una sola rutina activa por mes; archivar libera el mes", async () => {
    await expect(saveRoutine(A(), a.workspaceId, { name: "Otra" })).rejects.toThrow(/workout_routines_one_per_month|duplicate key/i);
    await A().query("update public.workout_routines set archived_at = now() where id = $1", [routineId]);
    const again = await saveRoutine(A(), a.workspaceId, { name: "Otra" });
    expect(again.rows).toHaveLength(1);
    // Restaurar la archivada ahora choca con la activa del mismo mes.
    await expect(
      A().query("update public.workout_routines set archived_at = null where id = $1", [routineId]),
    ).rejects.toThrow(/workout_routines_one_per_month|duplicate key/i);
    await A().query("update public.workout_routines set archived_at = now() where id = $1", [again.rows[0].id]);
    await A().query("update public.workout_routines set archived_at = null where id = $1", [routineId]);
  });

  it("period_month debe ser el primer día del mes", async () => {
    await expect(saveRoutine(A(), a.workspaceId, { month: "2020-04-15" })).rejects.toThrow(/check constraint/i);
  });

  it("duplicar al mes siguiente copia la rutina con todos sus ejercicios", async () => {
    const r = await A().query<{ id: string }>(
      "select public.duplicate_workout_routine($1::uuid, '2020-04-01'::date) as id",
      [routineId],
    );
    const copy = r.rows[0].id;
    expect(copy).not.toBe(routineId);
    const rows = await A().query<{ name: string; target_weight_kg: string | null; month: string }>(
      `select e.name, e.target_weight_kg::text as target_weight_kg, r.period_month::text as month
       from public.routine_exercises e join public.workout_routines r on r.id = e.routine_id
       where e.routine_id = $1 order by e.position`,
      [copy],
    );
    expect(rows.rows.map((x) => x.name)).toEqual(["Sentadilla", "Press banca", "Peso muerto"]);
    expect(rows.rows[0].month).toBe("2020-04-01");
    expect(rows.rows[2].target_weight_kg).toBeNull();
    // La original no cambia.
    expect(await count(A(), "public.routine_exercises where routine_id = $1", [routineId])).toBe(3);
  });

  it("duplicar a un mes que ya tiene rutina falla sin dejar nada a medias", async () => {
    const before = await count(A(), "public.workout_routines");
    await expect(
      A().query("select public.duplicate_workout_routine($1::uuid, '2020-04-01'::date)", [routineId]),
    ).rejects.toThrow(/duplicate key|workout_routines_one_per_month/i);
    expect(await count(A(), "public.workout_routines")).toBe(before);
  });

  it("editar la rutina reemplaza los ejercicios y no admite rutinas archivadas", async () => {
    await saveRoutine(A(), a.workspaceId, {
      id: routineId,
      exercises: [{ day_of_week: 5, name: "Dominadas", target_sets: 5, target_reps: 6, target_weight_kg: null }],
    });
    const ex = await A().query<{ name: string }>("select name from public.routine_exercises where routine_id = $1", [routineId]);
    expect(ex.rows).toEqual([{ name: "Dominadas" }]);

    const archived = (await saveRoutine(A(), a.workspaceId, { month: "2020-09-01" })).rows[0].id;
    await A().query("update public.workout_routines set archived_at = now() where id = $1", [archived]);
    await expect(saveRoutine(A(), a.workspaceId, { id: archived, month: "2020-09-01" })).rejects.toThrow(/no encontrada/i);
  });

  it("rechaza ejercicios planificados fuera de rango", async () => {
    const bad = (over: object) =>
      expect(
        saveRoutine(A(), a.workspaceId, {
          month: "2021-01-01",
          exercises: [{ day_of_week: 1, name: "X", target_sets: 3, target_reps: 8, target_weight_kg: 20, ...over }],
        }),
      ).rejects.toThrow(/check constraint/i);
    await bad({ day_of_week: 0 });
    await bad({ day_of_week: 8 });
    await bad({ target_sets: 0 });
    await bad({ target_sets: 21 });
    await bad({ target_reps: 0 });
    await bad({ target_weight_kg: -5 });
    await bad({ name: "" });
  });

  it("D-37: la sesión puede apuntar a una rutina de su workspace", async () => {
    const id = (await saveSession(A(), a.workspaceId, { startedAt: "2020-03-16 18:00-04", routineId, routineDay: 1 })).rows[0].id;
    const r = await A().query<{ routine_id: string; routine_day: number }>(
      "select routine_id, routine_day from public.workout_sessions where id = $1",
      [id],
    );
    expect(r.rows[0]).toEqual({ routine_id: routineId, routine_day: 1 });
  });
});

describe("7.4 · aislamiento y D-38 · integridad entre workspaces", () => {
  let sessionA: string;
  let routineA: string;
  let routineB: string;
  let sessionB: string;

  beforeAll(async () => {
    sessionA = (await saveSession(A(), a.workspaceId, { startedAt: "2020-07-01 18:00-04" })).rows[0].id;
    routineA = (await saveRoutine(A(), a.workspaceId, { month: "2020-07-01" })).rows[0].id;
    routineB = (await saveRoutine(B(), b.workspaceId, { month: "2020-03-01" })).rows[0].id;
    sessionB = (await saveSession(B(), b.workspaceId, { startedAt: "2020-07-01 18:00-04" })).rows[0].id;
  });

  it("B no ve nada de A en ninguna tabla", async () => {
    for (const t of ["workout_sessions", "workout_exercises", "workout_sets", "workout_routines", "routine_exercises"]) {
      const rows = await B().query<{ workspace_id: string }>(`select workspace_id from public.${t}`);
      expect(rows.rows.every((r) => r.workspace_id === b.workspaceId)).toBe(true);
    }
    expect((await B().query("select 1 from public.workout_sessions where id = $1", [sessionA])).rows).toHaveLength(0);
  });

  it("B no puede editar la sesión ni la rutina de A mediante las funciones", async () => {
    await expect(saveSession(B(), b.workspaceId, { id: sessionA })).rejects.toThrow(/no encontrada/i);
    await expect(saveRoutine(B(), b.workspaceId, { id: routineA })).rejects.toThrow(/no encontrada/i);
    await expect(
      B().query("select public.duplicate_workout_routine($1::uuid, '2021-02-01'::date)", [routineA]),
    ).rejects.toThrow(/no encontrada/i);
  });

  it("B no puede pasar el workspace de A a las funciones", async () => {
    await expect(saveSession(B(), a.workspaceId)).rejects.toThrow(/row-level security/i);
    await expect(saveRoutine(B(), a.workspaceId, { month: "2022-01-01" })).rejects.toThrow(/row-level security/i);
  });

  it("A no puede referenciar la rutina de B desde su sesión (clave compuesta)", async () => {
    await expect(saveSession(A(), a.workspaceId, { startedAt: "2020-07-02 18:00-04", routineId: routineB, routineDay: 1 })).rejects.toThrow(
      /foreign key/i,
    );
  });

  it("A no puede colgar un ejercicio de la sesión de B", async () => {
    await expect(
      A().query(
        "insert into public.workout_exercises (workspace_id, session_id, position, name) values ($1, $2, 1, 'Intruso')",
        [a.workspaceId, sessionB],
      ),
    ).rejects.toThrow(/foreign key/i);
    await expect(
      A().query(
        "insert into public.workout_exercises (workspace_id, session_id, position, name) values ($1, $2, 1, 'Intruso')",
        [b.workspaceId, sessionB],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("A no puede mover una sesión o rutina a otro workspace", async () => {
    await expect(
      A().query("update public.workout_sessions set workspace_id = $1 where id = $2", [b.workspaceId, sessionA]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      A().query("update public.workout_routines set workspace_id = $1 where id = $2", [b.workspaceId, routineA]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("anon no accede a las tablas ni ejecuta las funciones", async () => {
    const anon = session(db, null);
    for (const t of ["workout_sessions", "workout_exercises", "workout_sets", "workout_routines", "routine_exercises"]) {
      await expect(anon.query(`select * from public.${t}`)).rejects.toThrow(/permission denied/i);
    }
    await expect(
      anon.query("select public.duplicate_workout_routine($1::uuid, '2021-02-01'::date)", [routineA]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("D-39 · borrado", () => {
  it("sesiones y rutinas no se pueden borrar (archivado lógico)", async () => {
    await expect(A().query("delete from public.workout_sessions")).rejects.toThrow(/permission denied/i);
    await expect(A().query("delete from public.workout_routines")).rejects.toThrow(/permission denied/i);
  });

  it("archivar y restaurar una sesión con archived_at", async () => {
    const id = (await saveSession(A(), a.workspaceId, { startedAt: "2020-08-01 18:00-04" })).rows[0].id;
    await A().query("update public.workout_sessions set archived_at = now() where id = $1", [id]);
    expect(await count(A(), "public.workout_sessions where id = $1 and archived_at is null", [id])).toBe(0);
    await A().query("update public.workout_sessions set archived_at = null where id = $1", [id]);
    expect(await count(A(), "public.workout_sessions where id = $1 and archived_at is null", [id])).toBe(1);
  });

  it("el borrado de composición solo afecta al dueño", async () => {
    const id = (await saveSession(A(), a.workspaceId, { startedAt: "2020-08-02 18:00-04" })).rows[0].id;
    const byB = await B().query("delete from public.workout_exercises where session_id = $1", [id]);
    expect(byB.affectedRows).toBe(0);
    expect(await count(A(), "public.workout_exercises where session_id = $1", [id])).toBe(1);
    const byA = await A().query("delete from public.workout_exercises where session_id = $1", [id]);
    expect(byA.affectedRows).toBe(1);
    // Las series caen en cascada.
    expect(await count(A(), "public.workout_sets s where not exists (select 1 from public.workout_exercises e where e.id = s.exercise_id)")).toBe(0);
  });
});
