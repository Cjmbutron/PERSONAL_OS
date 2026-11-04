"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validations/common";
import { idSchema, projectInputSchema, type ProjectInput } from "@/lib/validations/work";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";

function revalidateWork() {
  revalidatePath("/work/projects");
  revalidatePath("/work/tasks");
  revalidatePath("/dashboard");
}

function toColumns(input: ProjectInput) {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    due_date: input.dueDate,
    life_area_id: input.lifeAreaId,
  };
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = projectInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspace.id, ...toColumns(parsed.data) });

  if (error) return dbErrorToState(error, "createProject", values);

  revalidateWork();
  return { ok: true };
}

export async function updateProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el proyecto a editar.", { values });

  const parsed = projectInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(toColumns(parsed.data))
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "updateProject", values);
  if (!data?.length) return fail("El proyecto ya no existe o no tienes acceso a él.", { values });

  revalidateWork();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

export async function setProjectArchived(id: string, archived: boolean): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = archiveArgs.safeParse({ id, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: args.data.archived ? new Date().toISOString() : null })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return dbErrorToState(error, "setProjectArchived");
  if (!data?.length) return fail("El proyecto ya no existe.");

  revalidateWork();
  return { ok: true };
}
