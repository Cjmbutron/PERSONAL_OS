import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Simula lo mínimo de Supabase que las migraciones necesitan:
 * esquema `auth`, `auth.users`, `auth.uid()` y los roles anon/authenticated/service_role,
 * con los mismos privilegios por defecto amplios que concede Supabase en `public`.
 * Así las migraciones se prueban contra el peor caso real (privilegios generosos que
 * ellas mismas deben recortar).
 */
const SUPABASE_BOOTSTRAP = `
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );

  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(SUPABASE_BOOTSTRAP);

  const dir = path.resolve(__dirname, "../../supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

/** Crea un usuario en auth.users (dispara el trigger de alta) y devuelve su id y su workspace. */
export async function createUser(
  db: PGlite,
  email: string,
  fullName?: string,
): Promise<{ userId: string; workspaceId: string }> {
  const meta = fullName ? { full_name: fullName } : {};
  const u = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [email, JSON.stringify(meta)],
  );
  const userId = u.rows[0].id;
  const w = await db.query<{ id: string }>(
    "select id from public.workspaces where owner_id = $1",
    [userId],
  );
  return { userId, workspaceId: w.rows[0].id };
}

/**
 * Ejecuta consultas con el rol y el JWT de un usuario, igual que PostgREST:
 * `authenticated` con `sub` = userId, o `anon` si userId es null.
 * Cada consulta corre en su propia transacción confirmada.
 */
export function session(db: PGlite, userId: string | null) {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      await db.exec("begin");
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
        await db.exec(`set local role ${userId ? "authenticated" : "anon"}`);
        const res = await db.query<T>(sql, params);
        await db.exec("commit");
        return res;
      } catch (error) {
        await db.exec("rollback");
        throw error;
      }
    },
  };
}
