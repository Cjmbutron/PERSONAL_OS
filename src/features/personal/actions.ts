"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateEventRange } from "@/lib/personal/calendar";
import { localDateTimeToInstant } from "@/lib/utils/date";
import { formDataToObject, optionalUuid } from "@/lib/validations/common";
import { eventInputSchema, goalInputSchema, goalStatusSchema, milestoneTitleSchema } from "@/lib/validations/personal";
import { idSchema } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidatePersonal() {
  revalidatePath("/personal", "layout");
  revalidatePath("/dashboard");
}

function dbError(error: { code?: string; message: string }, context: string, values?: Record<string, string>) {
  if (error.code === "23514" && /50 hitos/.test(error.message)) return fail("Un objetivo admite como máximo 50 hitos.", { values });
  if (error.code === "23514") {
    return fail("Revisa las fechas y los textos: algún valor no cumple las reglas.", { values });
  }
  return dbErrorToState(error, context, values);
}

/** Crea o edita un evento (con hora o de todo el día). */
export async function saveEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el evento a editar.", { values });

  const parsed = eventInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const e = parsed.data;

  // Los campos del otro tipo se limpian para cumplir el CHECK (D-57).
  let shape: {
    all_day: boolean;
    starts_at: string | null;
    ends_at: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  let problem: string | null;
  if (e.kind === "allday") {
    problem = validateEventRange({ allDay: true, startDate: e.startDate, endDate: e.endDate });
    shape = { all_day: true, starts_at: null, ends_at: null, start_date: e.startDate, end_date: e.endDate };
  } else {
    const startsAt = localDateTimeToInstant(e.startsAt, profile.timezone);
    const endsAt = localDateTimeToInstant(e.endsAt, profile.timezone);
    problem = validateEventRange({ allDay: false, startsAt, endsAt });
    shape = {
      all_day: false,
      starts_at: Number.isNaN(startsAt.getTime()) ? null : startsAt.toISOString(),
      ends_at: Number.isNaN(endsAt.getTime()) ? null : endsAt.toISOString(),
      start_date: null,
      end_date: null,
    };
  }
  if (problem) {
    const field = e.kind === "allday" ? "endDate" : "endsAt";
    return fail("Revisa los campos marcados.", { fieldErrors: { [field]: [problem] }, values });
  }

  const common = { title: e.title, description: e.description, location: e.location, life_area_id: e.lifeAreaId };
  const supabase = await createClient();

  if (id.data) {
    const { data, error } = await supabase
      .from("calendar_events")
      .update({ ...common, ...shape })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return dbError(error, "saveEvent:update", values);
    if (!data?.length) return fail("El evento ya no existe o no tienes acceso a él.", { values });
  } else {
    const { error } = await supabase.from("calendar_events").insert({ workspace_id: workspace.id, ...common, ...shape });
    if (error) return dbError(error, "saveEvent:insert", values);
  }

  revalidatePersonal();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

async function setArchived(table: "calendar_events" | "goals", id: string, archived: boolean, label: string): Promise<ActionState> {
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
  if (error) return dbErrorToState(error, `setArchived:${table}`);
  if (!data?.length) return fail(`${label} ya no existe o no tienes acceso.`);
  revalidatePersonal();
  return { ok: true };
}

export async function setEventArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("calendar_events", id, archived, "El evento");
}

export async function setGoalArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("goals", id, archived, "El objetivo");
}

/** Crea o edita un objetivo (sin tocar su estado). */
export async function saveGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el objetivo a editar.", { values });

  const parsed = goalInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const g = parsed.data;

  const supabase = await createClient();
  const common = { title: g.title, description: g.description, target_date: g.targetDate, life_area_id: g.lifeAreaId };

  if (id.data) {
    const hasField = formData.has("manualProgress");
    const { data, error } = await supabase
      .from("goals")
      .update(hasField ? { ...common, manual_progress: g.manualProgress } : common)
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return dbError(error, "saveGoal:update", values);
    if (!data?.length) return fail("El objetivo ya no existe o no tienes acceso a él.", { values });
  } else {
    const { error } = await supabase
      .from("goals")
      .insert({ workspace_id: workspace.id, ...common, manual_progress: g.manualProgress });
    if (error) return dbError(error, "saveGoal:insert", values);
  }

  revalidatePersonal();
  return { ok: true };
}

const statusArgs = z.object({ id: idSchema, status: goalStatusSchema });

/** Cambia el estado de un objetivo (completar, pausar, cancelar, reactivar). */
export async function setGoalStatus(id: string, status: string): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = statusArgs.safeParse({ id, status });
  if (!args.success) return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status: args.data.status })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error) return dbErrorToState(error, "setGoalStatus");
  if (!data?.length) return fail("El objetivo ya no existe o no tienes acceso.");
  revalidatePersonal();
  return { ok: true };
}

/** Añade un hito al final de la lista del objetivo. */
export async function addMilestone(goalId: string, title: string): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const gid = idSchema.safeParse(goalId);
  const t = milestoneTitleSchema.safeParse(title);
  if (!gid.success) return fail("Objetivo no válido.");
  if (!t.success) return fail(t.error.issues[0]?.message ?? "Título no válido.");

  const supabase = await createClient();
  const { data: last, error: lastError } = await supabase
    .from("goal_milestones")
    .select("position")
    .eq("workspace_id", workspace.id)
    .eq("goal_id", gid.data)
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) return dbErrorToState(lastError, "addMilestone:position");

  const position = (last?.[0]?.position ?? -1) + 1;
  const { error } = await supabase
    .from("goal_milestones")
    .insert({ workspace_id: workspace.id, goal_id: gid.data, position, title: t.data });
  if (error) return dbError(error, "addMilestone:insert");

  revalidatePersonal();
  return { ok: true };
}

export async function setMilestoneDone(id: string, done: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const mid = idSchema.safeParse(id);
  if (!mid.success || typeof done !== "boolean") return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_milestones")
    .update({ done })
    .eq("id", mid.data)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error) return dbErrorToState(error, "setMilestoneDone");
  if (!data?.length) return fail("El hito ya no existe.");
  revalidatePersonal();
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const mid = idSchema.safeParse(id);
  if (!mid.success) return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { error } = await supabase.from("goal_milestones").delete().eq("id", mid.data).eq("workspace_id", workspace.id);
  if (error) return dbErrorToState(error, "deleteMilestone");
  revalidatePersonal();
  return { ok: true };
}
