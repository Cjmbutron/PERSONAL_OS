import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Sprint 5: revisión semanal y prioridades (D-71 a D-74). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
const A = () => session(db, a.userId);
const B = () => session(db, b.userId);
type S = ReturnType<typeof A>;

// Lunes de la semana actual y de semanas anteriores/posteriores, en La Paz.
let monday: string;
const shift = async (days: number) =>
  (await A().query<{ d: string }>(`select to_char(($1::date + ${days}), 'YYYY-MM-DD') as d`, [monday])).rows[0].d;

const review = (s: S, ws: string, week: string, extra = "") =>
  s.query<{ id: string }>(`insert into public.weekly_reviews (workspace_id, week_start ${extra ? "," + extra.split("=")[0] : ""}) values ($1, $2 ${extra ? "," + extra.split("=")[1] : ""}) returning id`, [ws, week]);

const priority = (s: S, ws: string, week: string, title = "Cerrar propuesta", extra = "") =>
  s.query<{ id: string }>(
    `insert into public.weekly_priorities (workspace_id, week_start, position, title ${extra ? "," + extra.split("=")[0] : ""}) values ($1, $2, 0, $3 ${extra ? "," + extra.split("=")[1] : ""}) returning id`,
    [ws, week, title],
  );

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  monday = (await A().query<{ d: string }>(
    "select to_char(date_trunc('week', (now() at time zone 'America/La_Paz')::timestamp)::date, 'YYYY-MM-DD') as d",
  )).rows[0].d;
});

afterAll(async () => {
  await db.close();
});

