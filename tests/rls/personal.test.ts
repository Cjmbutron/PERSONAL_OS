import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Sprint 4: calendario, objetivos e hitos (D-57 a D-64, D-68). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
let areaPersonal: string;

const A = () => session(db, a.userId);
const B = () => session(db, b.userId);
type S = ReturnType<typeof A>;

const timed = (s: S, ws: string, starts: string, ends: string, title = "Cena") =>
  s.query<{ id: string }>(
    `insert into public.calendar_events (workspace_id, title, all_day, starts_at, ends_at, life_area_id)
     values ($1, $2, false, $3, $4, $5) returning id`,
    [ws, title, starts, ends, areaPersonal],
  );

const allDay = (s: S, ws: string, start: string, end: string, title = "Viaje") =>
  s.query<{ id: string }>(
    "insert into public.calendar_events (workspace_id, title, all_day, start_date, end_date) values ($1, $2, true, $3, $4) returning id",
    [ws, title, start, end],
  );

const days = async (s: S, id: string) =>
  (await s.query<{ first_day: string; last_day: string }>(
    "select to_char(first_day, 'YYYY-MM-DD') as first_day, to_char(last_day, 'YYYY-MM-DD') as last_day from public.calendar_events where id = $1",
    [id],
  )).rows[0];

const goal = (s: S, ws: string, title = "Correr 10K", extra = "") =>
  s.query<{ id: string }>(`insert into public.goals (workspace_id, title ${extra ? "," + extra.split("=")[0] : ""}) values ($1, $2 ${extra ? "," + extra.split("=")[1] : ""}) returning id`, [ws, title]);

const milestone = (s: S, ws: string, goalId: string, title: string, done = false) =>
  s.query<{ id: string }>(
    "insert into public.goal_milestones (workspace_id, goal_id, title, done, position) values ($1, $2, $3, $4, 0) returning id",
    [ws, goalId, title, done],
  );

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  areaPersonal = (await A().query<{ id: string }>("select id from public.life_areas where code = 'PERSONAL'")).rows[0].id;
});

afterAll(async () => {
  await db.close();
});

describe("eventos: tipos y validaciones (D-57, D-59)", () => {
  it("crea eventos con hora y de todo el día", async () => {
    await timed(A(), a.workspaceId, "2026-11-10T14:00:00Z", "2026-11-10T16:00:00Z");
    await allDay(A(), a.workspaceId, "2026-11-20", "2026-11-22");
    await allDay(A(), a.workspaceId, "2026-11-25", "2026-11-25"); // un solo día
    await timed(A(), a.workspaceId, "2026-11-10T14:00:00Z", "2026-11-10T14:00:00Z", "Puntual"); // sin duración
  });

  it("rechaza fin anterior al inicio y duraciones excesivas", async () => {
    await expect(timed(A(), a.workspaceId, "2026-11-10T16:00:00Z", "2026-11-10T14:00:00Z")).rejects.toThrow(/calendar_events_shape/);
    await expect(allDay(A(), a.workspaceId, "2026-11-22", "2026-11-20")).rejects.toThrow(/calendar_events_shape/);
    await expect(timed(A(), a.workspaceId, "2026-11-01T00:00:00Z", "2026-11-15T00:00:01Z")).rejects.toThrow(/calendar_events_shape/);
    await timed(A(), a.workspaceId, "2026-11-01T00:00:00Z", "2026-11-15T00:00:00Z", "Justo 14 días");
    await expect(allDay(A(), a.workspaceId, "2026-11-01", "2026-12-02")).rejects.toThrow(/calendar_events_shape/);
    await allDay(A(), a.workspaceId, "2026-11-01", "2026-12-01", "Justo 31 días");
  });

  it("no mezcla los dos tipos ni deja campos sin completar", async () => {
    const bad = (sql: string) => expect(A().query(sql, [a.workspaceId])).rejects.toThrow(/calendar_events_shape|null value/i);
    await bad("insert into public.calendar_events (workspace_id, title, all_day, starts_at, ends_at, start_date, end_date) values ($1, 'x', false, now(), now(), current_date, current_date)");
    await bad("insert into public.calendar_events (workspace_id, title, all_day, start_date, end_date, starts_at) values ($1, 'x', true, current_date, current_date, now())");
    await bad("insert into public.calendar_events (workspace_id, title, all_day, starts_at) values ($1, 'x', false, now())");
    await bad("insert into public.calendar_events (workspace_id, title, all_day) values ($1, 'x', true)");
  });

  it("valida título, textos y dimensión", async () => {
    const ins = (title: string, extra = "") =>
      A().query(
        `insert into public.calendar_events (workspace_id, title, all_day, start_date, end_date ${extra ? ", " + extra.split("|")[0] : ""})
         values ($1, $2, true, '2026-11-01', '2026-11-01' ${extra ? ", " + extra.split("|")[1] : ""})`,
        [a.workspaceId, title],
      );
    await expect(ins("   ")).rejects.toThrow(/check constraint/i);
    await expect(ins("x".repeat(151))).rejects.toThrow(/check constraint/i);
    await expect(ins("ok", `location|'${"l".repeat(201)}'`)).rejects.toThrow(/check constraint/i);
    await expect(ins("ok", `life_area_id|gen_random_uuid()`)).rejects.toThrow(/foreign key/i);
  });
});

