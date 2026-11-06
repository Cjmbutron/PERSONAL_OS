"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/utils/date";
import { canReviewWeek, normalizeWeek } from "@/lib/personal/weekly";
import { formDataToObject } from "@/lib/validations/common";
import { parseLink, priorityInputSchema, reviewInputSchema } from "@/lib/validations/personal";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateReview() {
  revalidatePath("/review");
  revalidatePath("/dashboard");
}

function dbError(error: { code?: string; message: string }, context: string, values?: Record<string, string>) {
  if (error.code === "23514" && /máximo 5/.test(error.message)) return fail("Una semana admite como máximo 5 prioridades.", { values });
  if (error.code === "23514" && /aún no empieza/.test(error.message)) return fail("No se puede revisar una semana que aún no empieza.", { values });
  if (error.code === "23503") return fail("La tarea u objetivo elegido ya no existe.", { values });
  return dbErrorToState(error, context, values);
}

/** Guarda la revisión de una semana (borrador o completada). Crea o actualiza (sin upsert, D-33). */
export async function saveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = reviewInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const week = normalizeWeek(parsed.data.week);
  if (!week || !canReviewWeek(week, todayIn(profile.timezone))) return fail("No se puede revisar una semana que aún no empieza.", { values });

  const fields = {
    status: parsed.data.intent === "complete" ? ("completed" as const) : ("draft" as const),
    went_well: parsed.data.wentWell,
    to_improve: parsed.data.toImprove,
    learnings: parsed.data.learnings,
  };
  const supabase = await createClient();

  const { data: updated, error: updateError } = await supabase
    .from("weekly_reviews")
    .update(fields)
    .eq("workspace_id", workspace.id)
    .eq("week_start", week)
    .select("id");
  if (updateError) return dbError(updateError, "saveReview:update", values);

  if (!updated?.length) {
    const { error } = await supabase.from("weekly_reviews").insert({ workspace_id: workspace.id, week_start: week, ...fields });
    if (error) return dbError(error, "saveReview:insert", values);
  }

  revalidateReview();
  return { ok: true, message: parsed.data.intent === "complete" ? "Revisión completada." : "Borrador guardado." };
}

/** Añade una prioridad a la semana `week` (la que se planifica), con texto libre y/o vínculo. */
export async function addPriority(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = priorityInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const week = normalizeWeek(parsed.data.week);
  if (!week) return fail("Semana no válida.", { values });

  const link = parseLink(parsed.data.link);
  const supabase = await createClient();

  // Si hay vínculo y no hay texto, el título se toma del elemento vinculado.
  let title = parsed.data.title;
  if (link && !title) {
    const { data, error } = await supabase
      .from(link.kind === "task" ? "tasks" : "goals")
      .select("title")
      .eq("workspace_id", workspace.id)
      .eq("id", link.id)
      .maybeSingle();
    if (error) return dbError(error, "addPriority:title", values);
    if (!data) return fail("La tarea u objetivo elegido ya no existe.", { values });
    title = data.title;
  }

  const { data: last, error: lastError } = await supabase
    .from("weekly_priorities")
    .select("position")
    .eq("workspace_id", workspace.id)
    .eq("week_start", week)
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) return dbError(lastError, "addPriority:position", values);

  const { error } = await supabase.from("weekly_priorities").insert({
    workspace_id: workspace.id,
    week_start: week,
    position: (last?.[0]?.position ?? -1) + 1,
    title: (title as string).slice(0, 150),
    task_id: link?.kind === "task" ? link.id : null,
    goal_id: link?.kind === "goal" ? link.id : null,
  });
  if (error) return dbError(error, "addPriority:insert", values);

  revalidateReview();
  return { ok: true };
}

export async function setPriorityDone(id: string, done: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const pid = idSchema.safeParse(id);
  if (!pid.success || typeof done !== "boolean") return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_priorities").update({ done }).eq("id", pid.data).eq("workspace_id", workspace.id).select("id");
  if (error) return dbErrorToState(error, "setPriorityDone");
  if (!data?.length) return fail("La prioridad ya no existe.");
  revalidateReview();
  return { ok: true };
}

const deleteArgs = z.object({ id: idSchema });

export async function deletePriority(id: string): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = deleteArgs.safeParse({ id });
  if (!args.success) return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_priorities").delete().eq("id", args.data.id).eq("workspace_id", workspace.id);
  if (error) return dbErrorToState(error, "deletePriority");
  revalidateReview();
  return { ok: true };
}
