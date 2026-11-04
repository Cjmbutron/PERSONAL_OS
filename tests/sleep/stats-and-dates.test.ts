import { describe, expect, it } from "vitest";
import {
  buildSleepSeries,
  formatDuration,
  summarizeSleep,
  validateSleepWindow,
  type SleepPoint,
} from "@/lib/sleep/stats";
import { formatClock, instantToLocalInput, localDateTimeToInstant } from "@/lib/utils/date";
import { sleepGoalSchema, sleepInputSchema } from "@/lib/validations/sleep";

describe("formatDuration", () => {
  it("formatea horas y minutos", () => {
    expect(formatDuration(450)).toBe("7 h 30 min");
    expect(formatDuration(480)).toBe("8 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(-70)).toBe("1 h 10 min");
  });
});

describe("zona horaria (D-08)", () => {
  it("La Paz es UTC-4 todo el año", () => {
    expect(localDateTimeToInstant("2026-11-04T07:00", "America/La_Paz").toISOString()).toBe("2026-11-04T11:00:00.000Z");
    expect(localDateTimeToInstant("2026-07-04T07:00", "America/La_Paz").toISOString()).toBe("2026-07-04T11:00:00.000Z");
  });

  it("respeta el horario de verano de otras zonas", () => {
    expect(localDateTimeToInstant("2026-01-15T07:00", "America/New_York").toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(localDateTimeToInstant("2026-07-15T07:00", "America/New_York").toISOString()).toBe("2026-07-15T11:00:00.000Z");
  });

  it("instantToLocalInput es la inversa y cruza el cambio de día", () => {
    const d = localDateTimeToInstant("2026-11-04T23:30", "America/La_Paz");
    expect(d.toISOString()).toBe("2026-11-05T03:30:00.000Z");
    expect(instantToLocalInput(d, "America/La_Paz")).toBe("2026-11-04T23:30");
    expect(formatClock(d, "America/La_Paz")).toBe("23:30");
  });

  it("medianoche se muestra como 00:00, no 24:00", () => {
    const d = localDateTimeToInstant("2026-11-05T00:00", "America/La_Paz");
    expect(instantToLocalInput(d, "America/La_Paz")).toBe("2026-11-05T00:00");
  });

  it("un texto mal formado da una fecha inválida", () => {
    expect(Number.isNaN(localDateTimeToInstant("04/11/2026 07:00", "America/La_Paz").getTime())).toBe(true);
  });
});

describe("validateSleepWindow (D-27)", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const at = (iso: string) => new Date(iso);

  it("acepta una noche normal", () => {
    expect(validateSleepWindow(at("2026-11-04T03:00:00Z"), at("2026-11-04T11:00:00Z"), now)).toBeNull();
  });

  it("rechaza despertar anterior o igual a acostarse", () => {
    expect(validateSleepWindow(at("2026-11-04T08:00:00Z"), at("2026-11-04T07:00:00Z"), now)?.field).toBe("wakeTime");
    expect(validateSleepWindow(at("2026-11-04T08:00:00Z"), at("2026-11-04T08:00:00Z"), now)?.field).toBe("wakeTime");
  });

  it("rechaza menos de 1 hora y más de 16 horas, y acepta los extremos", () => {
    expect(validateSleepWindow(at("2026-11-04T10:00:00Z"), at("2026-11-04T10:59:00Z"), now)).not.toBeNull();
    expect(validateSleepWindow(at("2026-11-04T09:00:00Z"), at("2026-11-04T10:00:00Z"), now)).toBeNull();
    expect(validateSleepWindow(at("2026-11-03T18:00:00Z"), at("2026-11-04T11:00:00Z"), now)).not.toBeNull();
    expect(validateSleepWindow(at("2026-11-03T19:00:00Z"), at("2026-11-04T11:00:00Z"), now)).toBeNull();
  });

  it("rechaza el futuro, con 5 minutos de tolerancia", () => {
    expect(validateSleepWindow(at("2026-11-04T05:00:00Z"), at("2026-11-04T12:04:00Z"), now)).toBeNull();
    expect(validateSleepWindow(at("2026-11-04T05:00:00Z"), at("2026-11-04T12:06:00Z"), now)?.message).toMatch(/futuro/);
  });

  it("rechaza fechas inválidas", () => {
    expect(validateSleepWindow(new Date(Number.NaN), at("2026-11-04T11:00:00Z"), now)?.field).toBe("bedtime");
    expect(validateSleepWindow(at("2026-11-04T03:00:00Z"), new Date(Number.NaN), now)?.field).toBe("wakeTime");
  });
});

describe("summarizeSleep y buildSleepSeries", () => {
  const rec = (sleep_date: string, duration_minutes: number, quality: number | null = null): SleepPoint => ({
    sleep_date,
    duration_minutes,
    quality,
  });

  it("sin registros no inventa promedios", () => {
    expect(summarizeSleep([], 480)).toEqual({ nights: 0, avgMinutes: null, avgQuality: null, goalMet: 0 });
  });

  it("promedia solo las calidades valoradas y cuenta las noches con la meta", () => {
    const s = summarizeSleep([rec("2026-11-02", 420, 3), rec("2026-11-03", 480, 4), rec("2026-11-04", 540)], 480);
    expect(s.nights).toBe(3);
    expect(s.avgMinutes).toBe(480);
    expect(s.avgQuality).toBe(3.5);
    expect(s.goalMet).toBe(2);
  });

  it("la serie tiene un punto por día, con null donde no hay registro", () => {
    const series = buildSleepSeries([rec("2026-11-02", 420), rec("2026-11-04", 480)], "2026-11-04", 4);
    expect(series).toEqual([
      { date: "2026-11-01", minutes: null },
      { date: "2026-11-02", minutes: 420 },
      { date: "2026-11-03", minutes: null },
      { date: "2026-11-04", minutes: 480 },
    ]);
  });
});

describe("validaciones de formulario", () => {
  const base = { bedtime: "2026-11-03T23:00", wakeTime: "2026-11-04T07:00", quality: "", notes: "" };

  it("acepta y normaliza", () => {
    expect(sleepInputSchema.parse(base)).toMatchObject({ quality: null, notes: null });
    expect(sleepInputSchema.parse({ ...base, quality: "4" }).quality).toBe(4);
  });

  it("rechaza formatos de fecha y calidades inválidas", () => {
    expect(sleepInputSchema.safeParse({ ...base, bedtime: "2026-11-03 23:00" }).success).toBe(false);
    expect(sleepInputSchema.safeParse({ ...base, quality: "0" }).success).toBe(false);
    expect(sleepInputSchema.safeParse({ ...base, quality: "6" }).success).toBe(false);
    expect(sleepInputSchema.safeParse({ ...base, quality: "2.5" }).success).toBe(false);
  });

  it("la meta admite un decimal entre 4 y 12", () => {
    expect(sleepGoalSchema.parse({ goalHours: "7.5" }).goalHours).toBe(7.5);
    expect(sleepGoalSchema.parse({ goalHours: "7.26" }).goalHours).toBe(7.3);
    expect(sleepGoalSchema.safeParse({ goalHours: "3.9" }).success).toBe(false);
    expect(sleepGoalSchema.safeParse({ goalHours: "12.1" }).success).toBe(false);
    expect(sleepGoalSchema.safeParse({ goalHours: "abc" }).success).toBe(false);
  });
});
