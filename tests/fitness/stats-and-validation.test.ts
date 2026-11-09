import { describe, expect, it } from "vitest";
import {
  addMonths,
  exerciseProgress,
  exercisesForDay,
  isoDayOfWeek,
  monthLabel,
  monthStart,
  normalizeExerciseName,
  sessionsThisWeek,
  setsVolume,
  trainingDays,
  weeklySessionCounts,
} from "@/lib/fitness/stats";
import { chunk } from "@/lib/supabase/paginate";
import {
  monthSchema,
  parseJsonField,
  routineExercisesSchema,
  sessionExercisesSchema,
  sessionInputSchema,
} from "@/lib/validations/fitness";

describe("setsVolume (D-33)", () => {
  it("suma reps × peso; peso corporal no suma carga", () => {
    expect(setsVolume([{ reps: 5, weight_kg: 80 }, { reps: 3, weight_kg: 85 }])).toBe(655);
    expect(setsVolume([{ reps: 12, weight_kg: null }])).toBe(0);
    expect(setsVolume([])).toBe(0);
  });
  it("evita errores de coma flotante", () => {
    expect(setsVolume([{ reps: 3, weight_kg: 0.1 }, { reps: 3, weight_kg: 0.2 }])).toBe(0.9);
  });
});

describe("meses (D-34/D-36)", () => {
  it("monthStart, addMonths y cambio de año", () => {
    expect(monthStart("2026-11-17")).toBe("2026-11-01");
    expect(addMonths("2026-11-01", 1)).toBe("2026-12-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
  it("etiqueta en español", () => {
    expect(monthLabel("2026-11-01")).toBe("noviembre de 2026");
  });
  it("día ISO de la semana", () => {
    expect(isoDayOfWeek("2026-11-02")).toBe(1); // lunes
    expect(isoDayOfWeek("2026-11-08")).toBe(7); // domingo
  });
});

describe("rutina", () => {
  const ex = [
    { day_of_week: 3, position: 2, name: "B" },
    { day_of_week: 1, position: 1, name: "A" },
    { day_of_week: 3, position: 1, name: "C" },
  ];
  it("ejercicios del día en orden y días de entrenamiento", () => {
    expect(exercisesForDay(ex, 3).map((e) => e.name)).toEqual(["C", "B"]);
    expect(exercisesForDay(ex, 2)).toEqual([]);
    expect(trainingDays(ex)).toEqual([1, 3]);
  });
});

describe("sesiones por semana", () => {
  const today = "2026-11-05"; // jueves; la semana empieza el 2026-11-02
  it("incluye semanas en cero y respeta lunes–domingo", () => {
    const w = weeklySessionCounts(
      [{ started_date: "2026-11-02" }, { started_date: "2026-11-05" }, { started_date: "2026-10-26" }, { started_date: "2026-10-04" }],
      today,
      3,
    );
    expect(w).toEqual([
      { weekStart: "2026-10-19", sessions: 0 },
      { weekStart: "2026-10-26", sessions: 1 },
      { weekStart: "2026-11-02", sessions: 2 },
    ]);
  });
  it("cuenta la semana actual hasta hoy", () => {
    expect(sessionsThisWeek([{ started_date: "2026-11-01" }, { started_date: "2026-11-03" }], today)).toBe(1);
  });
});

describe("exerciseProgress", () => {
  const today = "2026-11-30";
  it("agrupa por nombre normalizado y compara 30 vs 30 días previos", () => {
    expect(normalizeExerciseName("  Press   Bánca ")).toBe("press banca");
    const p = exerciseProgress(
      [
        { name: "Press banca", date: "2026-11-25", volume: 1200, maxWeight: 80 },
        { name: "press  banca", date: "2026-11-10", volume: 1300, maxWeight: 85 },
        { name: "Press banca", date: "2026-10-20", volume: 1000, maxWeight: 75 },
        { name: "Dominadas", date: "2026-11-02", volume: 0, maxWeight: null },
        { name: "Muy antiguo", date: "2026-08-01", volume: 500, maxWeight: 50 },
      ],
      today,
    );
    expect(p.map((x) => x.key)).toEqual(["press banca", "dominadas"]);
    expect(p[0]).toMatchObject({ sessions: 2, volume: 2500, previousVolume: 1000, maxWeight: 85, changePct: 150 });
    expect(p[0].name).toBe("Press banca"); // el escrito más recientemente
    expect(p[1]).toMatchObject({ sessions: 1, volume: 0, maxWeight: null, changePct: null });
  });
  it("no muestra ejercicios que solo existen en el periodo previo", () => {
    expect(exerciseProgress([{ name: "X", date: "2026-10-15", volume: 10, maxWeight: 1 }], today)).toEqual([]);
  });
  it("los límites de las ventanas son inclusivos", () => {
    const p = exerciseProgress(
      [
        { name: "A", date: "2026-11-01", volume: 1, maxWeight: null }, // hoy-29: reciente
        { name: "A", date: "2026-10-31", volume: 2, maxWeight: null }, // hoy-30: previo
        { name: "A", date: "2026-10-02", volume: 4, maxWeight: null }, // hoy-59: previo
        { name: "A", date: "2026-10-01", volume: 8, maxWeight: null }, // hoy-60: fuera
      ],
      today,
    );
    expect(p[0]).toMatchObject({ volume: 1, previousVolume: 6 });
  });
});

describe("validaciones", () => {
  it("sesión: opcionales vacíos → null", () => {
    const r = sessionInputSchema.parse({
      startedAt: "2026-11-05T07:00",
      type: "strength",
      durationMinutes: "",
      rpe: "",
      notes: "",
      routineId: "",
      routineDay: "",
    });
    expect(r).toMatchObject({ durationMinutes: null, rpe: null, notes: null, routineId: null, routineDay: null });
  });
  it("sesión: rechaza rangos y tipos", () => {
    const base = { startedAt: "2026-11-05T07:00", type: "strength", durationMinutes: "", rpe: "", notes: "", routineId: "", routineDay: "" };
    const bad = (o: object) => expect(sessionInputSchema.safeParse({ ...base, ...o }).success).toBe(false);
    bad({ type: "yoga" });
    bad({ rpe: "11" });
    bad({ rpe: "0" });
    bad({ durationMinutes: "1441" });
    bad({ durationMinutes: "30.5" });
    bad({ routineId: "no-uuid" });
    bad({ startedAt: "2026-11-05 07:00" });
  });
  it("series: peso vacío = corporal, 0 es dato, reps ≥ 1", () => {
    const ok = sessionExercisesSchema.parse([
      { name: " Dominadas ", notes: "", distance_km: "", duration_min: "", sets: [{ reps: "8", weight_kg: "" }, { reps: "6", weight_kg: "0" }, { reps: "5", weight_kg: "12.34" }] },
    ]);
    expect(ok[0].name).toBe("Dominadas");
    expect(ok[0].sets.map((s) => s.weight_kg)).toEqual([null, 0, 12.3]);
    const bad = (sets: object[]) =>
      expect(sessionExercisesSchema.safeParse([{ name: "X", notes: "", distance_km: "", duration_min: "", sets }]).success).toBe(false);
    bad([{ reps: "", weight_kg: "" }]);
    bad([{ reps: "0", weight_kg: "" }]);
    bad([{ reps: "5", weight_kg: "-1" }]);
    bad([{ reps: "5", weight_kg: "1001" }]);
    bad([{ reps: "5.5", weight_kg: "" }]);
  });
  it("ejercicio: nombre obligatorio y cardio opcional", () => {
    expect(sessionExercisesSchema.safeParse([{ name: " ", notes: "", distance_km: "", duration_min: "", sets: [] }]).success).toBe(false);
    const r = sessionExercisesSchema.parse([{ name: "Trote", notes: "", distance_km: "5.256", duration_min: "30", sets: [] }]);
    expect(r[0]).toMatchObject({ distance_km: 5.26, duration_min: 30 });
  });
  it("rutina: día 1–7, series 1–20", () => {
    const row = { day_of_week: "1", name: "Sentadilla", target_sets: "4", target_reps: "8", target_weight_kg: "", notes: "" };
    expect(routineExercisesSchema.parse([row])[0]).toMatchObject({ day_of_week: 1, target_sets: 4, target_weight_kg: null });
    for (const o of [{ day_of_week: "0" }, { day_of_week: "8" }, { target_sets: "21" }, { target_sets: "0" }, { target_reps: "" }]) {
      expect(routineExercisesSchema.safeParse([{ ...row, ...o }]).success).toBe(false);
    }
  });
  it("mes YYYY-MM → primer día", () => {
    expect(monthSchema.parse("2026-11")).toBe("2026-11-01");
    expect(monthSchema.safeParse("2026-13").success).toBe(false);
    expect(monthSchema.safeParse("2026-11-01").success).toBe(false);
  });
  it("parseJsonField", () => {
    expect(parseJsonField(null)).toEqual([]);
    expect(parseJsonField("")).toEqual([]);
    expect(parseJsonField("[1]")).toEqual([1]);
    expect(parseJsonField("{no")).toBeUndefined();
  });
});

describe("chunk", () => {
  it("chunk divide en lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