describe("eventos: días locales (D-58, D-61)", () => {
  it("un evento con hora usa el día local del perfil (La Paz, UTC−4)", async () => {
    // 2026-11-06 02:00Z = 5 nov 22:00 en La Paz.
    const id = (await timed(A(), a.workspaceId, "2026-11-06T02:00:00Z", "2026-11-06T03:00:00Z")).rows[0].id;
    expect(await days(A(), id)).toEqual({ first_day: "2026-11-05", last_day: "2026-11-05" });
  });

  it("un evento que cruza la medianoche cubre los dos días", async () => {
    const id = (await timed(A(), a.workspaceId, "2026-11-06T02:00:00Z", "2026-11-06T06:00:00Z", "Fiesta")).rows[0].id;
    expect(await days(A(), id)).toEqual({ first_day: "2026-11-05", last_day: "2026-11-06" });
  });

  it("los de todo el día usan sus fechas, sin zona horaria", async () => {
    const id = (await allDay(A(), a.workspaceId, "2026-12-24", "2026-12-26")).rows[0].id;
    expect(await days(A(), id)).toEqual({ first_day: "2026-12-24", last_day: "2026-12-26" });
  });

  it("se recalculan al editar, también al cambiar de tipo", async () => {
    const id = (await timed(A(), a.workspaceId, "2026-11-10T14:00:00Z", "2026-11-10T15:00:00Z")).rows[0].id;
    await A().query("update public.calendar_events set starts_at = '2026-11-12T14:00:00Z', ends_at = '2026-11-12T15:00:00Z' where id = $1", [id]);
    expect(await days(A(), id)).toEqual({ first_day: "2026-11-12", last_day: "2026-11-12" });
    await A().query(
      "update public.calendar_events set all_day = true, starts_at = null, ends_at = null, start_date = '2026-11-30', end_date = '2026-12-02' where id = $1",
      [id],
    );
    expect(await days(A(), id)).toEqual({ first_day: "2026-11-30", last_day: "2026-12-02" });
  });

  it("el cliente no puede fijar first_day ni last_day", async () => {
    const id = (await allDay(A(), a.workspaceId, "2026-11-01", "2026-11-01")).rows[0].id;
    await expect(A().query("update public.calendar_events set first_day = '2030-01-01' where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await expect(A().query("update public.calendar_events set last_day = '2030-01-01' where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await expect(
      A().query("insert into public.calendar_events (workspace_id, title, all_day, start_date, end_date, first_day, last_day) values ($1, 'x', true, '2026-11-01', '2026-11-01', '2030-01-01', '2030-01-01')", [a.workspaceId]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("eventos: aislamiento y privilegios", () => {
  it("cada usuario solo ve y modifica lo suyo; no puede insertar en otro workspace", async () => {
    const id = (await allDay(A(), a.workspaceId, "2026-11-03", "2026-11-03", "Privado")).rows[0].id;
    expect((await B().query("select 1 from public.calendar_events where id = $1", [id])).rows).toHaveLength(0);
    expect((await B().query("update public.calendar_events set title = 'Hack' where id = $1 returning id", [id])).rows).toHaveLength(0);
    await expect(allDay(A(), b.workspaceId, "2026-11-03", "2026-11-03")).rejects.toThrow(/row-level security/i);
  });

  it("sin DELETE, workspace inmutable, archivar/restaurar, anon sin acceso", async () => {
    const id = (await allDay(A(), a.workspaceId, "2026-11-04", "2026-11-04")).rows[0].id;
    await expect(A().query("delete from public.calendar_events")).rejects.toThrow(/permission denied/i);
    await expect(A().query("update public.calendar_events set workspace_id = $2 where id = $1", [id, b.workspaceId])).rejects.toThrow(/permission denied/i);
    await A().query("update public.calendar_events set archived_at = now() where id = $1", [id]);
    await A().query("update public.calendar_events set archived_at = null where id = $1", [id]);
    await expect(session(db, null).query("select * from public.calendar_events")).rejects.toThrow(/permission denied/i);
  });

  it("la función del trigger no es invocable por la API", async () => {
    await expect(A().query("select public.set_event_days()")).rejects.toThrow(/permission denied/i);
  });
});

describe("objetivos (D-62, D-63)", () => {
  it("crea con valores por defecto y valida campos", async () => {
    const id = (await goal(A(), a.workspaceId)).rows[0].id;
    const g = (await A().query<{ status: string; manual_progress: number; completed_at: string | null }>("select status, manual_progress, completed_at from public.goals where id = $1", [id])).rows[0];
    expect(g).toEqual({ status: "active", manual_progress: 0, completed_at: null });
    await expect(goal(A(), a.workspaceId, " ")).rejects.toThrow(/check constraint/i);
    await expect(goal(A(), a.workspaceId, "x".repeat(151))).rejects.toThrow(/check constraint/i);
    await expect(goal(A(), a.workspaceId, "ok", "status='hecho'")).rejects.toThrow(/check constraint/i);
    await expect(goal(A(), a.workspaceId, "ok", "manual_progress=101")).rejects.toThrow(/check constraint/i);
    await expect(goal(A(), a.workspaceId, "ok", "manual_progress=-1")).rejects.toThrow(/check constraint/i);
  });

  it("completed_at lo fija el trigger y se limpia al reabrir; el cliente no puede escribirlo", async () => {
    const id = (await goal(A(), a.workspaceId, "Meta")).rows[0].id;
    await A().query("update public.goals set status = 'completed' where id = $1", [id]);
    const done = (await A().query<{ completed_at: string }>("select completed_at from public.goals where id = $1", [id])).rows[0].completed_at;
    expect(done).not.toBeNull();
    await A().query("update public.goals set title = 'Meta 2' where id = $1", [id]);
    expect((await A().query<{ completed_at: string }>("select completed_at from public.goals where id = $1", [id])).rows[0].completed_at).toEqual(done);
    await A().query("update public.goals set status = 'active' where id = $1", [id]);
    expect((await A().query<{ completed_at: string | null }>("select completed_at from public.goals where id = $1", [id])).rows[0].completed_at).toBeNull();
    await expect(A().query("update public.goals set completed_at = now() where id = $1", [id])).rejects.toThrow(/permission denied/i);
  });

  it("aislamiento, sin DELETE, archivar y asociar a una dimensión", async () => {
    const id = (await goal(A(), a.workspaceId, "Mío")).rows[0].id;
    expect((await B().query("select 1 from public.goals where id = $1", [id])).rows).toHaveLength(0);
    expect((await B().query("update public.goals set title = 'x' where id = $1 returning id", [id])).rows).toHaveLength(0);
    await expect(goal(A(), b.workspaceId)).rejects.toThrow(/row-level security/i);
    await expect(A().query("delete from public.goals")).rejects.toThrow(/permission denied/i);
    await A().query("update public.goals set archived_at = now(), life_area_id = $2 where id = $1", [id, areaPersonal]);
    await expect(A().query("update public.goals set life_area_id = gen_random_uuid() where id = $1", [id])).rejects.toThrow(/foreign key/i);
  });
});

describe("hitos y avance (D-68)", () => {
  it("done_at lo fija el trigger; el cliente no lo escribe", async () => {
    const g = (await goal(A(), a.workspaceId, "Con hitos")).rows[0].id;
    const m = (await milestone(A(), a.workspaceId, g, "Comprar zapatillas")).rows[0].id;
    const row = async () => (await A().query<{ done: boolean; done_at: string | null }>("select done, done_at from public.goal_milestones where id = $1", [m])).rows[0];
    expect(await row()).toEqual({ done: false, done_at: null });
    await A().query("update public.goal_milestones set done = true where id = $1", [m]);
    const checked = await row();
    expect(checked.done).toBe(true);
    expect(checked.done_at).not.toBeNull();
    await A().query("update public.goal_milestones set title = 'Zapatillas' where id = $1", [m]);
    expect((await row()).done_at).toEqual(checked.done_at);
    await A().query("update public.goal_milestones set done = false where id = $1", [m]);
    expect(await row()).toEqual({ done: false, done_at: null });
    await expect(A().query("update public.goal_milestones set done_at = now() where id = $1", [m])).rejects.toThrow(/permission denied/i);
  });

  it("la vista goal_progress cuenta hitos totales y hechos", async () => {
    const g = (await goal(A(), a.workspaceId, "Progreso")).rows[0].id;
    await milestone(A(), a.workspaceId, g, "Uno", true);
    await milestone(A(), a.workspaceId, g, "Dos", true);
    await milestone(A(), a.workspaceId, g, "Tres");
    const p = (await A().query<{ milestones_total: number; milestones_done: number }>("select milestones_total, milestones_done from public.goal_progress where goal_id = $1", [g])).rows[0];
    expect(p).toEqual({ milestones_total: 3, milestones_done: 2 });
    const empty = (await goal(A(), a.workspaceId, "Sin hitos")).rows[0].id;
    expect((await A().query("select milestones_total, milestones_done from public.goal_progress where goal_id = $1", [empty])).rows).toEqual([{ milestones_total: 0, milestones_done: 0 }]);
  });

  it("un hito solo puede colgar de un objetivo del mismo workspace", async () => {
    const gB = (await goal(B(), b.workspaceId, "De B")).rows[0].id;
    await expect(milestone(A(), a.workspaceId, gB, "Intruso")).rejects.toThrow(/goal_milestones_goal_fk/);
    await expect(milestone(A(), b.workspaceId, gB, "Intruso")).rejects.toThrow(/row-level security/i);
  });

  it("máximo 50 hitos por objetivo", async () => {
    const g = (await goal(A(), a.workspaceId, "Muchos")).rows[0].id;
    await A().query(
      "insert into public.goal_milestones (workspace_id, goal_id, title, position) select $1, $2, 'h' || n, n from generate_series(1, 50) n",
      [a.workspaceId, g],
    );
    await expect(milestone(A(), a.workspaceId, g, "El 51")).rejects.toThrow(/máximo 50/);
  });

  it("se pueden borrar los propios (composición) pero no los ajenos; goal_id inmutable", async () => {
    const g = (await goal(A(), a.workspaceId, "Borrar")).rows[0].id;
    const m = (await milestone(A(), a.workspaceId, g, "Temporal")).rows[0].id;
    expect((await B().query("delete from public.goal_milestones where id = $1 returning id", [m])).rows).toHaveLength(0);
    await expect(A().query("update public.goal_milestones set goal_id = gen_random_uuid() where id = $1", [m])).rejects.toThrow(/permission denied/i);
    expect((await A().query("delete from public.goal_milestones where id = $1 returning id", [m])).rows).toHaveLength(1);
  });

  it("la vista no filtra datos de otros usuarios ni es para anon", async () => {
    expect((await B().query("select * from public.goal_progress where workspace_id = $1", [a.workspaceId])).rows).toHaveLength(0);
    await expect(session(db, null).query("select * from public.goal_progress")).rejects.toThrow(/permission denied/i);
  });
});
