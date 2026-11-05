"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateMealTime } from "@/lib/nutrition/stats";
import { localDateTimeToInstant } from "@/lib/utils/date";
import { formDataToObject } from "@/lib/validations/common";
import {
  parseJsonField,
  routineExercisesSchema,
  routineInputSchema,
  sessionExercisesSchema,
  sessionInputSchema,
} from "@/lib/validations/fitness";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateFitness() {
  revalidatePath("/fitness", "layout");
  revalidatePath("/dashboard");
}

const optionalId = z.preprocess((v) => (v === "" || v == null ? undefined : v), idSchema.optional());

function dbError(error: { code?: string; message: string }, context: string, values: Record<string, string>) {
  if (error.code === "23514") {
    return fail("Algún valor no cumple las reglas: sin fechas futuras y con cantidades dentro de rango.", { values });
  }
  if (error.code === "23505") {
    return fail("Ya existe una rutina para ese mes. Archívala o edítala.", { values });
  }
  if (error.code === "P0002") return fail("El registro ya no existe o no tienes acceso a él.", { values });
  return dbErrorToState(error, context, values);
}

/** Crea o edita un entrenamiento con sus ejercicios y series en una sola transacción (RPC). */
export async function saveWorkoutSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const rawId = formData.get("id");
  const id = optionalId.safeParse(rawId);
  if (!id.success) return fail("No se encontró el entrenamiento a editar.", { values });

  const parsed = sessionInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const rawExercises = parseJsonField(formData.get("exercisesJson"));
  if (rawExercises === undefined) return fail("No se pudieron leer los ejercicios.", { values });
  const exercises = sessionExercisesSchema.safeParse(rawExercises);
  if (!exercises.success) return fail("Revisa los ejercicios y las series: hay valores no válidos.", { values });

  const startedAt = localDateTimeToInstant(parsed.data.startedAt, profile.timezone);
  const problem = validateMealTime(startedAt);
  if (problem) return fail("Revisa los campos marcados.", { fieldErrors: { startedAt: [problem] }, values });

  // Los ejercicios cardio/movilidad pueden no tener series; los de fuerza sí deberían, pero no se exige.
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_workout_session", {
    p_workspace_id: workspace.id,
    p_id: id.data ?? null,
    p_routine_id: parsed.data.routineId,
    p_routine_day: parsed.data.routineId ? parsed.data.routineDay : null,
    p_started_at: startedAt.toISOString(),
    p_type: parsed.data.type,
    p_duration_minutes: parsed.data.durationMinutes,
    p_rpe: parsed.data.rpe,
    p_notes: parsed.data.notes,
    p_exercises: exercises.data,
  });
  if (error) return dbError(error, "saveWorkoutSession", values);

  revalidateFitness();
  return { ok: true };
}

/** Crea o edita la rutina de un mes con sus ejercicios por día de la semana. */
export async function saveWorkoutRoutine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalId.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la rutina a editar.", { values });

  const parsed = routineInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const rawExercises = parseJsonField(formData.get("exercisesJson"));
  if (rawExercises === undefined) return fail("No se pudieron leer los ejercicios.", { values });
  const exercises = routineExercisesSchema.safeParse(rawExercises);
  if (!exercises.success) return fail("Revisa los ejercicios: hay valores no válidos.", { values });

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_workout_routine", {
    p_workspace_id: workspace.id,
    p_id: id.data ?? null,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_period_month: parsed.data.periodMonth,
    p_exercises: exercises.data,
  });
  if (error) return dbError(error, "saveWorkoutRoutine", values);

  revalidateFitness();
  return { ok: true };
}

const duplicateArgs = z.object({ id: idSchema, targetMonth: z.string().regex(/^\d{4}-\d{2}-01$/) });

/** D-36: copia la rutina (con sus ejercicios) a otro mes. */
export async function duplicateRoutine(id: string, targetMonth: string): Promise<ActionState> {
  await getWorkspaceContext();
  const args = duplicateArgs.safeParse({ id, targetMonth });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("duplicate_workout_routine", {
    p_routine_id: args.data.id,
    p_target_month: args.data.targetMonth,
  });
  if (error) return dbError(error, "duplicateRoutine", {});

  revalidateFitness();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

async function setArchived(table: "workout_sessions" | "workout_routines", id: string, archived: boolean) {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbError(error, `setArchived:${table}`, {});
  if (!data?.length) return fail("El registro ya no existe.");

  revalidateFitness();
  return { ok: true } satisfies ActionState;
}

/** Archivado lógico y restauración (D-21). */
export async function setSessionArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("workout_sessions", id, archived);
}

export async function setRoutineArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("workout_routines", id, archived);
}
