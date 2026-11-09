import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, startOfDayInstant, todayIn } from "@/lib/utils/date";
import { lastWeekStarts, sumByWeek } from "@/lib/personal/weekly";

export const TREND_WEEKS = 4;

export type Trends = {
  weeks: string[];
  tasks: number[];
  habits: number[];
  expenses: number[];
};

/** Tendencias de las últimas 4 semanas: tareas completadas, hábitos cumplidos y gastos en BOB. */
export async function getTrends(workspaceId: string, timezone: string, today: string): Promise<Trends> {
  const supabase = await createClient();
  const weeks = lastWeekStarts(today, TREND_WEEKS);
  const first = weeks[0];
  const from = startOfDayInstant(first, timezone).toISOString();

  const [tasks, logs, expenses] = await Promise.all([
    supabase.from("tasks").select("completed_at").eq("workspace_id", workspaceId).is("archived_at", null).eq("status", "completed").gte("completed_at", from).limit(2000),
    supabase.from("habit_logs").select("log_date").eq("workspace_id", workspaceId).eq("completed", true).gte("log_date", first).lte("log_date", addDays(today, 0)).limit(5000),
    supabase.from("transactions").select("transaction_date, amount").eq("workspace_id", workspaceId).is("archived_at", null).eq("kind", "expense").eq("currency", "BOB").gte("transaction_date", first).lte("transaction_date", today).limit(5000),
  ]);
  for (const [name, r] of [["tasks", tasks], ["habits", logs], ["expenses", expenses]] as const) {
    if (r.error) {
      console.error(`[db] getTrends:${name}`, r.error.code, r.error.message);
      throw new Error("No se pudieron cargar las tendencias.");
    }
  }

  return {
    weeks,
    tasks: sumByWeek(
      (tasks.data ?? []).filter((t) => t.completed_at).map((t) => ({ date: todayIn(timezone, new Date(t.completed_at as string)), value: 1 })),
      weeks,
    ),
    habits: sumByWeek((logs.data ?? []).map((l) => ({ date: l.log_date, value: 1 })), weeks),
    expenses: sumByWeek((expenses.data ?? []).map((t) => ({ date: t.transaction_date, value: Number(t.amount) })), weeks),
  };
}
