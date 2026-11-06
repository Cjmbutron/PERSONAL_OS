import { addDays } from "@/lib/utils/date";
import { isScheduledOn, isoWeekday, weekStart, type HabitSchedule } from "@/lib/habits/streaks";

/** Lógica pura de la revisión semanal (D-71 a D-78). Semanas de lunes a domingo. */

export { weekStart };

export function weekEnd(monday: string): string {
  return addDays(monday, 6);
}

/** Normaliza cualquier fecha al lunes de su semana; null si no es una fecha válida. */
export function normalizeWeek(input: string | undefined): string | null {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) return null;
  return weekStart(input);
}

export function weekLabel(monday: string): string {
  const end = weekEnd(monday);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fmt = (d: string) => `${Number(d.slice(8))} ${months[Number(d.slice(5, 7)) - 1]}`;
  return `${fmt(monday)} – ${fmt(end)} ${end.slice(0, 4)}`;
}

export type HabitWeek = { done: number; target: number };

/**
 * Cumplimiento semanal de un hábito. Solo cuentan los días hasta `today` (una semana en curso
 * no penaliza días futuros). "N veces por semana": la meta es N (como máximo los días ya transcurridos
 * no se aplica: la meta semanal es fija).
 */
export function habitWeekStats(schedule: HabitSchedule, completedDates: Iterable<string>, monday: string, today: string): HabitWeek {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const inWeek = new Set<string>();
  for (const d of completedDates) if (d >= monday && d <= weekEnd(monday) && d <= today) inWeek.add(d);

  if (schedule.type === "times_per_week") {
    return { done: Math.min(inWeek.size, schedule.target), target: schedule.target };
  }
  const scheduled = days.filter((d) => d <= today && isScheduledOn(schedule, d));
  const done = scheduled.filter((d) => inWeek.has(d)).length;
  return { done, target: scheduled.length };
}

export type MoneyFlow = { currency: string; income: number; expense: number };

/** Ingresos y gastos por moneda; las transferencias no cuentan (D-48). Nunca mezcla monedas. */
export function flowByCurrency(rows: readonly { kind: string; currency: string; amount: number }[]): MoneyFlow[] {
  const map = new Map<string, MoneyFlow>();
  for (const r of rows) {
    if (r.kind !== "income" && r.kind !== "expense") continue;
    const f = map.get(r.currency) ?? { currency: r.currency, income: 0, expense: 0 };
    if (r.kind === "income") f.income = Math.round((f.income + r.amount) * 100) / 100;
    else f.expense = Math.round((f.expense + r.amount) * 100) / 100;
    map.set(r.currency, f);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** ¿La semana ya puede revisarse? No se revisan semanas futuras (D-72). */
export function canReviewWeek(monday: string, today: string): boolean {
  return isoWeekday(monday) === 1 && monday <= weekStart(today);
}
