import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MealLogRow } from "@/types/database";

const MAX_ROWS = 400;

/**
 * Comidas por día local (`date`), desde un día (`sinceDate`) o archivadas.
 * El día es `eaten_date`, calculado por la base de datos con la zona del perfil (D-31).
 */
export async function listMeals(
  workspaceId: string,
  opts: { date?: string; sinceDate?: string; archived?: boolean } = {},
): Promise<MealLogRow[]> {
  const supabase = await createClient();

  let query = supabase.from("meal_logs").select("*").eq("workspace_id", workspaceId);
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (opts.date) query = query.eq("eaten_date", opts.date);
  if (opts.sinceDate) query = query.gte("eaten_date", opts.sinceDate);

  // Cronológico dentro del día; las archivadas, de la más reciente a la más antigua.
  const { data, error } = await query
    .order("eaten_at", { ascending: !opts.archived })
    .limit(MAX_ROWS);

  if (error) {
    console.error("[db] listMeals", error.code, error.message);
    throw new Error("No se pudieron cargar las comidas.");
  }
  return data ?? [];
}
