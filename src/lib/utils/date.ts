export const DEFAULT_TIMEZONE = "America/La_Paz";

/** ¿Es un identificador IANA válido para este runtime? */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fecha de "hoy" (YYYY-MM-DD) en la zona horaria del usuario (D-08).
 * Las fechas de vencimiento son DATE sin zona, así que se comparan como texto ISO.
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  // El locale en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "2026-11-03" → "03/11/2026" (es-BO). No usa Date para evitar corrimientos por zona horaria. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function isOverdue(dueDate: string | null | undefined, today: string): boolean {
  return Boolean(dueDate) && (dueDate as string) < today;
}

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Nombre del día de la semana en español ("2026-11-04" → "Miércoles"), sin depender de la zona local. */
export function isoWeekdayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Resta días a una fecha ISO (YYYY-MM-DD) sin depender de la zona horaria local. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Desfase (en minutos) de una zona respecto a UTC en un instante dado. */
function offsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - at.getTime()) / 60000;
}

/**
 * Hora de pared ("2026-11-04T07:00") en la zona del usuario → instante UTC.
 * Es lo que envía un `<input type="datetime-local">`, que no lleva zona horaria.
 */
export function localDateTimeToInstant(local: string, timezone: string): Date {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return new Date(Number.NaN);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const first = offsetMinutes(tz, guess);
  let result = new Date(guess.getTime() - first * 60000);
  const second = offsetMinutes(tz, result);
  if (second !== first) result = new Date(guess.getTime() - second * 60000);
  return result;
}

/** Instante → "YYYY-MM-DDTHH:mm" en la zona del usuario, para repoblar un `datetime-local`. */
export function instantToLocalInput(instant: Date | string, timezone: string): string {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Instante → "07:30" en la zona del usuario. */
export function formatClock(instant: Date | string, timezone: string): string {
  return instantToLocalInput(instant, timezone).slice(11);
}

/**
 * Instante (UTC) en que empieza el día `isoDate` en la zona del usuario.
 * Sirve para comparar contra columnas timestamptz (p. ej. completed_at) con el día "del usuario".
 */
export function startOfDayInstant(isoDate: string, timezone: string): Date {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const first = offsetMinutes(tz, guess);
  let result = new Date(guess.getTime() - first * 60000);
  // Si cruzamos un cambio de horario (DST), reajusta con el desfase real en ese instante.
  const second = offsetMinutes(tz, result);
  if (second !== first) result = new Date(guess.getTime() - second * 60000);
  return result;
}
