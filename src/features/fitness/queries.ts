import "server-only";
import { createClient } from "@/lib/supabase/server";
import { chunk } from "@/lib/supabase/paginate";
import type {
  RoutineExerciseRow,
  WorkoutExerciseRow,
  WorkoutRoutineRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from "@/types/database";

const MAX_SESSIONS = 300;

export type SessionExercise = WorkoutExerciseRow & { sets: WorkoutSetRow[] };
export type SessionDetail = WorkoutSessionRow & { exercises: SessionExercise[] };
export type RoutineDetail = WorkoutRoutineRow & { exercises: RoutineExerciseRow[] };

function fail(context: string, error: { code?: string; message: string }, userMessage: string): never {
  console.error(`[db] ${context}`, error.code, error.message);
  throw new Error(userMessage);
}

/** Sesiones con sus ejercicios y series. Consultas separadas por lotes (sin límite de URL en `.in()`). */
export async function listSessions(
  workspaceId: string,
  opts: { sinceDate?: string; archived?: boolean; limit?: number } = {},
): Promise<SessionDetail[]> {
  const supabase = await createClient();

  let query = supabase.from("workout_sessions").select("*").eq("workspace_id", workspaceId);
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (opts.sinceDate) query = query.gte("started_date", opts.sinceDate);

  const { data: sessions, error } = await query
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? MAX_SESSIONS);
  if (error) fail("listSessions", error, "No se pudieron cargar los entrenamientos.");
  if (!sessions?.length) return [];

  const exercises: WorkoutExerciseRow[] = [];
  for (const ids of chunk(sessions.map((s) => s.id))) {
    const { data, error: exErr } = await supabase
      .from("workout_exercises")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("session_id", ids)
      .order("position");
    if (exErr) fail("listSessions.exercises", exErr, "No se pudieron cargar los ejercicios.");
    exercises.push(...(data ?? []));
  }

  const sets: WorkoutSetRow[] = [];
  for (const ids of chunk(exercises.map((e) => e.id))) {
    const { data, error: setErr } = await supabase
      .from("workout_sets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("exercise_id", ids)
      .order("set_number")
      .limit(5000);
    if (setErr) fail("listSessions.sets", setErr, "No se pudieron cargar las series.");
    sets.push(...(data ?? []));
  }

  const setsByExercise = new Map<string, WorkoutSetRow[]>();
  for (const s of sets) setsByExercise.set(s.exercise_id, [...(setsByExercise.get(s.exercise_id) ?? []), s]);

  const exercisesBySession = new Map<string, SessionExercise[]>();
  for (const e of exercises) {
    exercisesBySession.set(e.session_id, [
      ...(exercisesBySession.get(e.session_id) ?? []),
      { ...e, sets: setsByExercise.get(e.id) ?? [] },
    ]);
  }

  return sessions.map((s) => ({ ...s, exercises: exercisesBySession.get(s.id) ?? [] }));
}

export async function getSession(workspaceId: string, id: string): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getSession", error, "No se pudo cargar el entrenamiento.");
  if (!data) return null;

  // Reutiliza el armado de listSessions filtrando por id (incluye archivadas).
  const [active, archived] = await Promise.all([listSessions(workspaceId), listSessions(workspaceId, { archived: true })]);
  return [...active, ...archived].find((s) => s.id === id) ?? null;
}

async function attachExercises(workspaceId: string, routines: WorkoutRoutineRow[]): Promise<RoutineDetail[]> {
  if (!routines.length) return [];
  const supabase = await createClient();
  const all: RoutineExerciseRow[] = [];
  for (const ids of chunk(routines.map((r) => r.id))) {
    const { data, error } = await supabase
      .from("routine_exercises")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("routine_id", ids)
      .order("day_of_week")
      .order("position")
      .limit(5000);
    if (error) fail("attachExercises", error, "No se pudieron cargar los ejercicios de la rutina.");
    all.push(...(data ?? []));
  }
  return routines.map((r) => ({ ...r, exercises: all.filter((e) => e.routine_id === r.id) }));
}

/** Rutina vigente (no archivada) de un mes; D-34 garantiza como máximo una. */
export async function getRoutineForMonth(workspaceId: string, monthIso: string): Promise<RoutineDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_routines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("period_month", monthIso)
    .is("archived_at", null)
    .maybeSingle();
  if (error) fail("getRoutineForMonth", error, "No se pudo cargar la rutina.");
  if (!data) return null;
  return (await attachExercises(workspaceId, [data]))[0] ?? null;
}

/** Meses (no archivados) que ya tienen rutina, para el selector. */
export async function listRoutineMonths(workspaceId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_routines")
    .select("period_month")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("period_month", { ascending: false })
    .limit(120);
  if (error) fail("listRoutineMonths", error, "No se pudieron cargar las rutinas.");
  return (data ?? []).map((r) => r.period_month);
}

export async function listArchivedRoutines(workspaceId: string): Promise<WorkoutRoutineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_routines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("archived_at", "is", null)
    .order("period_month", { ascending: false })
    .limit(100);
  if (error) fail("listArchivedRoutines", error, "No se pudieron cargar las rutinas archivadas.");
  return data ?? [];
}
