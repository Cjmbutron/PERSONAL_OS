import { addDays } from "@/lib/utils/date";

/**
 * Reglas de recurrencia y rachas de hábitos (D-16, D-18). Funciones puras, sin I/O.
 * Todas las fechas son YYYY-MM-DD del calendario del usuario (D-08).
 */

export type HabitSchedule =
  | { type: "daily" }
  | { type: "days_of_week"; days: readonly number[] }
  | { type: "times_per_week"; target: number };

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

/** Lunes de la semana (ISO) que contiene la fecha. */
export function weekStart(isoDate: string): string {
  return addDays(isoDate, -(isoWeekday(isoDate) - 1));
}

/** ¿Toca el hábito en esta fecha? Los de "N veces por semana" pueden hacerse cualquier día. */
export function isScheduledOn(schedule: HabitSchedule, isoDate: string): boolean {
  switch (schedule.type) {
    case "daily":
    case "times_per_week":
      return true;
    case "days_of_week":
      return schedule.days.includes(isoWeekday(isoDate));
  }
}

export type StreakResult = {
  /** Racha vigente: días programados (o semanas con meta cumplida) consecutivos. */
  current: number;
  best: number;
  unit: "days" | "weeks";
};

/**
 * Calcula racha actual y mejor racha a partir de las fechas cumplidas.
 *
 * - daily / days_of_week: cuenta días programados cumplidos consecutivos. Un día no programado
 *   no rompe ni suma. Si hoy toca y aún no se cumplió, no rompe la racha (todavía hay tiempo).
 * - times_per_week: cuenta semanas ISO consecutivas con al menos `target` días cumplidos.
 *   La semana en curso no rompe la racha mientras no termine; suma si ya cumplió la meta.
 */
export function computeStreak(
  schedule: HabitSchedule,
  completedDates: Iterable<string>,
  today: string,
): StreakResult {
  const completed = new Set<string>();
  for (const d of completedDates) if (d <= today) completed.add(d);

  if (schedule.type === "times_per_week") return weeklyStreak(schedule.target, completed, today);
  return dailyStreak(schedule, completed, today);
}

function dailyStreak(schedule: HabitSchedule, completed: Set<string>, today: string): StreakResult {
  if (completed.size === 0) return { current: 0, best: 0, unit: "days" };

  const earliest = [...completed].sort()[0];
  let run = 0;
  let best = 0;

  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (!isScheduledOn(schedule, d)) continue;
    if (completed.has(d)) {
      run += 1;
      if (run > best) best = run;
    } else if (d !== today) {
      run = 0;
    }
  }
  return { current: run, best, unit: "days" };
}

function weeklyStreak(target: number, completed: Set<string>, today: string): StreakResult {
  if (completed.size === 0) return { current: 0, best: 0, unit: "weeks" };

  const perWeek = new Map<string, number>();
  for (const d of completed) {
    const w = weekStart(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }

  const currentWeek = weekStart(today);
  const firstWeek = weekStart([...completed].sort()[0]);
  let run = 0;
  let best = 0;

  for (let w = firstWeek; w <= currentWeek; w = addDays(w, 7)) {
    if ((perWeek.get(w) ?? 0) >= target) {
      run += 1;
      if (run > best) best = run;
    } else if (w !== currentWeek) {
      run = 0;
    }
  }
  return { current: run, best, unit: "weeks" };
}

/** Días cumplidos en la semana ISO que contiene `today`. */
export function completedThisWeek(completedDates: Iterable<string>, today: string): number {
  const start = weekStart(today);
  let n = 0;
  for (const d of new Set(completedDates)) if (d >= start && d <= today) n += 1;
  return n;
}

/** Las últimas `count` fechas terminando en `today`, de la más antigua a la más reciente. */
export function lastDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}
