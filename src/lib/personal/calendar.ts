import { addDays } from "@/lib/utils/date";

/** Lógica pura del calendario y de los objetivos (Sprint 4). */

/** Un elemento mostrado en el calendario; solo los eventos son editables (D-60). */
export type CalendarItem = {
  key: string;
  kind: "event" | "task" | "obligation";
  title: string;
  /** Días locales que cubre, ambos inclusivos. */
  firstDay: string;
  lastDay: string;
  /** "14:30" para eventos con hora; null en el resto. */
  time: string | null;
  href?: string;
};

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Semanas (lunes a domingo) necesarias para mostrar el mes que empieza en `monthIso`. */
export function buildMonthGrid(monthIso: string): string[][] {
  const first = `${monthIso.slice(0, 7)}-01`;
  const [y, m] = first.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  let cursor = addDays(first, -(isoWeekday(first) - 1));
  const weeks: string[][] = [];
  while (cursor <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) week.push(addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Elementos que tocan el día `day`, con los de todo el día/sin hora primero y luego por hora. */
export function itemsOnDay(items: CalendarItem[], day: string): CalendarItem[] {
  const order = (i: CalendarItem) => (i.time ? `1${i.time}` : `0${i.kind}`);
  return items
    .filter((i) => i.firstDay <= day && day <= i.lastDay)
    .sort((a, b) => order(a).localeCompare(order(b)) || a.title.localeCompare(b.title));
}

/** Avance 0–100: por hitos si existen; si no, el porcentaje manual (D-68). */
export function goalPercent(manual: number, milestonesTotal: number, milestonesDone: number, status?: string): number {
  if (status === "completed") return 100;
  if (milestonesTotal > 0) return Math.round((milestonesDone / milestonesTotal) * 100);
  return Math.min(100, Math.max(0, Math.round(manual)));
}

/** Días hasta la fecha objetivo (negativo si ya pasó); null si no hay fecha. */
export function daysUntil(targetDate: string | null, today: string): number | null {
  if (!targetDate) return null;
  const toMs = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(targetDate) - toMs(today)) / 86_400_000);
}

/** Valida el rango de un evento según D-59. Devuelve un mensaje o null. */
export function validateEventRange(
  input: { allDay: true; startDate: string; endDate: string } | { allDay: false; startsAt: Date; endsAt: Date },
): string | null {
  if (input.allDay) {
    if (input.endDate < input.startDate) return "El fin no puede ser anterior al inicio.";
    const days = Math.round((Date.parse(input.endDate) - Date.parse(input.startDate)) / 86_400_000);
    if (days > 30) return "Un evento de todo el día dura como máximo 31 días.";
    return null;
  }
  if (Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) return "Fecha y hora no válidas.";
  if (input.endsAt < input.startsAt) return "El fin no puede ser anterior al inicio.";
  if (input.endsAt.getTime() - input.startsAt.getTime() > 14 * 86_400_000) return "Un evento con hora dura como máximo 14 días.";
  return null;
}
