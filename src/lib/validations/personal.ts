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
