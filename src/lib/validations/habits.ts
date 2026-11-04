import { z } from "zod";
import { HABIT_FREQUENCIES } from "@/types/database";
import { optionalText, optionalUuid } from "./common";

/** Los límites replican los CHECK de la migración 3: la BD es la última defensa (RNF-07). */

const optionalWeeklyTarget = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().int({ error: "Número entero" }).min(1, { error: "Entre 1 y 7" }).max(7, { error: "Entre 1 y 7" }).nullable(),
);

export const habitInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Escribe un nombre" })
      .max(100, { error: "Máximo 100 caracteres" }),
    description: optionalText(1000),
    lifeAreaId: optionalUuid,
    frequencyType: z.enum(HABIT_FREQUENCIES, { error: "Frecuencia no válida" }),
    daysOfWeek: z.array(z.coerce.number().int().min(1).max(7)).default([]),
    targetPerWeek: optionalWeeklyTarget,
  })
  .superRefine((v, ctx) => {
    if (v.frequencyType === "days_of_week" && v.daysOfWeek.length === 0) {
      ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Elige al menos un día" });
    }
    if (v.frequencyType === "times_per_week" && v.targetPerWeek === null) {
      ctx.addIssue({ code: "custom", path: ["targetPerWeek"], message: "Indica cuántas veces por semana" });
    }
  });

export type HabitInput = z.infer<typeof habitInputSchema>;

/** Argumentos de setHabitLog: vienen del cliente, se validan en el servidor. */
export const habitLogArgsSchema = z.object({
  habitId: z.uuid({ error: "Identificador no válido" }),
  date: z.iso.date({ error: "Fecha no válida" }),
  completed: z.boolean(),
});
