import { describe, expect, it } from "vitest";
import {
  formatGrams,
  formatKcal,
  groupTotalsByDate,
  sumNutrients,
  suggestMealType,
  validateMealTime,
} from "@/lib/nutrition/stats";
import { dateParamSchema, mealInputSchema } from "@/lib/validations/nutrition";

const meal = (
  calories: number | null,
  protein_g: number | null = null,
  carbs_g: number | null = null,
  fat_g: number | null = null,
  eaten_date = "2026-11-04",
) => ({ calories, protein_g, carbs_g, fat_g, eaten_date });

describe("sumNutrients (D-30: sin dato ≠ 0)", () => {
  it("sin comidas: 0 comidas y ningún nutriente", () => {
    expect(sumNutrients([])).toEqual({ meals: 0, calories: null, protein: null, carbs: null, fat: null });
  });

  it("suma solo lo informado y deja null lo que nadie informó", () => {
    const t = sumNutrients([meal(500, 30), meal(null, 12.5), meal(300, null, 40)]);
    expect(t).toEqual({ meals: 3, calories: 800, protein: 42.5, carbs: 40, fat: null });
  });

  it("un 0 informado cuenta como dato (no es null)", () => {
    expect(sumNutrients([meal(0, 0, 0, 0)])).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("evita errores de coma flotante", () => {
    expect(sumNutrients([meal(null, 0.1), meal(null, 0.2)]).protein).toBe(0.3);
  });
});

describe("groupTotalsByDate", () => {
  it("agrupa por día local", () => {
    const m = groupTotalsByDate([
      meal(400, null, null, null, "2026-11-04"),
      meal(600, null, null, null, "2026-11-04"),
      meal(250, null, null, null, "2026-11-03"),
    ]);
    expect(m.get("2026-11-04")).toMatchObject({ meals: 2, calories: 1000 });
    expect(m.get("2026-11-03")).toMatchObject({ meals: 1, calories: 250 });
    expect(m.has("2026-11-02")).toBe(false);
  });
});

describe("formato y reglas", () => {
  it("formatea gramos con coma decimal y calorías con separador de miles", () => {
    expect(formatGrams(35)).toBe("35 g");
    expect(formatGrams(35.5)).toBe("35,5 g");
    expect(formatKcal(650)).toMatch(/^650 kcal$/);
    expect(formatKcal(1234)).toMatch(/^1\D?234 kcal$/);
  });

  it("rechaza el futuro con 5 minutos de tolerancia", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    expect(validateMealTime(new Date("2026-11-04T11:00:00Z"), now)).toBeNull();
    expect(validateMealTime(new Date("2026-11-04T12:04:00Z"), now)).toBeNull();
    expect(validateMealTime(new Date("2026-11-04T12:06:00Z"), now)).toMatch(/futuro/);
    expect(validateMealTime(new Date(Number.NaN), now)).toMatch(/no válidas/);
  });

  it("sugiere el tipo de comida según la hora", () => {
    expect(suggestMealType(7)).toBe("breakfast");
    expect(suggestMealType(13)).toBe("lunch");
    expect(suggestMealType(17)).toBe("snack");
    expect(suggestMealType(21)).toBe("dinner");
    expect(suggestMealType(0)).toBe("breakfast");
  });
});

describe("mealInputSchema", () => {
  const base = {
    mealType: "lunch",
    eatenAt: "2026-11-04T13:00",
    description: "  Arroz con pollo ",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
  };

  it("normaliza: vacíos → null, texto recortado", () => {
    expect(mealInputSchema.parse(base)).toMatchObject({
      description: "Arroz con pollo",
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it("conserva el 0 como dato y redondea gramos a un decimal", () => {
    const r = mealInputSchema.parse({ ...base, calories: "0", proteinG: "12.34", carbsG: "0", fatG: "7.05" });
    expect(r.calories).toBe(0);
    expect(r.proteinG).toBe(12.3);
    expect(r.carbsG).toBe(0);
  });

  it("rechaza rangos, decimales en calorías y texto", () => {
    const bad = (over: object) => expect(mealInputSchema.safeParse({ ...base, ...over }).success).toBe(false);
    bad({ calories: "-1" });
    bad({ calories: "10001" });
    bad({ calories: "500.5" });
    bad({ proteinG: "2000.1" });
    bad({ fatG: "abc" });
    bad({ mealType: "brunch" });
    bad({ description: "   " });
    bad({ description: "x".repeat(501) });
    bad({ eatenAt: "2026-11-04 13:00" });
  });

  it("acepta los extremos", () => {
    expect(mealInputSchema.safeParse({ ...base, calories: "10000", proteinG: "2000", carbsG: "0", fatG: "2000" }).success).toBe(true);
  });
});

describe("dateParamSchema", () => {
  it("valida YYYY-MM-DD", () => {
    expect(dateParamSchema.safeParse("2026-11-04").success).toBe(true);
    expect(dateParamSchema.safeParse("04/11/2026").success).toBe(false);
    expect(dateParamSchema.safeParse("2026-13-40").success).toBe(false);
    expect(dateParamSchema.safeParse(undefined).success).toBe(false);
  });
});
