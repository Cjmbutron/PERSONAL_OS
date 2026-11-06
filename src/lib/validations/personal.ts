import { z } from "zod";
import { GOAL_STATUSES } from "@/types/database";
import { emptyToNull, optionalText } from "./common";

/** Los límites replican los CHECK de la migración 10 (RNF-07). */

const title = z.string().trim().min(1, { error: "Escribe un título" }).max(150, { error: "Máximo 150 caracteres" });
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Fecha y hora no válidas" });
const isoDate = z.iso.date({ error: "Fecha no válida" });

const eventCommon = {
  title,
  description: optionalText(2000),
  location: optionalText(200),
  lifeAreaId: emptyToNull(z.uuid({ error: "Dimensión no válida" })),
};

export const eventInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("timed"), ...eventCommon, startsAt: localDateTime, endsAt: localDateTime }),
  z.object({ kind: z.literal("allday"), ...eventCommon, startDate: isoDate, endDate: isoDate }),
]);

export const goalInputSchema = z.object({
  title,
  description: optionalText(2000),
  targetDate: emptyToNull(isoDate),
  lifeAreaId: emptyToNull(z.uuid({ error: "Dimensión no válida" })),
  manualProgress: z.coerce
    .number({ error: "Escribe un número" })
    .int({ error: "Debe ser un número entero" })
    .min(0, { error: "Entre 0 y 100" })
    .max(100, { error: "Entre 0 y 100" })
    .default(0),
});

export const goalStatusSchema = z.enum(GOAL_STATUSES, { error: "Estado no válido" });

export const milestoneTitleSchema = title;

// --- Revisión semanal (D-71 a D-78) -------------------------------------------------

/** Una fecha cualquiera: el servidor la normaliza al lunes de su semana. */
const weekParam = z.iso.date({ error: "Semana no válida" });

export const reviewInputSchema = z.object({
  week: weekParam,
  wentWell: optionalText(2000),
  toImprove: optionalText(2000),
  learnings: optionalText(2000),
  intent: z.enum(["draft", "complete"], { error: "Acción no válida" }),
});

/** `link` = "task:<uuid>" | "goal:<uuid>" | "" (D-74). Con vínculo, el título puede quedar vacío. */
export const priorityInputSchema = z
  .object({
    week: weekParam,
    title: optionalText(150),
    link: z
      .string()
      .regex(/^((task|goal):[0-9a-f-]{36})?$/i, { error: "Vínculo no válido" })
      .default(""),
  })
  .refine((v) => v.title !== null || v.link !== "", { error: "Escribe la prioridad o elige una tarea u objetivo", path: ["title"] });

export function parseLink(link: string): { kind: "task" | "goal"; id: string } | null {
  const [kind, id] = link.split(":");
  return (kind === "task" || kind === "goal") && id ? { kind, id } : null;
}
