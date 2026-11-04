import { describe, expect, it } from "vitest";
import { buildHabitViews } from "@/lib/habits/overview";
import { habitInputSchema, habitLogArgsSchema } from "@/lib/validations/habits";
import type { HabitRow } from "@/types/database";

const TODAY = "2026-11-04"; // miércoles

function habit(over: Partial<HabitRow>): HabitRow {
  return {
    id: "h1",
    workspace_id: "w1",
    life_area_id: null,
    name: "Leer",
    description: null,
    frequency_type: "daily",
    days_of_week: null,
    target_per_week: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    archived_at: null,
    ...over,
  };
}

describe("buildHabitViews", () => {
  it("marca cumplido hoy y arma los últimos 7 días", () => {
    const [v] = buildHabitViews(
      [habit({})],
      [
        { habit_id: "h1", log_date: "2026-11-03", completed: true },
        { habit_id: "h1", log_date: "2026-11-04", completed: true },
      ],
      TODAY,
    );
    expect(v.doneToday).toBe(true);
    expect(v.streak.current).toBe(2);
    expect(v.recent).toHaveLength(7);
    expect(v.recent.at(-1)).toEqual({ date: TODAY, done: true, scheduled: true });
    expect(v.recent[0].date).toBe("2026-10-29");
  });

  it("un registro con completed = false (deshecho) no cuenta", () => {
    const [v] = buildHabitViews([habit({})], [{ habit_id: "h1", log_date: TODAY, completed: false }], TODAY);
    expect(v.doneToday).toBe(false);
    expect(v.streak.current).toBe(0);
  });

  it("no mezcla registros de hábitos distintos", () => {
    const views = buildHabitViews(
      [habit({ id: "h1" }), habit({ id: "h2", name: "Correr" })],
      [{ habit_id: "h2", log_date: TODAY, completed: true }],
      TODAY,
    );
    expect(views.map((v) => v.doneToday)).toEqual([false, true]);
  });

  it("días específicos: hoy no toca si no está en la lista", () => {
    const [v] = buildHabitViews([habit({ frequency_type: "days_of_week", days_of_week: [1, 5] })], [], TODAY);
    expect(v.dueToday).toBe(false);
  });

  it("N veces por semana: toca mientras no se alcance la meta, y sigue visible si hoy ya se cumplió", () => {
    const h = habit({ frequency_type: "times_per_week", target_per_week: 2 });
    const pending = buildHabitViews([h], [{ habit_id: "h1", log_date: "2026-11-02", completed: true }], TODAY)[0];
    expect(pending.dueToday).toBe(true);
    expect(pending.weekDone).toBe(1);

    const metYesterday = buildHabitViews(
      [h],
      [
        { habit_id: "h1", log_date: "2026-11-02", completed: true },
        { habit_id: "h1", log_date: "2026-11-03", completed: true },
      ],
      TODAY,
    )[0];
    expect(metYesterday.dueToday).toBe(false);

    const metToday = buildHabitViews(
      [h],
      [
        { habit_id: "h1", log_date: "2026-11-02", completed: true },
        { habit_id: "h1", log_date: TODAY, completed: true },
      ],
      TODAY,
    )[0];
    expect(metToday.dueToday).toBe(true);
    expect(metToday.doneToday).toBe(true);
  });
});

describe("habitInputSchema", () => {
  const base = { name: "  Leer  ", description: "", lifeAreaId: "", frequencyType: "daily", daysOfWeek: [], targetPerWeek: "" };

  it("normaliza nombre y campos vacíos", () => {
    const r = habitInputSchema.parse(base);
    expect(r).toMatchObject({ name: "Leer", description: null, lifeAreaId: null, targetPerWeek: null });
  });

  it("days_of_week exige al menos un día", () => {
    const r = habitInputSchema.safeParse({ ...base, frequencyType: "days_of_week" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["daysOfWeek"]);
    expect(habitInputSchema.safeParse({ ...base, frequencyType: "days_of_week", daysOfWeek: ["1", "3"] }).success).toBe(true);
  });

  it("times_per_week exige una meta entre 1 y 7", () => {
    const t = (targetPerWeek: unknown) => habitInputSchema.safeParse({ ...base, frequencyType: "times_per_week", targetPerWeek });
    expect(t("").success).toBe(false);
    expect(t("0").success).toBe(false);
    expect(t("8").success).toBe(false);
    expect(t("2.5").success).toBe(false);
    expect(t("abc").success).toBe(false);
    expect(t("3").success).toBe(true);
  });

  it("rechaza días fuera de rango, frecuencias desconocidas y nombres vacíos o largos", () => {
    expect(habitInputSchema.safeParse({ ...base, frequencyType: "days_of_week", daysOfWeek: ["9"] }).success).toBe(false);
    expect(habitInputSchema.safeParse({ ...base, frequencyType: "monthly" }).success).toBe(false);
    expect(habitInputSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    expect(habitInputSchema.safeParse({ ...base, name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("habitLogArgsSchema", () => {
  it("valida id, fecha y booleano", () => {
    const ok = { habitId: "3f2b8c1e-5d1a-4b7e-9a6c-2d8e4f7a1b3c", date: "2026-11-04", completed: true };
    expect(habitLogArgsSchema.safeParse(ok).success).toBe(true);
    expect(habitLogArgsSchema.safeParse({ ...ok, habitId: "x" }).success).toBe(false);
    expect(habitLogArgsSchema.safeParse({ ...ok, date: "04/11/2026" }).success).toBe(false);
    expect(habitLogArgsSchema.safeParse({ ...ok, completed: "yes" }).success).toBe(false);
  });
});
