"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateMealTime } from "@/lib/nutrition/stats";
import { localDateTimeToInstant } from "@/lib/utils/date";
import { formDataToObject } from "@/lib/validations/common";
import { mealInputSchema } from "@/lib/validations/nutrition";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateNutrition() {
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
}

/** Parsea el formulario y convierte la hora de pared a instante con la zona del perfil. */
function parse(formData: FormData, timezone: string, values: Record<string, string>) {
  const parsed = mealInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: failFromZod(parsed.error, values), columns: undefined };

  const eatenAt = localDateTimeToInstant(parsed.data.eatenAt, timezone);
  const problem = validateMealTime(eatenAt);
  if (problem) {
    return {
      error: fail("Revisa los campos marcados.", { fieldErrors: { eatenAt: [problem] }, values }),
      columns: undefined,
    };
  }

  return {
    error: undefined,
    columns: {
      meal_type: parsed.data.mealType,
      eaten_at: eatenAt.toISOString(),
      description: parsed.data.description,
      calories: parsed.data.calories,
      protein_g: parsed.data.proteinG,
      carbs_g: parsed.data.carbsG,
      fat_g: parsed.data.fatG,
    },
  };
}

function mealDbError(error: { code?: string; message: string }, context: string, values: Record<string, string>) {
  if (error.code === "23514") {
    return fail("Algún valor no cumple las reglas: sin fechas futuras y con cantidades dentro de rango.", { values });
  }
  return dbErrorToState(error, context, values);
}

export async function createMeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // El workspace sale de la sesión del servidor, nunca del formulario.
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const result = parse(formData, profile.timezone, values);
  if (result.error) return result.error;

  const supabase = await createClient();
  const { error } = await supabase.from("meal_logs").insert({ workspace_id: workspace.id, ...result.columns });
  if (error) return mealDbError(error, "createMeal", values);

  revalidateNutrition();
  return { ok: true };
}

export async function updateMeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la comida a editar.", { values });

  const result = parse(formData, profile.timezone, values);
  if (result.error) return result.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_logs")
    .update(result.columns)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return mealDbError(error, "updateMeal", values);
  if (!data?.length) return fail("La comida ya no existe o no tienes acceso a ella.", { values });

  revalidateNutrition();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

/** Archivado lógico y restauración (D-21). */
export async function setMealArchived(id: string, archived: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_logs")
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "setMealArchived");
  if (!data?.length) return fail("La comida ya no existe.");

  revalidateNutrition();
  return { ok: true };
}
