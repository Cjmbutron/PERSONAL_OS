import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createUser, session } from "./harness";

/**
 * Pruebas de aislamiento y de integridad del Sprint 1 (S1-06, S1-08).
 * Escenarios 1–4 de la sección 7.4 del documento, más los controles de
 * privilegios, integridad entre workspaces y reglas de base de datos (D-02 a D-09).
 */

const RLS_OR_PERMISSION = /row-level security|permission denied/i;

let db: PGlite;
let a: { userId: string; workspaceId: string };
let b: { userId: string; workspaceId: string };
let projectA: string;
let projectB: string;
let taskB: string;

beforeAll(async () => {
  db = await createDatabase();
  a = await createUser(db, "a@example.com", "  Ana  ");
  b = await createUser(db, "b@example.com");

  const A = session(db, a.userId);
  const B = session(db, b.userId);

  projectA = (
    await A.query<{ id: string }>(
      "insert into public.projects (workspace_id, name) values ($1, 'Proyecto A') returning id",
      [a.workspaceId],
    )
  ).rows[0].id;
  projectB = (
    await B.query<{ id: string }>(
      "insert into public.projects (workspace_id, name) values ($1, 'Proyecto B') returning id",
      [b.workspaceId],
    )
  ).rows[0].id;
  taskB = (
    await B.query<{ id: string }>(
      "insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'Tarea B') returning id",
      [b.workspaceId, projectB],
    )
  ).rows[0].id;
  await A.query("insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'Tarea A')", [
    a.workspaceId,
    projectA,
  ]);
});

afterAll(async () => {
  await db.close();
});

describe("S1-08 · alta automática de perfil y workspace", () => {
  it("crea perfil y workspace al registrarse, normalizando el nombre", async () => {
    const A = session(db, a.userId);
    const profile = await A.query<{ full_name: string; timezone: string }>(
      "select full_name, timezone from public.profiles",
    );
    expect(profile.rows).toEqual([{ full_name: "Ana", timezone: "America/La_Paz" }]);
    const ws = await A.query("select id from public.workspaces");
    expect(ws.rows).toHaveLength(1);
  });

  it("no permite un segundo workspace para el mismo usuario (6.4.2)", async () => {
    await expect(
      db.query("insert into public.workspaces (owner_id) values ($1)", [a.userId]),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("un usuario autenticado no puede crear workspaces directamente", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("insert into public.workspaces (owner_id) values ($1)", [a.userId]),
    ).rejects.toThrow(RLS_OR_PERMISSION);
  });

  it("nadie puede invocar handle_new_user como RPC", async () => {
    const A = session(db, a.userId);
    await expect(A.query("select public.handle_new_user()")).rejects.toThrow(/permission denied/i);
  });
});

describe("7.4 · escenario 1 — A intenta consultar datos de B", () => {
  it.each(["projects", "tasks"])("no ve filas de %s ajenas", async (table) => {
    const A = session(db, a.userId);
    const res = await A.query<{ workspace_id: string }>(`select workspace_id from public.${table}`);
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows.every((r) => r.workspace_id === a.workspaceId)).toBe(true);
  });

  it("no ve el workspace ni el perfil de B", async () => {
    const A = session(db, a.userId);
    expect((await A.query("select 1 from public.workspaces where id = $1", [b.workspaceId])).rows).toHaveLength(0);
    expect((await A.query("select 1 from public.profiles where id = $1", [b.userId])).rows).toHaveLength(0);
  });

  it("no puede leer una tarea concreta de B por id", async () => {
    const A = session(db, a.userId);
    expect((await A.query("select 1 from public.tasks where id = $1", [taskB])).rows).toHaveLength(0);
  });
});

describe("7.4 · escenario 2 — A intenta modificar datos de B", () => {
  it("el UPDATE sobre filas de B no afecta ninguna fila", async () => {
    const A = session(db, a.userId);
    const t = await A.query("update public.tasks set title = 'hackeada' where id = $1", [taskB]);
    expect(t.affectedRows).toBe(0);
    const p = await A.query("update public.projects set name = 'hackeado' where id = $1", [projectB]);
    expect(p.affectedRows).toBe(0);
    const w = await A.query("update public.workspaces set name = 'hackeado' where id = $1", [b.workspaceId]);
    expect(w.affectedRows).toBe(0);

    const check = await db.query<{ title: string }>("select title from public.tasks where id = $1", [taskB]);
    expect(check.rows[0].title).toBe("Tarea B");
  });
});

