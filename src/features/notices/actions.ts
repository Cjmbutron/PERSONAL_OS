"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToState, fail, type ActionState } from "@/lib/actions";

const keys = z.array(z.string().min(1).max(200)).min(1).max(100);
const stateSchema = z.enum(["read", "dismissed"]);

/**
 * Guarda el estado de uno o varios avisos. Sin upsert de PostgREST: se actualiza lo que existe
 * y se inserta lo que falta. Un descartado nunca vuelve a "leído" por una marca masiva.
 */
async function setStates(rawKeys: string[], rawState: "read" | "dismissed"): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const parsedKeys = keys.safeParse([...new Set(rawKeys)]);
  const state = stateSchema.safeParse(rawState);
  if (!parsedKeys.success || !state.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const existing = await supabase
    .from("notice_states")
    .select("notice_key, state")
    .eq("workspace_id", workspace.id)
    .in("notice_key", parsedKeys.data);
  if (existing.error) return dbErrorToState(existing.error, "setNoticeStates.read");

  const current = new Map((existing.data ?? []).map((r) => [r.notice_key, r.state]));
  const toInsert = parsedKeys.data.filter((k) => !current.has(k));
  const toUpdate = parsedKeys.data.filter((k) => current.has(k) && current.get(k) !== state.data && !(state.data === "read" && current.get(k) === "dismissed"));

  if (toInsert.length) {
    const { error } = await supabase
      .from("notice_states")
      .insert(toInsert.map((notice_key) => ({ workspace_id: workspace.id, notice_key, state: state.data })));
    if (error) return dbErrorToState(error, "setNoticeStates.insert");
  }
  if (toUpdate.length) {
    const { error } = await supabase
      .from("notice_states")
      .update({ state: state.data })
      .eq("workspace_id", workspace.id)
      .in("notice_key", toUpdate);
    if (error) return dbErrorToState(error, "setNoticeStates.update");
  }

  revalidatePath("/notices");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markNoticesRead(noticeKeys: string[]): Promise<ActionState> {
  return setStates(noticeKeys, "read");
}

export async function dismissNotice(noticeKey: string): Promise<ActionState> {
  return setStates([noticeKey], "dismissed");
}

/** Deshacer un descarte: el aviso vuelve a mostrarse como leído. */
export async function restoreNotice(noticeKey: string): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const key = z.string().min(1).max(200).safeParse(noticeKey);
  if (!key.success) return fail("Solicitud no válida.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notice_states")
    .update({ state: "read" })
    .eq("workspace_id", workspace.id)
    .eq("notice_key", key.data);
  if (error) return dbErrorToState(error, "restoreNotice");
  revalidatePath("/notices");
  return { ok: true };
}
