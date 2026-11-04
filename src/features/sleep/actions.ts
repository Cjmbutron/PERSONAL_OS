"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateSleepWindow } from "@/lib/sleep/stats";
import { localDateTimeToInstant } from "@/lib/utils/date";
import { formDataToObject } from "@/lib/validations/common";
import { sleepGoalSchema, sleepInputSchema } from "@/lib/validations/sleep";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateSleep() {
  revalidatePath("/sleep");
  revalidatePath("/dashboard");
}

/** Traduce los errores propios del módulo; el resto va al traductor genérico. */
function sleepDbError(error: { code?: string; message: string }, context: string, values: Record<string, string>) {
  switch (error.code) {
    case "23P01": // exclusion_violation: solapamiento (D-27)
      return fail("Ese horario se solapa con otro registro de sueño.", {
        fieldErrors: { bedtime: ["Se solapa con otro registro"] },
        values,
      });
    case "23505": // unique_violation: una noche por día de despertar (D-26)
      return fail("Ya tienes un registro de sueño para ese día de despertar.", {
        fieldErrors: { wakeTime: ["Ya hay un registro que despierta ese día"] },
        values,
      });
    case "23514":
      return fail("Las horas no cumplen las reglas: despertar posterior, entre 1 y 16 horas y sin fechas futuras.", { values });
    default:
      return dbErrorToState(error, context, values);
  }
}

/** Parsea el formulario y convierte las horas de pared a instantes con la zona del perfil. */
function parse(formData: FormData, timezone: string, values: Record<string, string>) {
  const parsed = sleepInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: failFromZod(parsed.error, values), columns: undefined };

  const bedtime = localDateTimeToInstant(parsed.data.bedtime, timezone);
  const wakeTime = localDateTimeToInstant(parsed.data.wakeTime, timezone);
  const problem = validateSleepWindow(bedtime, wakeTime);
  if (problem) {
    return {
      error: fail("Revisa los campos marcados.", { fieldErrors: { [problem.field]: [problem.message] }, values }),
      columns: undefined,
    };
  }

  return {
    error: undefined,
    columns: {
      bedtime: bedtime.toISOString(),
      wake_time: wakeTime.toISOString(),
      quality: parsed.data.quality,
      notes: parsed.data.notes,
    },
  };
}

export async function createSleepRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const result = parse(formData, profile.timezone, values);
  if (result.error) return result.error;

  const supabase = await createClient();
  const { error } = await supabase.from("sleep_records").insert({ workspace_id: workspace.id, ...result.columns });
  if (error) return sleepDbError(error, "createSleepRecord", values);

  revalidateSleep();
  return { ok: true };
}

export async function updateSleepRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el registro a editar.", { values });

  const result = parse(formData, profile.timezone, values);
  if (result.error) return result.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sleep_records")
    .update(result.columns)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return sleepDbError(error, "updateSleepRecord", values);
  if (!data?.length) return fail("El registro ya no existe o no tienes acceso a él.", { values });

  revalidateSleep();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

/** Archivado lógico y restauración (D-21). Al restaurar, la BD revalida solapamiento y unicidad. */
export async function setSleepRecordArchived(id: string, archived: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sleep_records")
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) {
    if (error.code === "23P01" || error.code === "23505") {
      return fail("No se puede restaurar: ya hay otro registro de sueño en ese horario o día.");
    }
    return dbErrorToState(error, "setSleepRecordArchived");
  }
  if (!data?.length) return fail("El registro ya no existe.");

  revalidateSleep();
  return { ok: true };
}

/** Meta de sueño del perfil (D-28). El id sale de la sesión, no del formulario. */
export async function updateSleepGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = sleepGoalSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ sleep_goal_hours: parsed.data.goalHours })
    .eq("id", userId)
    .select("id");

  if (error) return dbErrorToState(error, "updateSleepGoal", values);
  if (!data?.length) return fail("No se pudo guardar la meta.", { values });

  revalidateSleep();
  return { ok: true, message: "Meta guardada." };
}
