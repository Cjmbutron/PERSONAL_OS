import { z } from "zod";
import { WORKOUT_TYPES } from "@/types/database";
import { emptyToNull, optionalText } from "./common";

/** Los límites replican los CHECK de la migración 6: la BD es la última defensa (RNF-07). */

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Fecha y hora no válidas" });

const round1 = (n: number) => Math.round(n * 10) / 10;

const optionalInt = (min: number, max: number) =>
  emptyToNull(
    z.coerce
      .number({ error: "Escribe un número" })
      .int({ error: "Debe ser un número entero" })
      .min(min, { error: `Entre ${min} y ${max}` })
      .max(max, { error: `Entre ${min} y ${max}` }),
  );

const optionalDecimal = (min: number, max: number, decimals: 1 | 2) =>
  emptyToNull(
    z.coerce
      .number({ error: "Escribe un número" })
      .min(min, { error: `Entre ${min} y ${max}` })
      .max(max, { error: `Entre ${min} y ${max}` })
      .transform((n) => (decimals === 1 ? round1(n) : Math.round(n * 100) / 100)),
  );

const name = z.string().trim().min(1, { error: "Escribe el nombre" }).max(120, { error: "Máximo 120 caracteres" });

// --- Sesión ------------------------------------------------------------------

const setSchema = z.object({
  reps: z.coerce.number({ error: "Repeticiones no válidas" }).int().min(1, { error: "Mínimo 1" }).max(1000),
  // null = peso corporal.
  weight_kg: optionalDecimal(0, 1000, 1),
});

const sessionExerciseSchema = z.object({
  name,
  notes: optionalText(500),
  distance_km: optionalDecimal(0, 1000, 2),
  duration_min: optionalInt(1, 1440),
  sets: z.array(setSchema).max(200, { error: "Máximo 200 series por ejercicio" }),
});

export const sessionExercisesSchema = z.array(sessionExerciseSchema).max(100, { error: "Máximo 100 ejercicios" });

export const sessionInputSchema = z.object({
  startedAt: localDateTime,
  type: z.enum(WORKOUT_TYPES, { error: "Tipo de entrenamiento no válido" }),
  durationMinutes: optionalInt(1, 1440),
  rpe: optionalInt(1, 10),
  notes: optionalText(1000),
  routineId: emptyToNull(z.uuid({ error: "Rutina no válida" })),
  routineDay: optionalInt(1, 7),
});

// --- Rutina ------------------------------------------------------------------

const routineExerciseSchema = z.object({
  day_of_week: z.coerce.number().int().min(1).max(7),
  name,
  target_sets: z.coerce.number({ error: "Series no válidas" }).int().min(1, { error: "Mínimo 1" }).max(20, { error: "Máximo 20" }),
  target_reps: z.coerce.number({ error: "Repeticiones no válidas" }).int().min(1, { error: "Mínimo 1" }).max(1000),
  target_weight_kg: optionalDecimal(0, 1000, 1),
  notes: optionalText(500),
});

export const routineExercisesSchema = z.array(routineExerciseSchema).max(500, { error: "Máximo 500 ejercicios" });

/** `periodMonth` llega de <input type="month"> como "YYYY-MM". */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Mes no válido" })
  .transform((v) => `${v}-01`);

export const routineInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre" }).max(100, { error: "Máximo 100 caracteres" }),
  description: optionalText(1000),
  periodMonth: monthSchema,
});

/** Mes de consulta (?month=YYYY-MM). */
export const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Interpreta el JSON de un campo oculto; devuelve undefined si no es JSON válido. */
export function parseJsonField(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
