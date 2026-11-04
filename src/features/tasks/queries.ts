import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_RANK } from "@/lib/constants/labels";
import type { TaskFilters } from "@/lib/validations/work";
import type { TaskRow } from "@/types/database";

const MAX_ROWS = 500;

/** Ordena por vencimiento (sin fecha al final), luego prioridad (mayor primero) y recientes primero. */
function compareTasks(a: TaskRow, b: TaskRow): number {
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (byPriority !== 0) return byPriority;
  return a.created_at < b.created_at ? 1 : -1;
}

export async function listTasks(workspaceId: string, filters: TaskFilters): Promise<TaskRow[]> {
  const supabase = await createClient();

  let query = supabase.from("tasks").select("*").eq("workspace_id", workspaceId);

  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (filters.status === "open") query = query.in("status", ["pending", "in_progress"]);
  else if (filters.status !== "all") query = query.eq("status", filters.status);

  if (filters.priority) query = query.eq("priority", filters.priority);

  if (filters.project === "none") query = query.is("project_id", null);
  else if (filters.project) query = query.eq("project_id", filters.project);

  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error("[db] listTasks", error.code, error.message);
    throw new Error("No se pudieron cargar las tareas.");
  }
  return (data ?? []).sort(compareTasks);
}

export type DashboardTask = Pick<TaskRow, "id" | "title" | "status" | "priority" | "due_date" | "project_id">;

/** Tareas abiertas (pendientes o en curso, no archivadas) — base del dashboard. */
export async function listOpenTasks(workspaceId: string): Promise<DashboardTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, project_id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .in("status", ["pending", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error("[db] listOpenTasks", error.code, error.message);
    throw new Error("No se pudieron cargar las tareas abiertas.");
  }
  return data ?? [];
}

export async function countCompletedSince(workspaceId: string, sinceIso: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .eq("status", "completed")
    .gte("completed_at", sinceIso);

  if (error) {
    console.error("[db] countCompletedSince", error.code, error.message);
    throw new Error("No se pudo calcular las tareas completadas.");
  }
  return count ?? 0;
}
