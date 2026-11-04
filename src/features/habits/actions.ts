"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validations/common";
import { habitInputSchema, habitLogArgsSchema, type HabitInput } from "@/lib/validations/habits";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateHabits() {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

function parseInput(formData: FormData) {
  // Los días llegan como varias entradas con el mismo nombre: formDataToObject solo conserva una.
  return habitInputSchema.safeParse({
    ...formDataToObject(formData),
    daysOfWeek: formData.getAll("daysOfWeek"),
  });
}

/** Los campos de frecuencia que no aplican al tipo elegido se guardan como NULL (CHECK de la BD, D-16). */
function toColumns(input: HabitInput) {
  return {
    name: input.name,
    description: input.description,
    life_area_id: input.lifeAreaId,
    frequency_type: input.frequencyType,
    days_of_week:
      input.frequencyType === "days_of_week" ? [...new Set(input.daysOfWeek)].sort((a, b) => a - b) : null,
    target_per_week: input.frequencyType === "times_per_week" ? input.targetPerWeek : null,
  };
}

export async function createHabit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // El workspace sale de la sesión del servidor, nunca del formulario.
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = parseInput(formData);
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .insert({ workspace_id: workspace.id, ...toColumns(parsed.data) });

  if (error) return dbErrorToState(error, "createHabit", values);

  revalidateHabits();
  return { ok: true };
}

export async function updateHabit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el hábito a editar.", { values });

  const parsed = parseInput(formData);
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .update(toColumns(parsed.data))
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "updateHabit", values);
  if (!data?.length) return fail("El hábito ya no existe o no tienes acceso a él.", { values });

  revalidateHabits();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

/** Archivado lógico y restauración (DEC-004, D-20). El historial de registros se conserva. */
export async function setHabitArchived(id: string, archived: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "setHabitArchived");
  if (!data?.length) return fail("El hábito ya no existe.");

  revalidateHabits();
  return { ok: true };
}

/**
 * Marca o desmarca el cumplimiento de un día (D-17). Una fila por hábito y fecha: deshacer
 * es `completed = false`, no un borrado. La BD rechaza fechas futuras y hábitos ajenos.
 */
export async function setHabitLog(habitId: string, date: string, completed: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = habitLogArgsSchema.safeParse({ habitId, date, completed });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { error } = await supabase.from("habit_logs").upsert(
    {
      workspace_id: workspace.id,
      habit_id: args.data.habitId,
      log_date: args.data.date,
      completed: args.data.completed,
    },
    { onConflict: "habit_id,log_date" },
  );

  if (error) {
    if (error.code === "23514") return fail("No puedes registrar fechas futuras.");
    if (error.code === "23503") return fail("El hábito ya no existe.");
    return dbErrorToState(error, "setHabitLog");
  }

  revalidateHabits();
  return { ok: true };
}
