import { addDays } from "@/lib/utils/date";

/** Límites de D-27, los mismos que los CHECK de la migración 4. */
export const MIN_SLEEP_MINUTES = 60;
export const MAX_SLEEP_MINUTES = 16 * 60;
/** Tolerancia por desfase de reloj, igual que el trigger de la base de datos. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export type SleepPoint = { sleep_date: string; duration_minutes: number; quality: number | null };

/** 450 → "7 h 30 min" · 480 → "8 h" · 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export type SleepWindowError = { field: "bedtime" | "wakeTime"; message: string };

/** Mismas reglas que la base de datos, para dar el mensaje junto al campo correcto. */
export function validateSleepWindow(bedtime: Date, wakeTime: Date, now: Date = new Date()): SleepWindowError | null {
  if (Number.isNaN(bedtime.getTime())) return { field: "bedtime", message: "Fecha y hora no válidas" };
  if (Number.isNaN(wakeTime.getTime())) return { field: "wakeTime", message: "Fecha y hora no válidas" };
  if (wakeTime <= bedtime) {
    return { field: "wakeTime", message: "Debe ser posterior a la hora de acostarse" };
  }
  if (wakeTime.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return { field: "wakeTime", message: "No puede estar en el futuro" };
  }
  const minutes = (wakeTime.getTime() - bedtime.getTime()) / 60_000;
  if (minutes < MIN_SLEEP_MINUTES) return { field: "wakeTime", message: "El sueño debe durar al menos 1 hora" };
  if (minutes > MAX_SLEEP_MINUTES) return { field: "wakeTime", message: "El sueño no puede durar más de 16 horas" };
  return null;
}

export type SleepSummary = {
  nights: number;
  avgMinutes: number | null;
  avgQuality: number | null;
  /** Noches que alcanzaron la meta. */
  goalMet: number;
};

export function summarizeSleep(records: readonly SleepPoint[], goalMinutes: number): SleepSummary {
  if (records.length === 0) return { nights: 0, avgMinutes: null, avgQuality: null, goalMet: 0 };

  const totalMinutes = records.reduce((sum, r) => sum + r.duration_minutes, 0);
  const rated = records.filter((r) => r.quality !== null);
  const avgQuality = rated.length ? rated.reduce((sum, r) => sum + (r.quality as number), 0) / rated.length : null;

  return {
    nights: records.length,
    avgMinutes: Math.round(totalMinutes / records.length),
    avgQuality: avgQuality === null ? null : Math.round(avgQuality * 10) / 10,
    goalMet: records.filter((r) => r.duration_minutes >= goalMinutes).length,
  };
}

export type SleepDay = { date: string; minutes: number | null };

/** Una entrada por día del rango (hoy incluido); `null` si ese día no hay registro. */
export function buildSleepSeries(records: readonly SleepPoint[], today: string, days: number): SleepDay[] {
  const byDate = new Map(records.map((r) => [r.sleep_date, r.duration_minutes]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, minutes: byDate.get(date) ?? null };
  });
}
