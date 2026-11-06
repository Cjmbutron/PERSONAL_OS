import { describe, expect, it } from "vitest";
import { buildMonthGrid, daysUntil, goalPercent, isoWeekday, itemsOnDay, validateEventRange, type CalendarItem } from "@/lib/personal/calendar";
import { eventInputSchema, goalInputSchema } from "@/lib/validations/personal";

describe("cuadrícula del mes", () => {
  it("empieza en lunes y termina en domingo", () => {
    const weeks = buildMonthGrid("2026-11-01"); // 1 nov 2026 es domingo
    expect(isoWeekday("2026-11-01")).toBe(7);
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.at(-1)?.[6]).toBe("2026-12-06");
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it("febrero que empieza en lunes ocupa 4 semanas", () => {
    const weeks = buildMonthGrid("2027-02-01");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2027-02-01");
  });
  it("acepta cualquier día del mes", () => {
    expect(buildMonthGrid("2026-11-17")).toEqual(buildMonthGrid("2026-11-01"));
  });
});

describe("elementos por día", () => {
  const item = (o: Partial<CalendarItem> & { key: string }): CalendarItem => ({
    kind: "event", title: o.key, firstDay: "2026-11-10", lastDay: "2026-11-10", time: null, ...o,
  });
  it("filtra por rango, y ordena sin hora primero y luego por hora", () => {
    const items = [
      item({ key: "tarde", time: "18:00" }),
      item({ key: "mañana", time: "08:00" }),
      item({ key: "viaje", firstDay: "2026-11-09", lastDay: "2026-11-12" }),
      item({ key: "otro", firstDay: "2026-11-20", lastDay: "2026-11-20" }),
    ];
    expect(itemsOnDay(items, "2026-11-10").map((i) => i.key)).toEqual(["viaje", "mañana", "tarde"]);
    expect(itemsOnDay(items, "2026-11-12").map((i) => i.key)).toEqual(["viaje"]);
    expect(itemsOnDay(items, "2026-11-13")).toEqual([]);
  });
});

describe("avance de objetivos (D-68)", () => {
  it("usa hitos si existen y el manual si no", () => {
    expect(goalPercent(80, 4, 1)).toBe(25);
    expect(goalPercent(80, 0, 0)).toBe(80);
    expect(goalPercent(0, 3, 3)).toBe(100);
    expect(goalPercent(150, 0, 0)).toBe(100);
    expect(goalPercent(0, 4, 1, "completed")).toBe(100);
  });
  it("calcula días restantes", () => {
    expect(daysUntil("2026-11-10", "2026-11-06")).toBe(4);
    expect(daysUntil("2026-11-01", "2026-11-06")).toBe(-5);
    expect(daysUntil(null, "2026-11-06")).toBeNull();
  });
});

describe("rango de eventos (D-59)", () => {
  it("todo el día: orden y máximo 31 días", () => {
    expect(validateEventRange({ allDay: true, startDate: "2026-11-01", endDate: "2026-12-01" })).toBeNull();
    expect(validateEventRange({ allDay: true, startDate: "2026-11-01", endDate: "2026-12-02" })).toMatch(/31 días/);
    expect(validateEventRange({ allDay: true, startDate: "2026-11-02", endDate: "2026-11-01" })).toMatch(/anterior/);
  });
  it("con hora: orden y máximo 14 días", () => {
    const d = (s: string) => new Date(s);
    expect(validateEventRange({ allDay: false, startsAt: d("2026-11-01T00:00Z"), endsAt: d("2026-11-15T00:00Z") })).toBeNull();
    expect(validateEventRange({ allDay: false, startsAt: d("2026-11-01T00:00Z"), endsAt: d("2026-11-15T00:01Z") })).toMatch(/14 días/);
    expect(validateEventRange({ allDay: false, startsAt: d("2026-11-02T00:00Z"), endsAt: d("2026-11-01T00:00Z") })).toMatch(/anterior/);
    expect(validateEventRange({ allDay: false, startsAt: new Date(NaN), endsAt: d("2026-11-01T00:00Z") })).toMatch(/no válidas/);
  });
});

describe("esquemas", () => {
  it("evento con hora y de todo el día", () => {
    expect(eventInputSchema.safeParse({ kind: "timed", title: " Cena ", startsAt: "2026-11-10T19:00", endsAt: "2026-11-10T21:00", lifeAreaId: "", description: "", location: "" }).data)
      .toMatchObject({ title: "Cena", lifeAreaId: null, description: null });
    expect(eventInputSchema.safeParse({ kind: "allday", title: "Viaje", startDate: "2026-11-10", endDate: "2026-11-12" }).success).toBe(true);
  });
  it("rechaza tipo desconocido, título vacío y fechas inválidas", () => {
    expect(eventInputSchema.safeParse({ kind: "x", title: "a" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ kind: "allday", title: " ", startDate: "2026-11-10", endDate: "2026-11-10" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ kind: "allday", title: "a", startDate: "2026-13-10", endDate: "2026-11-10" }).success).toBe(false);
  });
  it("objetivo: avance por defecto 0 y rango 0–100", () => {
    expect(goalInputSchema.safeParse({ title: "Meta", targetDate: "", lifeAreaId: "", description: "" }).data).toMatchObject({ manualProgress: 0, targetDate: null });
    expect(goalInputSchema.safeParse({ title: "Meta", manualProgress: "101" }).success).toBe(false);
    expect(goalInputSchema.safeParse({ title: "Meta", manualProgress: "50.5" }).success).toBe(false);
  });
});
