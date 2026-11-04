import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LifeAreaRow, ProfileRow, WorkspaceRow } from "@/types/database";

/**
 * Capa de acceso a datos (DAL). Es la barrera de autorización real:
 * valida la sesión contra el servidor de Auth (getUser) en cada render que toque datos.
 * Se memoiza por petición con `cache` para no repetir la llamada.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user;
});

export type WorkspaceContext = {
  userId: string;
  email: string | undefined;
  profile: Pick<ProfileRow, "full_name" | "timezone" | "sleep_goal_hours">;
  workspace: Pick<WorkspaceRow, "id" | "name">;
  lifeAreas: LifeAreaRow[];
};

/**
 * Usuario + perfil + workspace + catálogo de dimensiones.
 * El workspace_id que usan las escrituras sale SIEMPRE de aquí (servidor), nunca del formulario.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [profile, workspace, areas] = await Promise.all([
    supabase.from("profiles").select("full_name, timezone, sleep_goal_hours").eq("id", user.id).maybeSingle(),
    supabase.from("workspaces").select("id, name").eq("owner_id", user.id).maybeSingle(),
    supabase.from("life_areas").select("*").order("sort_order"),
  ]);

  if (profile.error || workspace.error || areas.error) {
    console.error("[auth] error leyendo el contexto del workspace", {
      profile: profile.error?.message,
      workspace: workspace.error?.message,
      areas: areas.error?.message,
    });
    throw new Error("No se pudo cargar tu espacio de trabajo. Inténtalo de nuevo.");
  }

  if (!profile.data || !workspace.data) {
    // El trigger de alta debería haberlos creado (S1-08). Si falta, es un fallo de configuración.
    console.error("[auth] usuario sin perfil o workspace", { userId: user.id });
    throw new Error(
      "Tu cuenta no tiene un espacio de trabajo asociado. Verifica que las migraciones estén aplicadas.",
    );
  }

  return {
    userId: user.id,
    email: user.email,
    profile: profile.data,
    workspace: workspace.data,
    lifeAreas: areas.data ?? [],
  };
});
