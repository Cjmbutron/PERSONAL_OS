import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEventRow, GoalMilestoneRow, GoalProgressRow, GoalRow, GoalStatus } from "@/types/database";
import { formatClock } from "@/lib/utils/date";
import type { CalendarItem } from "@/lib/personal/calendar";

function fail(context: string, error: { code?: string; message: string }, userMessage: string): never {
  console.error(`[db] ${context}`, error.code, error.message);
  throw new Error(userMessage);
}

/** Eventos que tocan algún día de [from, to] (D-61), no archivados. `areaId` filtra por dimensión. */
export async function listEvents(workspaceId: string, from: string, to: string, areaId?: string): Promise<CalendarEventRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .lte("first_day", to)
    .gte("last_day", from);
  if (areaId) query = query.eq("life_area_id", areaId);
  const { data, error } = await query.order("first_day").order("starts_at", { nullsFirst: true }).limit(500);
  if (error) fail("listEvents", error, "No se pudieron cargar los eventos.");
  return data ?? [];
}

/** Tareas abiertas con vencimiento en [from, to] (solo lectura en el calendario, D-60). */
export async function listTasksDueBetween(workspaceId: string, from: string, to: string, areaId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, due_date, life_area_id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .in("status", ["pending", "in_progress"])
    .gte("due_date", from)
    .lte("due_date", to);
  if (areaId) query = query.eq("life_area_id", areaId);
  const { data, error } = await query.order("due_date").limit(500);
  if (error) fail("listTasksDueBetween", error, "No se pudieron cargar las tareas del calendario.");
  return data ?? [];
}

/** Obligaciones pendientes con vencimiento en [from, to]. */
export async function listObligationsDueBetween(workspaceId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_obligations")
    .select("id, name, amount, currency, due_date")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date")
    .limit(200);
  if (error) fail("listObligationsDueBetween", error, "No se pudieron cargar los vencimientos.");
  return data ?? [];
}

export function eventToItem(e: CalendarEventRow, timezone: string): CalendarItem {
  return {
    key: `event-${e.id}`,
    kind: "event",
    title: e.title,
    firstDay: e.first_day,
    lastDay: e.last_day,
    time: !e.all_day && e.starts_at ? formatClock(e.starts_at, timezone) : null,
  };
}

/**
 * Elementos del calendario entre [from, to]: eventos + vencimientos de tareas + vencimientos de obligaciones.
 * Con filtro de dimensión solo se muestran las tareas y eventos de esa dimensión, y las obligaciones
 * únicamente si se filtra por Finanzas (`includeObligations`).
 */
export async function getCalendarItems(
  workspaceId: string,
  timezone: string,
  from: string,
  to: string,
  opts: { areaId?: string; includeObligations: boolean },
): Promise<{ items: CalendarItem[]; events: CalendarEventRow[] }> {
  const [events, tasks, obligations] = await Promise.all([
    listEvents(workspaceId, from, to, opts.areaId),
    listTasksDueBetween(workspaceId, from, to, opts.areaId),
    opts.includeObligations ? listObligationsDueBetween(workspaceId, from, to) : Promise.resolve([]),
  ]);
  const items: CalendarItem[] = [
    ...events.map((e) => eventToItem(e, timezone)),
    ...tasks.map(
      (t): CalendarItem => ({
        key: `task-${t.id}`,
        kind: "task",
        title: t.title,
        firstDay: t.due_date as string,
        lastDay: t.due_date as string,
        time: null,
        href: "/work/tasks",
      }),
    ),
    ...obligations.map(
      (o): CalendarItem => ({
        key: `obligation-${o.id}`,
        kind: "obligation",
        title: `Pagar: ${o.name}`,
        firstDay: o.due_date,
        lastDay: o.due_date,
        time: null,
        href: "/finance/obligations",
      }),
    ),
  ];
  return { items, events };
}

export type GoalWithProgress = GoalRow & { milestones: GoalMilestoneRow[]; milestonesTotal: number; milestonesDone: number };

/** Objetivos con sus hitos y avance. `archived: true` lista los archivados. */
export async function listGoals(
  workspaceId: string,
  opts: { archived?: boolean; status?: GoalStatus | GoalStatus[] } = {},
): Promise<GoalWithProgress[]> {
  const supabase = await createClient();
  let query = supabase.from("goals").select("*").eq("workspace_id", workspaceId);
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (opts.status) query = Array.isArray(opts.status) ? query.in("status", opts.status) : query.eq("status", opts.status);
  const { data: goals, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) fail("listGoals", error, "No se pudieron cargar los objetivos.");
  if (!goals?.length) return [];

  const ids = goals.map((g) => g.id);
  const [milestones, progress] = await Promise.all([
    supabase.from("goal_milestones").select("*").eq("workspace_id", workspaceId).in("goal_id", ids).order("position").order("created_at").limit(5000),
    supabase.from("goal_progress").select("*").eq("workspace_id", workspaceId).in("goal_id", ids),
  ]);
  if (milestones.error) fail("listGoals:milestones", milestones.error, "No se pudieron cargar los hitos.");
  if (progress.error) fail("listGoals:progress", progress.error, "No se pudo calcular el avance.");

  const byGoal = new Map<string, GoalMilestoneRow[]>();
  for (const m of milestones.data ?? []) byGoal.set(m.goal_id, [...(byGoal.get(m.goal_id) ?? []), m]);
  const prog = new Map<string, GoalProgressRow>((progress.data ?? []).map((p) => [p.goal_id, p]));

  return goals.map((g) => ({
    ...g,
    milestones: byGoal.get(g.id) ?? [],
    milestonesTotal: prog.get(g.id)?.milestones_total ?? 0,
    milestonesDone: prog.get(g.id)?.milestones_done ?? 0,
  }));
}
