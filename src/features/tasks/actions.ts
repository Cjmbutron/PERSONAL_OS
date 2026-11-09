"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validations/common";
import { idSchema, taskInputSchema, type TaskInput } from "@/lib/validations/work";
import { TASK_STATUSES, type TaskStatus } from "@/types/database";
import { z } from "zod";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateWork() {
  revalidatePath("/work/tasks");
  revalidatePath("/work/projects");
  revalidatePath("/dashboard");
  revalidatePath("/notices");
}

function toColumns(input: TaskInput) {
  return {
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    due_date: input.dueDate,
    project_id: input.projectId,
    life_area_id: input.lifeAreaId,
    recurrence: input.recurrence,
  };
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // La sesión y el workspace salen del servidor: el formulario nunca decide a quién pertenece el dato.
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = taskInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert({ workspace_id: workspace.id, ...toColumns(parsed.data) });

  if (error) return dbErrorToState(error, "createTask", values);

  revalidateWork();
  return { ok: true };
}

export async function updateTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la tarea a editar.", { values });

  const parsed = taskInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(toColumns(parsed.data))
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "updateTask", values);
  if (!data?.length) return fail("La tarea ya no existe o no tienes acceso a ella.", { values });

  revalidateWork();
  return { ok: true };
}

const statusArgs = z.object({ id: idSchema, status: z.enum(TASK_STATUSES) });

/** Cambio rápido de estado (casilla de completar). Argumentos validados: vienen del cliente. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = statusArgs.safeParse({ id, status });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();

  // Completar pasa por la función transaccional: si la tarea se repite, crea la siguiente (D-94).
  if (args.data.status === "completed") {
    const { data: nextId, error } = await supabase.rpc("complete_task", { p_task_id: args.data.id });
    if (error) return dbErrorToState(error, "completeTask");
    revalidateWork();
    revalidatePath("/notices");
    return { ok: true, message: nextId ? "Tarea completada. Creé la siguiente de la serie." : undefined };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: args.data.status })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "setTaskStatus");
  if (!data?.length) return fail("La tarea ya no existe.");

  revalidateWork();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

/** Archivado lógico y restauración (DEC-004, D-02). No existe eliminación física desde la aplicación. */
export async function setTaskArchived(id: string, archived: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "setTaskArchived");
  if (!data?.length) return fail("La tarea ya no existe.");

  revalidateWork();
  return { ok: true };
}
