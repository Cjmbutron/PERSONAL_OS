import type { RoutineExerciseRow } from "@/types/database";
import { addDays } from "@/lib/utils/date";
import { weekStart } from "@/lib/habits/streaks";

const round1 = (n: number) => Math.round(n * 10) / 10;

export type SetLike = { reps: number; weight_kg: number | null };

/** D-33: volumen = Σ reps × peso. Una serie sin peso (peso corporal) no suma carga. */
export function setsVolume(sets: readonly SetLike[]): number {
  return round1(sets.reduce((acc, s) => acc + s.reps * (s.weight_kg ?? 0), 0));
}

/** Clave para agrupar el mismo ejercicio escrito de formas distintas ("Press  Banca" = "press banca"). */
export function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// --- Meses (D-34/D-36) -------------------------------------------------------

/** "2026-11-17" → "2026-11-01". */
export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function addMonths(monthIso: string, n: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** Día ISO de la semana (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function isoDayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

export const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export function weekdayName(isoDow: number): string {
  return WEEKDAY_NAMES[isoDow - 1] ?? "";
}

/** Ejercicios planificados de un día, en orden. */
export function exercisesForDay<T extends Pick<RoutineExerciseRow, "day_of_week" | "position">>(
  exercises: readonly T[],
  dayOfWeek: number,
): T[] {
  return exercises.filter((e) => e.day_of_week === dayOfWeek).sort((a, b) => a.position - b.position);
}

/** Días de la semana (ISO) que tienen ejercicios (D-35). */
export function trainingDays(exercises: readonly Pick<RoutineExerciseRow, "day_of_week">[]): number[] {
  return [...new Set(exercises.map((e) => e.day_of_week))].sort((a, b) => a - b);
}

// --- Sesiones por semana -----------------------------------------------------

export type WeekCount = { weekStart: string; sessions: number };

/** Últimas `weeks` semanas (lunes a domingo) terminando en la semana de `today`, con ceros incluidos. */
export function weeklySessionCounts(
  sessions: readonly { started_date: string }[],
  today: string,
  weeks: number,
): WeekCount[] {
  const current = weekStart(today);
  const out: WeekCount[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: addDays(current, -7 * i), sessions: 0 });
  const index = new Map(out.map((w, i) => [w.weekStart, i]));
  for (const s of sessions) {
    const i = index.get(weekStart(s.started_date));
    if (i !== undefined) out[i].sessions += 1;
  }
  return out;
}

export function sessionsThisWeek(sessions: readonly { started_date: string }[], today: string): number {
  const start = weekStart(today);
  return sessions.filter((s) => s.started_date >= start && s.started_date <= today).length;
}

// --- Progreso por ejercicio --------------------------------------------------

export type ExerciseEntry = {
  name: string;
  date: string;
  volume: number;
  /** Mayor peso usado en una serie; null si fue solo peso corporal. */
  maxWeight: number | null;
};

export type ExerciseProgress = {
  key: string;
  name: string;
  sessions: number;
  volume: number;
  previousVolume: number;
  maxWeight: number | null;
  /** Variación del volumen respecto a los 30 días previos; null si antes no hay datos. */
  changePct: number | null;
};

/**
 * Compara los últimos 30 días (incluido hoy) con los 30 anteriores, agrupando por nombre normalizado.
 * Muestra el nombre tal como se escribió la vez más reciente.
 */
export function exerciseProgress(entries: readonly ExerciseEntry[], today: string): ExerciseProgress[] {
  const recentFrom = addDays(today, -29);
  const previousFrom = addDays(today, -59);
  const map = new Map<string, ExerciseProgress & { lastDate: string }>();

  for (const e of entries) {
    if (e.date < previousFrom || e.date > today) continue;
    const key = normalizeExerciseName(e.name);
    const cur =
      map.get(key) ??
      { key, name: e.name, sessions: 0, volume: 0, previousVolume: 0, maxWeight: null, changePct: null, lastDate: "" };

    if (e.date >= recentFrom) {
      cur.sessions += 1;
      cur.volume += e.volume;
      if (e.maxWeight !== null && (cur.maxWeight === null || e.maxWeight > cur.maxWeight)) cur.maxWeight = e.maxWeight;
    } else {
      cur.previousVolume += e.volume;
    }
    if (e.date >= cur.lastDate) {
      cur.lastDate = e.date;
      cur.name = e.name;
    }
    map.set(key, cur);
  }

  return [...map.values()]
    .map((p) => ({
      key: p.key,
      name: p.name,
      sessions: p.sessions,
      maxWeight: p.maxWeight,
      volume: round1(p.volume),
      previousVolume: round1(p.previousVolume),
      changePct: p.previousVolume > 0 ? Math.round(((p.volume - p.previousVolume) / p.previousVolume) * 100) : null,
    }))
    .filter((p) => p.sessions > 0)
    .sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name, "es"));
}

export function formatKg(n: number): string {
  return `${new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(n)} kg`;
}
