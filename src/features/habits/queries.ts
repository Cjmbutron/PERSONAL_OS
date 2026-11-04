import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildHabitViews, type HabitView } from "@/lib/habits/overview";
import { addDays } from "@/lib/utils/date";
import type { HabitLogRow, HabitRow } from "@/types/database";

/**
 * Ventana de historial usada para calcular rachas (D-19). Una racha más larga se muestra
 * recortada a esta ventana; es un límite consciente para no leer el historial completo.
 */
export const STREAK_WINDOW_DAYS = 400;

const PAGE_SIZE = 1000; // límite por defecto de PostgREST: se pagina para no truncar en silencio.
const MAX_HABITS = 200;

export async function listHabits(workspaceId: string, archived: boolean): Promise<HabitRow[]> {
  const supabase = await createClient();
  let query = supabase.from("habits").select("*").eq("workspace_id", workspaceId);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data, error } = await query.order("created_at", { ascending: true }).limit(MAX_HABITS);
  if (error) {
    console.error("[db] listHabits", error.code, error.message);
    throw new Error("No se pudieron cargar los hábitos.");
  }
  return data ?? [];
}

type CompletedLog = Pick<HabitLogRow, "habit_id" | "log_date" | "completed">;

async function listCompletedLogs(workspaceId: string, sinceDate: string): Promise<CompletedLog[]> {
  const supabase = await createClient();
  const rows: CompletedLog[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date, completed")
      .eq("workspace_id", workspaceId)
      .eq("completed", true)
      .gte("log_date", sinceDate)
      .order("log_date", { ascending: true })
      .order("id", { ascending: true }) // orden total: evita filas repetidas o perdidas entre páginas
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[db] listCompletedLogs", error.code, error.message);
      throw new Error("No se pudo cargar el historial de hábitos.");
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Hábitos del usuario con racha, progreso semanal y últimos 7 días ya calculados. */
export async function getHabitViews(workspaceId: string, today: string, archived = false): Promise<HabitView[]> {
  const habits = await listHabits(workspaceId, archived);
  if (habits.length === 0) return [];
  const logs = await listCompletedLogs(workspaceId, addDays(today, -STREAK_WINDOW_DAYS));
  return buildHabitViews(habits, logs, today);
}
