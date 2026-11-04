import { z } from "zod";
import { emptyToNull, optionalText } from "./common";

/**
 * Las horas llegan como hora de pared ("2026-11-04T07:00") de un `datetime-local`.
 * La conversión a instante usa la zona del perfil y la hace el servidor; las reglas de
 * negocio (orden, duración, futuro) están en `validateSleepWindow` y en la base de datos.
 */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Fecha y hora no válidas" });

export const sleepInputSchema = z.object({
  bedtime: localDateTime,
  wakeTime: localDateTime,
  quality: emptyToNull(
    z.coerce.number().int({ error: "Valor no válido" }).min(1, { error: "Entre 1 y 5" }).max(5, { error: "Entre 1 y 5" }),
  ),
  notes: optionalText(1000),
});

export type SleepInput = z.infer<typeof sleepInputSchema>;

/** Meta de sueño en horas, con un decimal (D-28: entre 4 y 12). */
export const sleepGoalSchema = z.object({
  goalHours: z.coerce
    .number({ error: "Escribe un número" })
    .min(4, { error: "Entre 4 y 12 horas" })
    .max(12, { error: "Entre 4 y 12 horas" })
    .transform((n) => Math.round(n * 10) / 10),
});
