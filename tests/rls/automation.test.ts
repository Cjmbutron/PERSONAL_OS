import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/** Sprint 6: tareas recurrentes (complete_task) y estado de avisos (D-94 a D-98). */

type U = { userId: string; workspaceId: string };
let db: PGlite;
let a: U;
let b: U;
const A = () => session(db, a.userId);
const B = () => session(db, b.userId);

const task = async (ws: string, due: string | null, rec: string | null, title = "Pagar luz") =>
  (
    await A().query<{ id: string }>(
      "insert into public.tasks (workspace_id, title, due_date, recurrence) values ($1, $2, $3, $4) returning id",
      [ws, title, due, rec],
    )
  ).rows[0].id;

const next = (from: string, rec: string, anchor: number | null, today: string) =>
  db
    .query<{ d: string }>("select to_char(public.next_recurrence_date($1, $2::date, $3, $4::date), 'YYYY-MM-DD') as d", [rec, from, anchor, today])
    .then((r) => r.rows[0].d);

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
});
afterAll(async () => {
  await db.close();
});

describe("next_recurrence_date", () => {
  it("diaria y semanal avanzan desde el vencimiento", async () => {
    expect(await next("2020-01-10", "daily", null, "2020-01-01")).toBe("2020-01-11");
    expect(await next("2020-01-10", "weekly", null, "2020-01-01")).toBe("2020-01-17");
  });
  it("si se completa tarde, salta al siguiente hueco futuro de la serie", async () => {
    expect(await next("2020-01-10", "daily", null, "2020-01-15")).toBe("2020-01-16");
    expect(await next("2020-01-10", "weekly", null, "2020-01-25")).toBe("2020-01-31");
  });
  it("mensual conserva el día ancla (31 → 29 feb bisiesto → 31)", async () => {
    expect(await next("2024-01-31", "monthly", 31, "2024-01-01")).toBe("2024-02-29");
    expect(await next("2024-02-29", "monthly", 31, "2024-01-01")).toBe("2024-03-31");
    expect(await next("2023-01-31", "monthly", 31, "2023-01-01")).toBe("2023-02-28");
    expect(await next("2024-12-15", "monthly", 15, "2024-01-01")).toBe("2025-01-15");
  });
});

describe("complete_task", () => {
  it("una tarea sin recurrencia solo se completa", async () => {
    const id = await task(a.workspaceId, "2030-01-01", null);
    const r = await A().query<{ n: string | null }>("select public.complete_task($1) as n", [id]);
    expect(r.rows[0].n).toBeNull();
    const t = (await A().query<{ status: string }>("select status from public.tasks where id = $1", [id])).rows[0];
    expect(t.status).toBe("completed");
  });

  it("una recurrente crea la siguiente con los mismos datos, pendiente y enlazada", async () => {
    const id = await task(a.workspaceId, "2030-01-31", "monthly");
    const day = (await A().query<{ d: number }>("select recurrence_day as d from public.tasks where id = $1", [id])).rows[0].d;
    expect(day).toBe(31);
    const n = (await A().query<{ n: string }>("select public.complete_task($1) as n", [id])).rows[0].n;
    const t = (
      await A().query<{ status: string; title: string; due: string; rec: string; src: string; d: number }>(
        "select status, title, to_char(due_date,'YYYY-MM-DD') as due, recurrence as rec, recurrence_source_id as src, recurrence_day as d from public.tasks where id = $1",
        [n],
      )
    ).rows[0];
    expect(t).toEqual({ status: "pending", title: "Pagar luz", due: "2030-02-28", rec: "monthly", src: id, d: 31 });
  });

  it("completar dos veces no duplica la sucesora", async () => {
    const id = await task(a.workspaceId, "2030-05-01", "weekly");
    await A().query("select public.complete_task($1)", [id]);
    await A().query("update public.tasks set status = 'pending' where id = $1", [id]);
    const again = (await A().query<{ n: string | null }>("select public.complete_task($1) as n", [id])).rows[0].n;
    expect(again).toBeNull();
    const c = (await A().query<{ c: number }>("select count(*)::int as c from public.tasks where recurrence_source_id = $1", [id])).rows[0].c;
    expect(c).toBe(1);
  });

  it("la recurrencia exige fecha de vencimiento y un valor válido", async () => {
    await expect(task(a.workspaceId, null, "daily")).rejects.toThrow(/tasks_recurrence_needs_due_date/);
    await expect(task(a.workspaceId, "2030-01-01", "yearly")).rejects.toThrow(/check constraint/i);
  });

  it("no se puede completar la tarea de otra persona, ni fijar el día ancla a mano", async () => {
    const id = await task(a.workspaceId, "2030-01-01", "daily");
    await expect(B().query("select public.complete_task($1)", [id])).rejects.toThrow(/no encontrada/);
    await expect(A().query("update public.tasks set recurrence_day = 5 where id = $1", [id])).rejects.toThrow(/permission denied/);
    await A().query("update public.tasks set recurrence = null where id = $1", [id]); // dejar de repetir
  });
});

describe("notice_states", () => {
  const put = (s: ReturnType<typeof A>, ws: string, key: string, state = "read") =>
    s.query("insert into public.notice_states (workspace_id, notice_key, state) values ($1, $2, $3)", [ws, key, state]);

  it("crea, cambia de estado, evita duplicados y se puede borrar", async () => {
    await put(A(), a.workspaceId, "weekly-review:2030-01-07");
    await expect(put(A(), a.workspaceId, "weekly-review:2030-01-07")).rejects.toThrow(/duplicate key/);
    await A().query("update public.notice_states set state = 'dismissed' where notice_key = 'weekly-review:2030-01-07'");
    const s = (await A().query<{ state: string }>("select state from public.notice_states")).rows[0].state;
    expect(s).toBe("dismissed");
    await A().query("delete from public.notice_states");
    expect((await A().query("select 1 from public.notice_states")).rows).toHaveLength(0);
  });

  it("valida el estado y aísla por persona", async () => {
    await expect(put(A(), a.workspaceId, "k", "otro")).rejects.toThrow(/check constraint/i);
    await put(A(), a.workspaceId, "k");
    expect((await B().query("select 1 from public.notice_states")).rows).toHaveLength(0);
    await expect(put(B(), a.workspaceId, "x")).rejects.toThrow(/row-level security/);
    await expect(A().query("update public.notice_states set workspace_id = $1", [b.workspaceId])).rejects.toThrow();
  });
});
