import type { MealLogRow, MealType } from "@/types/database";

/** Tolerancia por desfase de reloj, igual que el trigger de la base de datos. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

type NutrientFields = Pick<MealLogRow, "calories" | "protein_g" | "carbs_g" | "fat_g">;

export type NutrientTotals = {
  meals: number;
  /** `null` si ninguna comida informó ese dato: "sin datos" no es lo mismo que 0 (D-30). */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : round1(present.reduce((a, b) => a + b, 0));
}

/** Suma solo lo registrado. Las comidas sin datos cuentan como comida, pero no suman nutrientes. */
export function sumNutrients(meals: readonly NutrientFields[]): NutrientTotals {
  return {
    meals: meals.length,
    calories: sumOrNull(meals.map((m) => m.calories)),
    protein: sumOrNull(meals.map((m) => m.protein_g)),
    carbs: sumOrNull(meals.map((m) => m.carbs_g)),
    fat: sumOrNull(meals.map((m) => m.fat_g)),
  };
}

export function groupTotalsByDate(meals: readonly (NutrientFields & { eaten_date: string })[]): Map<string, NutrientTotals> {
  const byDate = new Map<string, (NutrientFields & { eaten_date: string })[]>();
  for (const m of meals) {
    const list = byDate.get(m.eaten_date) ?? [];
    list.push(m);
    byDate.set(m.eaten_date, list);
  }
  return new Map([...byDate].map(([date, list]) => [date, sumNutrients(list)]));
}

/** 35 → "35 g" · 35.5 → "35,5 g" (coma decimal, es-BO). */
export function formatGrams(n: number): string {
  return `${String(n).replace(".", ",")} g`;
}

export function formatKcal(n: number): string {
  return `${Math.round(n).toLocaleString("es-BO")} kcal`;
}

/** Mismas reglas que el trigger de la base de datos, para dar el mensaje junto al campo. */
export function validateMealTime(eatenAt: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(eatenAt.getTime())) return "Fecha y hora no válidas";
  if (eatenAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return "No puede estar en el futuro";
  return null;
}

/** Tipo de comida sugerido según la hora local (0–23). Solo es un valor inicial del formulario. */
export function suggestMealType(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 20) return "snack";
  return "dinner";
}
