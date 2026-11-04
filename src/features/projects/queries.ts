import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/types/database";

/** Todos los proyectos del workspace (incluidos archivados): sirve para resolver nombres en listas de tareas. */
export async function listProjects(workspaceId: string): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[db] listProjects", error.code, error.message);
    throw new Error("No se pudieron cargar los proyectos.");
  }
  return data ?? [];
}

export type ProjectTaskStats = { total: number; completed: number };

/** Conteo de tareas no archivadas por proyecto (para el progreso en las tarjetas). */
export async function getProjectTaskStats(workspaceId: string): Promise<Map<string, ProjectTaskStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("project_id, status")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .not("project_id", "is", null)
    .limit(5000);

  if (error) {
    console.error("[db] getProjectTaskStats", error.code, error.message);
    throw new Error("No se pudo calcular el progreso de los proyectos.");
  }

  const stats = new Map<string, ProjectTaskStats>();
  for (const row of data ?? []) {
    if (!row.project_id || row.status === "cancelled") continue;
    const entry = stats.get(row.project_id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (row.status === "completed") entry.completed += 1;
    stats.set(row.project_id, entry);
  }
  return stats;
}
