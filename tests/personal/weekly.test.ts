import { describe, expect, it } from "vitest";
import { canReviewWeek, flowByCurrency, habitWeekStats, normalizeWeek, weekEnd, weekLabel } from "@/lib/personal/weekly";

describe("semanas", () => {
  it("normaliza al lunes y rechaza fechas inválidas", () => {
    expect(normalizeWeek("2026-11-06")).toBe("2026-11-02"); // viernes
    expect(normalizeWeek("2026-11-02")).toBe("2026-11-02");
    expect(normalizeWeek("2026-11-08")).toBe("2026-11-02"); // domingo
    expect(normalizeWeek("2026-02-31")).toBeNull();
    expect(normalizeWeek("hoy")).toBeNull();
    expect(normalizeWeek(undefined)).toBeNull();
  });
  it("fin y etiqueta", () => {
    expect(weekEnd("2026-11-02")).toBe("2026-11-08");
    expect(weekLabel("2026-11-02")).toBe("2 nov – 8 nov 2026");
    expect(weekLabel("2026-12-28")).toBe("28 dic – 3 ene 2027");
  });
  it("no se revisan semanas futuras", () => {
    expect(canReviewWeek("2026-11-02", "2026-11-06")).toBe(true);
    expect(canReviewWeek("2026-10-26", "2026-11-06")).toBe(true);
    expect(canReviewWeek("2026-11-09", "2026-11-06")).toBe(false);
    expect(canReviewWeek("2026-11-03", "2026-11-06")).toBe(false); // no es lunes
  });
});

describe("hábitos de la semana", () => {
  const monday = "2026-11-02";
  it("diario: cuenta solo los días transcurridos", () => {
    const r = habitWeekStats({ type: "daily" }, ["2026-11-02", "2026-11-03", "2026-11-10"], monday, "2026-11-04");
    expect(r).toEqual({ done: 2, target: 3 });
  });
  it("semana pasada completa", () => {
    expect(habitWeekStats({ type: "daily" }, ["2026-11-02", "2026-11-08"], monday, "2026-11-20")).toEqual({ done: 2, target: 7 });
  });
  it("días concretos", () => {
    const s = { type: "days_of_week", days: [1, 3, 5] } as const;
    expect(habitWeekStats(s, ["2026-11-02", "2026-11-03", "2026-11-04"], monday, "2026-11-20")).toEqual({ done: 2, target: 3 });
  });
  it("N veces por semana: meta fija y tope", () => {
    const s = { type: "times_per_week", target: 3 } as const;
    expect(habitWeekStats(s, ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"], monday, "2026-11-20")).toEqual({ done: 3, target: 3 });
    expect(habitWeekStats(s, ["2026-11-02"], monday, "2026-11-03")).toEqual({ done: 1, target: 3 });
  });
});

describe("flujo de dinero", () => {
  it("separa por moneda e ignora transferencias", () => {
    const r = flowByCurrency([
      { kind: "income", currency: "BOB", amount: 100.1 },
      { kind: "income", currency: "BOB", amount: 0.2 },
      { kind: "expense", currency: "BOB", amount: 40 },
      { kind: "transfer_in", currency: "BOB", amount: 999 },
      { kind: "expense", currency: "USD", amount: 5 },
    ]);
    expect(r).toEqual([
      { currency: "BOB", income: 100.3, expense: 40 },
      { currency: "USD", income: 0, expense: 5 },
    ]);
  });
});
