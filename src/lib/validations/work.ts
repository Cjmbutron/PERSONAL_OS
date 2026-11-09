import { z } from "zod";
import { PRIORITIES, PROJECT_STATUSES, TASK_RECURRENCES, TASK_STATUSES } from "@/types/database";
import { optionalDate, optionalText, optionalUuid } from "./common";

/** Los límites replican los CHECK de PostgreSQL (migración 2): la BD es la última defensa (RNF-07). */

export const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Escribe un título" })
    .max(200, { error: "Máximo 200 caracteres" }),
  description: optionalText(4000),
  status: z.enum(TASK_STATUSES, { error: "Estado no válido" }).default("pending"),
  priority: z.enum(PRIORITIES, { error: "Prioridad no válida" }).default("medium"),
  dueDate: optionalDate,
  projectId: optionalUuid,
  lifeAreaId: optionalUuid,
  recurrence: z
    .enum(TASK_RECURRENCES)
    .nullable()
    .catch(null)
    .default(null),
}).refine((t) => !t.recurrence || t.dueDate, {
  path: ["dueDate"],
  error: "Una tarea que se repite necesita fecha de vencimiento",
});

export const projectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Escribe un nombre" })
    .max(120, { error: "Máximo 120 caracteres" }),
  description: optionalText(2000),
  status: z.enum(PROJECT_STATUSES, { error: "Estado no válido" }).default("active"),
  dueDate: optionalDate,
  lifeAreaId: optionalUuid,
});

export const idSchema = z.uuid({ error: "Identificador no válido" });

export type TaskInput = z.infer<typeof taskInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;

/** Filtros de la lista de tareas, leídos de la URL. Cualquier valor inválido cae al valor por defecto. */
export const taskFiltersSchema = z.object({
  status: z.enum(["open", "all", ...TASK_STATUSES]).catch("open"),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  project: z.union([z.literal("none"), z.uuid()]).optional().catch(undefined),
  archived: z
    .enum(["1"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;
