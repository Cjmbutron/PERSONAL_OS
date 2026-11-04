import { describe, expect, it } from "vitest";
import {
  completedThisWeek,
  computeStreak,
  isoWeekday,
  isScheduledOn,
  lastDays,
  weekStart,
} from "@/lib/habits/streaks";

/**
 * Calendario de referencia (2026):
 *   oct: 19 lun … 25 dom · 26 lun … 31 sáb · nov: 1 dom · 2 lun · 3 mar · 4 mié (hoy) · 8 dom
 */
const TODAY = "2026-11-04"; // miércoles

describe("fechas ISO", () => {
  it("calcula el día de la semana (1 = lunes … 7 = domingo)", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-04")).toBe(3);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });

  it("encuentra el lunes de la semana", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });

  it("lastDays devuelve las últimas N fechas en orden cronológico", () => {
    expect(lastDays(TODAY, 3)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });

  it("isScheduledOn respeta los días elegidos", () => {
    const mwf = { type: "days_of_week", days: [1, 3, 5] } as const;
    expect(isScheduledOn(mwf, "2026-11-02")).toBe(true);
    expect(isScheduledOn(mwf, "2026-11-03")).toBe(false);
    expect(isScheduledOn({ type: "daily" }, "2026-11-03")).toBe(true);
    expect(isScheduledOn({ type: "times_per_week", target: 3 }, "2026-11-03")).toBe(true);
  });
});

describe("racha de hábito diario", () => {
  const daily = { type: "daily" } as const;

  it("sin registros es 0", () => {
    expect(computeStreak(daily, [], TODAY)).toEqual({ current: 0, best: 0, unit: "days" });
  });

  it("cuenta días consecutivos incluyendo hoy", () => {
    const r = computeStreak(daily, ["2026-11-02", "2026-11-03", "2026-11-04"], TODAY);
    expect(r).toMatchObject({ current: 3, best: 3 });
  });

  it("si hoy aún no se cumple, la racha de ayer sigue viva", () => {
    const r = computeStreak(daily, ["2026-11-02", "2026-11-03"], TODAY);
    expect(r).toMatchObject({ current: 2, best: 2 });
  });

  it("un día sin cumplir (que no es hoy) rompe la racha, pero se conserva la mejor", () => {
    const r = computeStreak(daily, ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-03"], TODAY);
    expect(r).toMatchObject({ current: 1, best: 3 });
  });

  it("si ayer no se cumplió y hoy tampoco, la racha vigente es 0", () => {
    const r = computeStreak(daily, ["2026-11-01", "2026-11-02"], TODAY);
    expect(r.current).toBe(0);
    expect(r.best).toBe(2);
  });

  it("ignora fechas futuras y duplicados", () => {
    const r = computeStreak(daily, ["2026-11-04", "2026-11-04", "2026-11-05", "2026-11-06"], TODAY);
    expect(r).toMatchObject({ current: 1, best: 1 });
  });
});

describe("racha de hábito por días específicos (lun-mié-vie)", () => {
  const mwf = { type: "days_of_week", days: [1, 3, 5] } as const;

  it("los días no programados no rompen ni suman", () => {
    // vie 30, lun 2, mié 4 (hoy)
    const r = computeStreak(mwf, ["2026-10-30", "2026-11-02", "2026-11-04"], TODAY);
    expect(r).toMatchObject({ current: 3, best: 3 });
  });

  it("un día programado fallado rompe la racha", () => {
    // vie 30 y mié 4 cumplidos, lun 2 fallado
    const r = computeStreak(mwf, ["2026-10-30", "2026-11-04"], TODAY);
    expect(r).toMatchObject({ current: 1, best: 1 });
  });

  it("hoy no programado no afecta la racha vigente", () => {
    // hoy (mar 3) no toca; lun 2 y vie 30 cumplidos
    const r = computeStreak(mwf, ["2026-10-30", "2026-11-02"], "2026-11-03");
    expect(r.current).toBe(2);
  });

  it("cumplir un día no programado no cuenta para la racha", () => {
    const r = computeStreak(mwf, ["2026-11-03"], "2026-11-03");
    expect(r).toMatchObject({ current: 0, best: 0 });
  });
});

describe("racha de hábito de N veces por semana (meta 3)", () => {
  const w3 = { type: "times_per_week", target: 3 } as const;

  it("cuenta semanas consecutivas con la meta cumplida; la semana en curso no rompe", () => {
    const r = computeStreak(
      w3,
      [
        "2026-10-19", "2026-10-21", "2026-10-23", // semana 19–25: 3
        "2026-10-26", "2026-10-28", "2026-10-30", // semana 26–1: 3
        "2026-11-02", // semana en curso: 1 de 3
      ],
      TODAY,
    );
    expect(r).toEqual({ current: 2, best: 2, unit: "weeks" });
  });

  it("la semana en curso suma cuando ya cumplió la meta", () => {
    const r = computeStreak(
      w3,
      ["2026-10-26", "2026-10-28", "2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04"],
      TODAY,
    );
    expect(r).toMatchObject({ current: 2, best: 2 });
  });

  it("una semana pasada por debajo de la meta rompe la racha", () => {
    const r = computeStreak(
      w3,
      [
        "2026-10-19", "2026-10-21", "2026-10-23", // 3
        "2026-10-26", "2026-10-28", // 2 → rompe
        "2026-11-02", "2026-11-03", "2026-11-04", // semana en curso cumplida
      ],
      TODAY,
    );
    expect(r).toMatchObject({ current: 1, best: 1 });
  });

  it("una semana intermedia sin registros también rompe", () => {
    const r = computeStreak(
      w3,
      ["2026-10-12", "2026-10-14", "2026-10-16", "2026-11-02", "2026-11-03", "2026-11-04"],
      TODAY,
    );
    expect(r).toMatchObject({ current: 1, best: 1 });
  });
});

describe("completedThisWeek", () => {
  it("cuenta solo los días cumplidos de la semana en curso, sin duplicados", () => {
    const n = completedThisWeek(["2026-11-01", "2026-11-02", "2026-11-02", "2026-11-04", "2026-11-09"], TODAY);
    expect(n).toBe(2);
  });
});
