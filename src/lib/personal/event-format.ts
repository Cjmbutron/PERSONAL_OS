import { formatClock, formatDate } from "@/lib/utils/date";
import type { CalendarEventRow } from "@/types/database";

/** Cuándo ocurre un evento, en palabras: "Hoy 14:00–16:00", "12 nov – 14 nov", etc. */
export function eventWhen(e: CalendarEventRow, timezone: string): string {
  if (e.all_day) {
    return e.first_day === e.last_day ? `${formatDate(e.first_day)} · todo el día` : `${formatDate(e.first_day)} – ${formatDate(e.last_day)} · todo el día`;
  }
  const start = e.starts_at as string;
  const end = e.ends_at as string;
  const startClock = formatClock(start, timezone);
  const endClock = formatClock(end, timezone);
  if (e.first_day === e.last_day) return `${formatDate(e.first_day)} · ${startClock}${endClock !== startClock ? `–${endClock}` : ""}`;
  return `${formatDate(e.first_day)} ${startClock} – ${formatDate(e.last_day)} ${endClock}`;
}
