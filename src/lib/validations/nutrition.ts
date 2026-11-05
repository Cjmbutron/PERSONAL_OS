import { z } from "zod";
import { MEAL_TYPES } from "@/types/database";
import { emptyToNull } from "./common";

/** Los límites replican los CHECK de la migración 5: la BD es la última defensa (RNF-07). */

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Fecha y hora no válidas" });

/** Número opcional dentro de un rango. "" → null (sin dato), que es distinto de 0. */
const optionalNumber = (min: number, max: number, opts: { int?: boolean } = {}) =>
  emptyToNull(
    (opts.int
      ? z.coerce.number({ error: "Escribe un número" }).int({ error: "Debe ser un número entero" })
      : z.coerce.number({ error: "Escribe un número" })
    )
      .min(min, { error: `Entre ${min} y ${max}` })
      .max(max, { error: `Entre ${min} y ${max}` })
      .transform((n) => (opts.int ? n : Math.round(n * 10) / 10)),
  );

export const mealInputSchema = z.object({
  mealType: z.enum(MEAL_TYPES, { error: "Tipo de comida no válido" }),
  eatenAt: localDateTime,
  description: z
    .string()
    .trim()
    .min(1, { error: "Describe qué comiste" })
    .max(500, { error: "Máximo 500 caracteres" }),
  calories: optionalNumber(0, 10000, { int: true }),
  proteinG: optionalNumber(0, 2000),
  carbsG: optionalNumber(0, 2000),
  fatG: optionalNumber(0, 2000),
});

export type MealInput = z.infer<typeof mealInputSchema>;

/** Fecha de consulta (?date=) con valor por defecto si es inválida. */
export const dateParamSchema = z.iso.date();
