import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyPriorityRow, WeeklyReviewRow } from "@/types/database";
import { addDays, startOfDayInstant } from "@/lib/utils/date";
import { listGoals } from "@/features/personal/queries";
import { listSessions } from "@/features/fitness/queries";
import { listSleepRecords } from "@/features/sleep/queries";
import { listHabits } from "@/features/habits/queries";
import { toSchedule } from "@/lib/habits/overview";
import { setsVolume } from "@/lib/fitness/stats";
import { summarizeSleep, type SleepSummary } from "@/lib/sleep/stats";
import { flowByCurrency, habitWeekStats, weekEnd, type MoneyFlow } from "@/lib/personal/weekly";
import { goalPercent } from "@/lib/personal/calendar";

function fail(context: string, error: { code?: string; message: string }, userMessage: string): never {
  console.error(`[db] ${context}`, error.code, error.message);
  throw new Error(userMessage);
}

export async function getReview(workspaceId: string, week: string): Promise<WeeklyReviewRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_reviews").select("*").eq("workspace_id", workspaceId).eq("week_start", week).maybeSingle();
  if (error) fail("getReview", error, "No se pudo cargar la revisión.");
  return data;
}

export async function listReviews(workspaceId: string, limit = 12): Promise<WeeklyReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) fail("listReviews", error, "No se pudo cargar el historial de revisiones.");
  return data ?? [];
}

export async function listPriorities(workspaceId: string, week: string): Promise<WeeklyPriorityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_priorities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("week_start", week)
    .order("position")
    .order("created_at")
    .limit(10);
  if (error) fail("listPriorities", error, "No se pudieron cargar las prioridades.");
  return data ?? [];
}

export type WeekSummary = {
  tasksCompleted: number;
  tasksOverdue: number;
  habits: { name: string; done: number; target: number }[];
  sessions: number;
  volumeKg: number;
  sleep: SleepSummary;
  money: MoneyFlow[];
  goals: { id: string; title: string; percent: number }[];
  goalsCompleted: number;
};

/** Resumen automático de la semana `monday`…domingo, todo a partir de datos reales (D-75). */
export async function getWeekSummary(
  workspaceId: string,
  timezone: string,
  sleepGoalHours: number,
  monday: string,
  today: string,
): Promise<WeekSummary> {
  const supabase = await createClient();
  const end = weekEnd(monday);
  const from = startOfDayInstant(monday, timezone).toISOString();
  const to = startOfDayInstant(addDays(end, 1), timezone).toISOString();
  const lastDay = end < today ? end : today;

  const [completed, overdue, habits, logs, sessions, sleepRecords, txs, goals, goalsDone] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null).eq("status", "completed").gte("completed_at", from).lt("completed_at", to),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null).in("status", ["pending", "in_progress"]).lt("due_date", addDays(lastDay, 1)),
    listHabits(workspaceId, false),
    supabase.from("habit_logs").select("habit_id, log_date").eq("workspace_id", workspaceId).eq("completed", true).gte("log_date", monday).lte("log_date", end).limit(2000),
    listSessions(workspaceId, { sinceDate: monday }),
    listSleepRecords(workspaceId, { sinceDate: monday }),
    supabase.from("transactions").select("kind, currency, amount").eq("workspace_id", workspaceId).is("archived_at", null).gte("transaction_date", monday).lte("transaction_date", end).limit(2000),
    listGoals(workspaceId, { status: "active" }),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null).eq("status", "completed").gte("completed_at", from).lt("completed_at", to),
  ]);
  for (const [ctx, r] of [["tasksCompleted", completed], ["tasksOverdue", overdue], ["habitLogs", logs], ["transactions", txs], ["goalsCompleted", goalsDone]] as const) {
    if (r.error) fail(`getWeekSummary:${ctx}`, r.error, "No se pudo calcular el resumen de la semana.");
  }

  const datesByHabit = new Map<string, string[]>();
  for (const l of logs.data ?? []) datesByHabit.set(l.habit_id, [...(datesByHabit.get(l.habit_id) ?? []), l.log_date]);
  const weekSessions = sessions.filter((s) => s.started_date <= end);
  const weekSleep = sleepRecords.filter((r) => r.sleep_date <= end);

  return {
    tasksCompleted: completed.count ?? 0,
    tasksOverdue: overdue.count ?? 0,
    habits: habits
      .map((h) => ({ name: h.name, ...habitWeekStats(toSchedule(h), datesByHabit.get(h.id) ?? [], monday, today) }))
      .filter((h) => h.target > 0),
    sessions: weekSessions.length,
    volumeKg: setsVolume(weekSessions.flatMap((s) => s.exercises.flatMap((e) => e.sets))),
    sleep: summarizeSleep(weekSleep, Math.round(sleepGoalHours * 60)),
    money: flowByCurrency((txs.data ?? []).map((t) => ({ kind: t.kind, currency: t.currency, amount: Number(t.amount) }))),
    goals: goals.map((g) => ({ id: g.id, title: g.title, percent: goalPercent(g.manual_progress, g.milestonesTotal, g.milestonesDone) })),
    goalsCompleted: goalsDone.count ?? 0,
  };
}

/** Tareas abiertas (para vincular prioridades). */
export async function listLinkableTasks(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .in("status", ["pending", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) fail("listLinkableTasks", error, "No se pudieron cargar las tareas.");
  return data ?? [];
}
