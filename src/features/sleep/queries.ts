import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SleepRecordRow } from "@/types/database";

const MAX_ROWS = 400;

/**
 * Registros de sueño ordenados del más reciente al más antiguo.
 * `sinceDate` (YYYY-MM-DD) filtra por día de despertar; sin él devuelve hasta MAX_ROWS.
 */
export async function listSleepRecords(
  workspaceId: string,
  opts: { archived?: boolean; sinceDate?: string } = {},
): Promise<SleepRecordRow[]> {
  const supabase = await createClient();

  let query = supabase.from("sleep_records").select("*").eq("workspace_id", workspaceId);
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (opts.sinceDate) query = query.gte("sleep_date", opts.sinceDate);

  const { data, error } = await query.order("wake_time", { ascending: false }).limit(MAX_ROWS);
  if (error) {
    console.error("[db] listSleepRecords", error.code, error.message);
    throw new Error("No se pudieron cargar los registros de sueño.");
  }
  return data ?? [];
}