describe("7.4 · escenario 3 — A intenta insertar con un workspace ajeno", () => {
  it("rechaza proyectos y tareas con workspace_id de B", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("insert into public.projects (workspace_id, name) values ($1, 'x')", [b.workspaceId]),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      A.query("insert into public.tasks (workspace_id, title) values ($1, 'x')", [b.workspaceId]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("rechaza mover un registro propio al workspace de B (columna sin privilegio)", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("update public.tasks set workspace_id = $1 where workspace_id = $2", [b.workspaceId, a.workspaceId]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("el trigger bloquea el cambio de workspace_id incluso con privilegios totales (7.2)", async () => {
    await expect(
      db.query("update public.tasks set workspace_id = $1 where id = $2", [a.workspaceId, taskB]),
    ).rejects.toThrow(/workspace_id no puede modificarse/);
  });

  it("no permite cambiar el propietario de un workspace", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("update public.workspaces set owner_id = $1 where id = $2", [b.userId, a.workspaceId]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("update public.workspaces set owner_id = $1 where id = $2", [b.userId, a.workspaceId]),
    ).rejects.toThrow(/owner_id no puede modificarse|duplicate key/i);
  });
});

describe("7.4 · escenario 4 — eliminación no autorizada", () => {
  it.each(["projects", "tasks", "workspaces", "profiles", "life_areas"])(
    "authenticated no puede hacer DELETE en %s (D-02)",
    async (table) => {
      const A = session(db, a.userId);
      await expect(A.query(`delete from public.${table}`)).rejects.toThrow(/permission denied/i);
    },
  );
});

describe("7.4 · escenario 6 — acceso directo sin autenticar (rol anon)", () => {
  it.each(["profiles", "workspaces", "life_areas", "projects", "tasks"])(
    "anon no puede leer %s",
    async (table) => {
      const anon = session(db, null);
      await expect(anon.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/i);
    },
  );

  it("anon no puede ejecutar owns_workspace", async () => {
    const anon = session(db, null);
    await expect(anon.query("select public.owns_workspace($1)", [a.workspaceId])).rejects.toThrow(
      /permission denied/i,
    );
  });
});

describe("D-03 · integridad entre workspaces", () => {
  it("una tarea de A no puede apuntar a un proyecto de B", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'cruzada')", [
        a.workspaceId,
        projectB,
      ]),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("tampoco se puede reasignar una tarea propia a un proyecto ajeno", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("update public.tasks set project_id = $1 where workspace_id = $2", [projectB, a.workspaceId]),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("una tarea sin proyecto es válida (D-15)", async () => {
    const A = session(db, a.userId);
    const res = await A.query("insert into public.tasks (workspace_id, title) values ($1, 'suelta') returning id", [
      a.workspaceId,
    ]);
    expect(res.rows).toHaveLength(1);
  });
});

describe("D-09 · completed_at gobernado por la base de datos", () => {
  it("se fija al completar, se conserva y se limpia al reabrir", async () => {
    const A = session(db, a.userId);
    const created = await A.query<{ id: string }>(
      "insert into public.tasks (workspace_id, title) values ($1, 'ciclo') returning id",
      [a.workspaceId],
    );
    const id = created.rows[0].id;

    const done = await A.query<{ completed_at: Date | null }>(
      "update public.tasks set status = 'completed' where id = $1 returning completed_at",
      [id],
    );
    const first = done.rows[0].completed_at;
    expect(first).not.toBeNull();

    const again = await A.query<{ completed_at: Date | null }>(
      "update public.tasks set title = 'ciclo 2' where id = $1 returning completed_at",
      [id],
    );
    expect(again.rows[0].completed_at).toEqual(first);

    const reopened = await A.query<{ completed_at: Date | null }>(
      "update public.tasks set status = 'pending' where id = $1 returning completed_at",
      [id],
    );
    expect(reopened.rows[0].completed_at).toBeNull();
  });

  it("el cliente no puede escribir completed_at directamente", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("insert into public.tasks (workspace_id, title, completed_at) values ($1, 'x', now())", [
        a.workspaceId,
      ]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("una tarea creada ya completada recibe completed_at", async () => {
    const A = session(db, a.userId);
    const res = await A.query<{ completed_at: Date | null }>(
      "insert into public.tasks (workspace_id, title, status) values ($1, 'hecha', 'completed') returning completed_at",
      [a.workspaceId],
    );
    expect(res.rows[0].completed_at).not.toBeNull();
  });
});

describe("D-02 · archivado lógico", () => {
  it("se archiva y se restaura mediante archived_at", async () => {
    const A = session(db, a.userId);
    const archived = await A.query<{ archived_at: Date | null }>(
      "update public.projects set archived_at = now() where id = $1 returning archived_at",
      [projectA],
    );
    expect(archived.rows[0].archived_at).not.toBeNull();
    const restored = await A.query<{ archived_at: Date | null }>(
      "update public.projects set archived_at = null where id = $1 returning archived_at",
      [projectA],
    );
    expect(restored.rows[0].archived_at).toBeNull();
  });
});

describe("Restricciones de dominio (D-07)", () => {
  it("rechaza estados, prioridades y títulos inválidos", async () => {
    const A = session(db, a.userId);
    await expect(
      A.query("insert into public.tasks (workspace_id, title, status) values ($1, 'x', 'hecho')", [a.workspaceId]),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      A.query("insert into public.tasks (workspace_id, title, priority) values ($1, 'x', 'critica')", [
        a.workspaceId,
      ]),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      A.query("insert into public.tasks (workspace_id, title) values ($1, '   ')", [a.workspaceId]),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      A.query("insert into public.projects (workspace_id, name, status) values ($1, 'x', 'cerrado')", [
        a.workspaceId,
      ]),
    ).rejects.toThrow(/check constraint/i);
  });
});

describe("D-01 · catálogo de dimensiones", () => {
  it("authenticated lee las seis dimensiones y no puede modificarlas", async () => {
    const A = session(db, a.userId);
    const res = await A.query<{ code: string }>("select code from public.life_areas order by sort_order");
    expect(res.rows.map((r) => r.code)).toEqual(["WORK", "FITNESS", "NUTRITION", "SLEEP", "FINANCE", "PERSONAL"]);
    await expect(A.query("insert into public.life_areas (code, name, description, sort_order) values ('WORK','x','x',9)")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(A.query("update public.life_areas set name = 'x'")).rejects.toThrow(/permission denied/i);
  });
});

describe("RLS activo en todas las tablas del esquema public (7.1)", () => {
  it("ninguna tabla queda sin RLS", async () => {
    const res = await db.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(res.rows).toEqual([]);
  });
});
