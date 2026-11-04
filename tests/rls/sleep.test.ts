import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/**
 * Sueño (Sprint 2): aislamiento, duración calculada, una noche por día,
 * sin solapamiento ni futuro, meta en el perfil y sin DELETE (D-25 a D-29).
 * Los instantes se expresan como "hace N horas" para no depender de la fecha de ejecución.
 */

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };
let recordA: string;

const insert =
  "insert into public.sleep_records (workspace_id, bedtime, wake_time, quality, notes) values ($1, now() - ($2 || ' hours')::interval, now() - ($3 || ' hours')::interval, $4, $5) returning id";

/** Una noche que empieza hace `from` horas y termina hace `to` horas. */
const night = (workspaceId: string, from: number, to: number, quality: number | null = 4, notes: string | null = null) =>
  [workspaceId, String(from), String(to), quality, notes] as const;

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com");
  b = await createUser(db, "b@example.com");
  // Noche de A: de hace 40 h a hace 32 h (8 h).
  recordA = (await session(db, a.userId).query<{ id: string }>(insert, [...night(a.workspaceId, 40, 32)])).rows[0].id;
});

afterAll(async () => {
  await db.close();
});

describe("D-25 · duración calculada por la base de datos", () => {
  it("calcula duration_minutes y fija sleep_date", async () => {
    const r = await session(db, a.userId).query<{ duration_minutes: number; sleep_date: string }>(
      "select duration_minutes, sleep_date::text as sleep_date from public.sleep_records where id = $1",
      [recordA],
    );
    expect(r.rows[0].duration_minutes).toBe(480);
    expect(r.rows[0].sleep_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("el cliente no puede escribir duration_minutes ni sleep_date", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("update public.sleep_records set duration_minutes = 999 where id = $1", [recordA]),
    ).rejects.toThrow(/can only be updated to DEFAULT|permission denied/i); // columna generada
    await expect(
      A.query("update public.sleep_records set sleep_date = '2020-01-01' where id = $1", [recordA]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      A.query(
        "insert into public.sleep_records (workspace_id, bedtime, wake_time, sleep_date) values ($1, now() - interval '70 hours', now() - interval '62 hours', '2020-01-01')",
        [a.workspaceId],
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("recalcula la duración y el día al editar las horas", async () => {
    const A = session(db, a.userId);
    const id = (await A.query<{ id: string }>(insert, [...night(a.workspaceId, 100, 92)])).rows[0].id;
    await A.query("update public.sleep_records set wake_time = bedtime + interval '7 hours' where id = $1", [id]);
    const r = await A.query<{ duration_minutes: number }>(
      "select duration_minutes from public.sleep_records where id = $1",
      [id],
    );
    expect(r.rows[0].duration_minutes).toBe(420);
    await A.query("update public.sleep_records set archived_at = now() where id = $1", [id]);
  });
});

describe("D-27 · validaciones", () => {
  const A = () => session(db, a.userId);

  it("rechaza despertar anterior o igual a acostarse", async () => {
    await expect(A().query(insert, [...night(a.workspaceId, 60, 61)])).rejects.toThrow(/check constraint/i);
    await expect(A().query(insert, [...night(a.workspaceId, 60, 60)])).rejects.toThrow(/check constraint/i);
  });

  it("rechaza duraciones menores de 1 hora o mayores de 16", async () => {
    await expect(
      A().query(
        "insert into public.sleep_records (workspace_id, bedtime, wake_time) values ($1, now() - interval '60 hours', now() - interval '59 hours' - interval '30 minutes')",
        [a.workspaceId],
      ),
    ).rejects.toThrow(/sleep_records_duration_range/);
    await expect(A().query(insert, [...night(a.workspaceId, 90, 73)])).rejects.toThrow(/sleep_records_duration_range/);
  });

  it("acepta exactamente 1 y 16 horas", async () => {
    const ok1 = await A().query<{ id: string }>(insert, [...night(a.workspaceId, 200, 199)]);
    const ok16 = await A().query<{ id: string }>(insert, [...night(a.workspaceId, 300, 284)]);
    await A().query("update public.sleep_records set archived_at = now() where id = any($1)", [
      [ok1.rows[0].id, ok16.rows[0].id],
    ]);
  });

  it("rechaza horas futuras", async () => {
    await expect(
      A().query(
        "insert into public.sleep_records (workspace_id, bedtime, wake_time) values ($1, now() + interval '1 hour', now() + interval '9 hours')",
        [a.workspaceId],
      ),
    ).rejects.toThrow(/horas futuras/i);
  });

  it("rechaza calidad fuera de 1–5 y notas demasiado largas", async () => {
    await expect(A().query(insert, [...night(a.workspaceId, 120, 112, 0)])).rejects.toThrow(/check constraint/i);
    await expect(A().query(insert, [...night(a.workspaceId, 120, 112, 6)])).rejects.toThrow(/check constraint/i);
    await expect(A().query(insert, [...night(a.workspaceId, 120, 112, 3, "x".repeat(1001))])).rejects.toThrow(
      /check constraint/i,
    );
  });

  it("rechaza solapamiento con un registro vigente (restricción de exclusión)", async () => {
    // El registro de A va de hace 40 h a hace 32 h; este se cruza dos horas.
    await expect(A().query(insert, [...night(a.workspaceId, 34, 26)])).rejects.toThrow(/sleep_records_no_overlap|conflicting key/i);
  });

  it("un registro archivado ya no bloquea: se puede volver a registrar esa noche", async () => {
    const A_ = A();
    const tmp = (await A_.query<{ id: string }>(insert, [...night(a.workspaceId, 150, 142)])).rows[0].id;
    await A_.query("update public.sleep_records set archived_at = now() where id = $1", [tmp]);
    const again = await A_.query<{ id: string }>(insert, [...night(a.workspaceId, 150, 142)]);
    expect(again.rows).toHaveLength(1);
    await A_.query("update public.sleep_records set archived_at = now() where id = $1", [again.rows[0].id]);
  });

  it("D-26: una sola noche por día de despertar entre los no archivados", async () => {
    // Fechas fijas (La Paz = UTC-4, sin horario de verano): ambas despiertan el 2020-03-11 local.
    const ins = (bed: string, wake: string) =>
      A().query<{ id: string }>(
        "insert into public.sleep_records (workspace_id, bedtime, wake_time) values ($1, $2::timestamptz, $3::timestamptz) returning id",
        [a.workspaceId, bed, wake],
      );
    const first = await ins("2020-03-10 23:00-04", "2020-03-11 07:00-04");
    await expect(ins("2020-03-11 10:00-04", "2020-03-11 12:00-04")).rejects.toThrow(/sleep_records_one_per_day/);
    // Al archivar la primera, la siesta/segundo registro de ese día ya es posible.
    await A().query("update public.sleep_records set archived_at = now() where id = $1", [first.rows[0].id]);
    const second = await ins("2020-03-11 10:00-04", "2020-03-11 12:00-04");
    await A().query("update public.sleep_records set archived_at = now() where id = $1", [second.rows[0].id]);
  });

  it("sleep_date usa la zona horaria del perfil, no UTC", async () => {
    // 2020-05-02 02:00 UTC es todavía el 2020-05-01 22:00 en La Paz.
    const r = await A().query<{ sleep_date: string; id: string }>(
      "insert into public.sleep_records (workspace_id, bedtime, wake_time) values ($1, '2020-05-01 18:00-04'::timestamptz, '2020-05-01 22:00-04'::timestamptz) returning id, sleep_date::text as sleep_date",
      [a.workspaceId],
    );
    expect(r.rows[0].sleep_date).toBe("2020-05-01");
    await A().query("update public.sleep_records set archived_at = now() where id = $1", [r.rows[0].id]);
  });
});

describe("7.4 · aislamiento", () => {
  it("B no ve ni modifica los registros de A", async () => {
    const B = session(db, b.userId);
    expect((await B.query("select id from public.sleep_records")).rows).toHaveLength(0);
    const upd = await B.query("update public.sleep_records set notes = 'x' where id = $1", [recordA]);
    expect(upd.affectedRows).toBe(0);
  });

  it("A no puede insertar en el workspace de B", async () => {
    await expect(session(db, a.userId).query(insert, [...night(b.workspaceId, 40, 32)])).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("los registros de distintos usuarios pueden coincidir en el tiempo", async () => {
    const r = await session(db, b.userId).query(insert, [...night(b.workspaceId, 40, 32)]);
    expect(r.rows).toHaveLength(1);
  });

  it("no se puede mover un registro a otro workspace", async () => {
    await expect(
      session(db, a.userId).query("update public.sleep_records set workspace_id = $1 where id = $2", [
        b.workspaceId,
        recordA,
      ]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("anon no accede y nadie puede borrar (D-21)", async () => {
    await expect(session(db, null).query("select * from public.sleep_records")).rejects.toThrow(/permission denied/i);
    await expect(
      session(db, a.userId).query("delete from public.sleep_records where id = $1", [recordA]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("archivar y restaurar con archived_at", async () => {
    const A = session(db, a.userId);
    await A.query("update public.sleep_records set archived_at = now() where id = $1", [recordA]);
    expect((await A.query("select 1 from public.sleep_records where id = $1 and archived_at is null", [recordA])).rows).toHaveLength(0);
    await A.query("update public.sleep_records set archived_at = null where id = $1", [recordA]);
    expect((await A.query("select 1 from public.sleep_records where id = $1 and archived_at is null", [recordA])).rows).toHaveLength(1);
  });
});

describe("D-28 · meta de sueño en el perfil", () => {
  it("vale 8 por defecto y el usuario puede cambiarla dentro de 4–12", async () => {
    const A = session(db, a.userId);
    expect((await A.query<{ g: string }>("select sleep_goal_hours::text as g from public.profiles")).rows[0].g).toBe("8.0");
    await A.query("update public.profiles set sleep_goal_hours = 7.5 where id = $1", [a.userId]);
    expect((await A.query<{ g: string }>("select sleep_goal_hours::text as g from public.profiles")).rows[0].g).toBe("7.5");
    await expect(A.query("update public.profiles set sleep_goal_hours = 3.5 where id = $1", [a.userId])).rejects.toThrow(
      /profiles_sleep_goal_range/,
    );
    await expect(A.query("update public.profiles set sleep_goal_hours = 12.5 where id = $1", [a.userId])).rejects.toThrow(
      /profiles_sleep_goal_range/,
    );
  });

  it("B no puede cambiar la meta de A", async () => {
    const upd = await session(db, b.userId).query("update public.profiles set sleep_goal_hours = 5 where id = $1", [a.userId]);
    expect(upd.affectedRows).toBe(0);
  });
});