describe("revisiones semanales", () => {
  it("crea una por semana, con valores por defecto, y rechaza duplicados", async () => {
    const w = await shift(-14);
    const id = (await review(A(), a.workspaceId, w)).rows[0].id;
    const r = (await A().query<{ status: string; completed_at: string | null }>("select status, completed_at from public.weekly_reviews where id = $1", [id])).rows[0];
    expect(r).toEqual({ status: "draft", completed_at: null });
    await expect(review(A(), a.workspaceId, w)).rejects.toThrow(/weekly_reviews_workspace_week_key/);
    await review(B(), b.workspaceId, w); // otra persona, misma semana: permitido
  });

  it("la semana debe empezar en lunes y no ser futura", async () => {
    await expect(review(A(), a.workspaceId, await shift(-20))).rejects.toThrow(/check constraint/i); // -20 días no es lunes
    await expect(review(A(), a.workspaceId, await shift(7))).rejects.toThrow(/aún no empieza/);
    await review(A(), a.workspaceId, monday); // la semana en curso sí
  });

  it("completed_at lo fija el trigger; el cliente no puede escribirlo; se puede reabrir y editar", async () => {
    const id = (await review(A(), a.workspaceId, await shift(-21))).rows[0].id;
    await A().query("update public.weekly_reviews set status = 'completed', went_well = 'Avancé' where id = $1", [id]);
    const done = (await A().query<{ completed_at: string }>("select completed_at from public.weekly_reviews where id = $1", [id])).rows[0].completed_at;
    expect(done).not.toBeNull();
    await A().query("update public.weekly_reviews set learnings = 'Planificar mejor' where id = $1", [id]);
    expect((await A().query<{ completed_at: string }>("select completed_at from public.weekly_reviews where id = $1", [id])).rows[0].completed_at).toEqual(done);
    await A().query("update public.weekly_reviews set status = 'draft' where id = $1", [id]);
    expect((await A().query<{ completed_at: string | null }>("select completed_at from public.weekly_reviews where id = $1", [id])).rows[0].completed_at).toBeNull();
    await expect(A().query("update public.weekly_reviews set completed_at = now() where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await expect(A().query("update public.weekly_reviews set week_start = week_start - 7 where id = $1", [id])).rejects.toThrow(/permission denied/i);
  });

  it("valida estado y longitud de los textos", async () => {
    const w = await shift(-28);
    await expect(review(A(), a.workspaceId, w, "status='x'")).rejects.toThrow(/check constraint/i);
    await expect(review(A(), a.workspaceId, w, `went_well='${"x".repeat(2001)}'`)).rejects.toThrow(/check constraint/i);
    await review(A(), a.workspaceId, w, `went_well='${"x".repeat(2000)}'`);
  });

  it("aislamiento, sin DELETE, anon sin acceso, no se inserta en otro workspace", async () => {
    const w = await shift(-35);
    const id = (await review(A(), a.workspaceId, w)).rows[0].id;
    expect((await B().query("select 1 from public.weekly_reviews where id = $1", [id])).rows).toHaveLength(0);
    expect((await B().query("update public.weekly_reviews set went_well = 'x' where id = $1 returning id", [id])).rows).toHaveLength(0);
    await expect(review(A(), b.workspaceId, w)).rejects.toThrow(/row-level security/i);
    await expect(A().query("delete from public.weekly_reviews")).rejects.toThrow(/permission denied/i);
    await expect(session(db, null).query("select * from public.weekly_reviews")).rejects.toThrow(/permission denied/i);
  });

  it("la función del trigger no es invocable por la API", async () => {
    await expect(A().query("select public.prepare_weekly_review()")).rejects.toThrow(/permission denied/i);
  });
});

describe("prioridades de la semana", () => {
  it("crea, marca como hecha (done_at por trigger) y borra", async () => {
    const w = await shift(7);
    const id = (await priority(A(), a.workspaceId, w)).rows[0].id;
    const row = async () => (await A().query<{ done: boolean; done_at: string | null }>("select done, done_at from public.weekly_priorities where id = $1", [id])).rows[0];
    expect(await row()).toEqual({ done: false, done_at: null });
    await A().query("update public.weekly_priorities set done = true where id = $1", [id]);
    const checked = await row();
    expect(checked.done_at).not.toBeNull();
    await A().query("update public.weekly_priorities set title = 'Otro' where id = $1", [id]);
    expect((await row()).done_at).toEqual(checked.done_at);
    await expect(A().query("update public.weekly_priorities set done_at = now() where id = $1", [id])).rejects.toThrow(/permission denied/i);
    expect((await A().query("delete from public.weekly_priorities where id = $1 returning id", [id])).rows).toHaveLength(1);
  });

  it("máximo 5 por semana, pero en otra semana se empieza de cero", async () => {
    const w = await shift(14);
    for (let i = 1; i <= 5; i++) await priority(A(), a.workspaceId, w, `P${i}`);
    await expect(priority(A(), a.workspaceId, w, "P6")).rejects.toThrow(/máximo 5/);
    await priority(A(), a.workspaceId, await shift(21), "Otra semana");
  });

  it("valida título y que la semana empiece en lunes", async () => {
    const w = await shift(28);
    await expect(priority(A(), a.workspaceId, w, "  ")).rejects.toThrow(/check constraint/i);
    await expect(priority(A(), a.workspaceId, w, "x".repeat(151))).rejects.toThrow(/check constraint/i);
    await expect(priority(A(), a.workspaceId, await shift(29), "Mal día")).rejects.toThrow(/check constraint/i);
  });

  it("solo se vincula a tareas y objetivos del mismo workspace", async () => {
    const w = await shift(35);
    const task = (await A().query<{ id: string }>("insert into public.tasks (workspace_id, title) values ($1, 'Mi tarea') returning id", [a.workspaceId])).rows[0].id;
    const goal = (await A().query<{ id: string }>("insert into public.goals (workspace_id, title) values ($1, 'Mi meta') returning id", [a.workspaceId])).rows[0].id;
    await priority(A(), a.workspaceId, w, "Con tarea", `task_id='${task}'`);
    await priority(A(), a.workspaceId, w, "Con meta", `goal_id='${goal}'`);
    const taskB = (await B().query<{ id: string }>("insert into public.tasks (workspace_id, title) values ($1, 'Ajena') returning id", [b.workspaceId])).rows[0].id;
    const goalB = (await B().query<{ id: string }>("insert into public.goals (workspace_id, title) values ($1, 'Ajena') returning id", [b.workspaceId])).rows[0].id;
    await expect(priority(A(), a.workspaceId, w, "Intruso", `task_id='${taskB}'`)).rejects.toThrow(/weekly_priorities_task_fk/);
    await expect(priority(A(), a.workspaceId, w, "Intruso", `goal_id='${goalB}'`)).rejects.toThrow(/weekly_priorities_goal_fk/);
  });

  it("aislamiento: no se ven, editan ni borran las ajenas; workspace_id y vínculos inmutables", async () => {
    const w = await shift(42);
    const id = (await priority(A(), a.workspaceId, w)).rows[0].id;
    expect((await B().query("select 1 from public.weekly_priorities where id = $1", [id])).rows).toHaveLength(0);
    expect((await B().query("update public.weekly_priorities set title = 'x' where id = $1 returning id", [id])).rows).toHaveLength(0);
    expect((await B().query("delete from public.weekly_priorities where id = $1 returning id", [id])).rows).toHaveLength(0);
    await expect(priority(A(), b.workspaceId, w)).rejects.toThrow(/row-level security/i);
    await expect(A().query("update public.weekly_priorities set task_id = gen_random_uuid() where id = $1", [id])).rejects.toThrow(/permission denied/i);
    await expect(A().query("update public.weekly_priorities set workspace_id = $2 where id = $1", [id, b.workspaceId])).rejects.toThrow(/permission denied/i);
    await expect(session(db, null).query("select * from public.weekly_priorities")).rejects.toThrow(/permission denied/i);
  });
});
