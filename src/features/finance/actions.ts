"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToState, echoValues, fail, failFromZod, type ActionState } from "@/lib/actions";
import {
  accountEditSchema,
  accountInputSchema,
  categoryEditSchema,
  categoryInputSchema,
  transactionEditSchema,
  transactionInputSchema,
  transferInputSchema,
  budgetEditSchema,
  budgetInputSchema,
  obligationEditSchema,
  obligationInputSchema,
  payObligationSchema,
} from "@/lib/validations/finance";
import { todayIn } from "@/lib/utils/date";
import { formDataToObject, optionalUuid } from "@/lib/validations/common";
import { idSchema } from "@/lib/validations/work";

function revalidateFinance() {
  revalidatePath("/finance", "layout");
  revalidatePath("/dashboard");
}

function dbError(error: { code?: string; message: string }, context: string, values: Record<string, string>) {
  if (error.code === "23505") {
    return fail("Ya existe un registro activo con ese nombre. Archívalo o elige otro nombre.", {
      fieldErrors: { name: ["Ya existe uno con ese nombre"] },
      values,
    });
  }
  if (error.code === "23514") return fail("Algún valor no cumple las reglas del módulo.", { values });
  return dbErrorToState(error, context, values);
}

/** Crea o edita una cuenta. La moneda solo se fija al crear (D-40). */
export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la cuenta a editar.", { values });

  const supabase = await createClient();
  const raw = formDataToObject(formData);

  if (id.data) {
    const parsed = accountEditSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { data, error } = await supabase
      .from("financial_accounts")
      .update({ name: parsed.data.name, account_type: parsed.data.accountType, opening_balance: parsed.data.openingBalance })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return dbError(error, "saveAccount:update", values);
    if (!data?.length) return fail("La cuenta ya no existe.", { values });
  } else {
    const parsed = accountInputSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { error } = await supabase.from("financial_accounts").insert({
      workspace_id: workspace.id,
      name: parsed.data.name,
      account_type: parsed.data.accountType,
      currency: parsed.data.currency,
      opening_balance: parsed.data.openingBalance,
    });
    if (error) return dbError(error, "saveAccount:insert", values);
  }

  revalidateFinance();
  return { ok: true };
}

/** Crea o edita una categoría. El tipo solo se fija al crear (D-48). */
export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la categoría a editar.", { values });

  const supabase = await createClient();
  const raw = formDataToObject(formData);

  if (id.data) {
    const parsed = categoryEditSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { data, error } = await supabase
      .from("transaction_categories")
      .update({ name: parsed.data.name })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return dbError(error, "saveCategory:update", values);
    if (!data?.length) return fail("La categoría ya no existe.", { values });
  } else {
    const parsed = categoryInputSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);

    // Una subcategoría hereda el tipo de su categoría principal (D-110).
    let kind = parsed.data.kind;
    if (parsed.data.parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("transaction_categories")
        .select("kind, parent_id, archived_at")
        .eq("id", parsed.data.parentId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      if (parentError) return dbError(parentError, "saveCategory:parent", values);
      if (!parent) return fail("La categoría principal ya no existe.", { values });
      if (parent.archived_at) return fail("La categoría principal está archivada.", { values });
      if (parent.parent_id) return fail("Una subcategoría no puede tener subcategorías.", { values });
      kind = parent.kind;
    }

    const { error } = await supabase
      .from("transaction_categories")
      .insert({ workspace_id: workspace.id, name: parsed.data.name, kind, parent_id: parsed.data.parentId });
    if (error) return dbError(error, "saveCategory:insert", values);
  }

  revalidateFinance();
  return { ok: true };
}

const archiveArgs = z.object({ id: idSchema, archived: z.boolean() });

async function setArchived(table: "financial_accounts" | "transaction_categories" | "transactions" | "budgets", id: string, archived: boolean) {
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

  if (error) {
    if (error.code === "23505") {
      return fail("No se puede restaurar: ya existe otro registro activo con el mismo nombre.");
    }
    if (error.code === "23514" && !/violates|constraint/i.test(error.message)) return fail(error.message);
    return dbErrorToState(error, `setArchived:${table}`);
  }
  if (!data?.length) return fail("El registro ya no existe.");

  revalidateFinance();
  return { ok: true } satisfies ActionState;
}

/** Archivado lógico y restauración (D-45): las cuentas nunca se borran. */
export async function setAccountArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("financial_accounts", id, archived);
}

/** Archivar una categoría principal archiva también sus subcategorías (D-111). Restaurar solo restaura la elegida. */
export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionState> {
  const result = await setArchived("transaction_categories", id, archived);
  if (result.ok && archived) {
    const { workspace } = await getWorkspaceContext();
    const supabase = await createClient();
    const { error } = await supabase
      .from("transaction_categories")
      .update({ archived_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("parent_id", id)
      .is("archived_at", null);
    if (error) return dbErrorToState(error, "setCategoryArchived:children");
  }
  return result;
}

// --- Movimientos y transferencias ---------------------------------------------------

/** Mensajes propios de las reglas de la base de datos (en español); los técnicos se ocultan. */
function txError(error: { code?: string; message: string }, context: string, values: Record<string, string>) {
  if (error.code === "23514" && !/violates|constraint/i.test(error.message)) {
    return fail(error.message, { values });
  }
  if (error.code === "23514") return fail("Algún valor no cumple las reglas del movimiento.", { values });
  if (error.code === "23503") return fail("La cuenta o la categoría ya no existe, o no corresponde al tipo de movimiento.", { values });
  if (error.code === "P0002") return fail(error.message, { values });
  return dbErrorToState(error, context, values);
}

function futureDate(date: string, timezone: string) {
  return date > todayIn(timezone) ? "No se pueden registrar movimientos con fecha futura" : null;
}

/** Crea o edita un ingreso o gasto. La moneda la deriva el servidor de la cuenta (D-41). */
export async function saveTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el movimiento a editar.", { values });

  const supabase = await createClient();
  const raw = formDataToObject(formData);

  if (id.data) {
    const parsed = transactionEditSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const problem = futureDate(parsed.data.date, profile.timezone);
    if (problem) return fail("Revisa los campos marcados.", { fieldErrors: { date: [problem] }, values });

    const { data, error } = await supabase
      .from("transactions")
      .update({
        amount: parsed.data.amount,
        transaction_date: parsed.data.date,
        category_id: parsed.data.categoryId,
        description: parsed.data.description,
      })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .in("kind", ["income", "expense"])
      .select("id");
    if (error) return txError(error, "saveTransaction:update", values);
    if (!data?.length) return fail("El movimiento ya no existe.", { values });
  } else {
    const parsed = transactionInputSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const problem = futureDate(parsed.data.date, profile.timezone);
    if (problem) return fail("Revisa los campos marcados.", { fieldErrors: { date: [problem] }, values });

    const { data: account, error: accError } = await supabase
      .from("financial_accounts")
      .select("currency, archived_at")
      .eq("id", parsed.data.accountId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (accError) return dbErrorToState(accError, "saveTransaction:account", values);
    if (!account) return fail("Revisa los campos marcados.", { fieldErrors: { accountId: ["La cuenta ya no existe"] }, values });
    if (account.archived_at) return fail("Revisa los campos marcados.", { fieldErrors: { accountId: ["La cuenta está archivada"] }, values });

    const { error } = await supabase.from("transactions").insert({
      workspace_id: workspace.id,
      account_id: parsed.data.accountId,
      currency: account.currency,
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      transaction_date: parsed.data.date,
      category_id: parsed.data.categoryId,
      description: parsed.data.description,
    });
    if (error) return txError(error, "saveTransaction:insert", values);
  }

  revalidateFinance();
  return { ok: true };
}

/** Transferencia atómica entre dos cuentas de la misma moneda (D-50). */
export async function createTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const parsed = transferInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const problem = futureDate(parsed.data.date, profile.timezone);
  if (problem) return fail("Revisa los campos marcados.", { fieldErrors: { date: [problem] }, values });

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_transfer", {
    p_workspace_id: workspace.id,
    p_from_account: parsed.data.fromAccountId,
    p_to_account: parsed.data.toAccountId,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });
  if (error) return txError(error, "createTransfer", values);

  revalidateFinance();
  return { ok: true };
}

/** Archivado lógico de un ingreso o gasto (D-45). */
export async function setTransactionArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("transactions", id, archived);
}

const groupArgs = z.object({ groupId: idSchema, archived: z.boolean() });

/** D-51: una transferencia se archiva o restaura completa, con sus dos movimientos. */
export async function setTransferArchived(groupId: string, archived: boolean): Promise<ActionState> {
  await getWorkspaceContext();
  const args = groupArgs.safeParse({ groupId, archived });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_transfer", { p_group_id: args.data.groupId, p_archived: args.data.archived });
  if (error) return txError(error, "setTransferArchived", {});

  revalidateFinance();
  return { ok: true };
}

// --- Presupuestos (D-52) ------------------------------------------------------------

/** Crea o edita un presupuesto mensual. Al editar solo cambia el importe. */
export async function saveBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró el presupuesto a editar.", { values });

  const supabase = await createClient();
  const raw = formDataToObject(formData);

  if (id.data) {
    const parsed = budgetEditSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { data, error } = await supabase
      .from("budgets")
      .update({ amount: parsed.data.amount })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return dbErrorToState(error, "saveBudget:update", values);
    if (!data?.length) return fail("El presupuesto ya no existe.", { values });
  } else {
    const parsed = budgetInputSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { error } = await supabase.from("budgets").insert({
      workspace_id: workspace.id,
      period_month: parsed.data.periodMonth,
      category_id: parsed.data.categoryId,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
    });
    if (error) {
      if (error.code === "23505") return fail("Ese mes ya tiene un presupuesto para esa categoría.", { fieldErrors: { categoryId: ["Ya tiene presupuesto este mes"] }, values });
      if (error.code === "23503") return fail("Elige una categoría de gasto válida.", { fieldErrors: { categoryId: ["Categoría no válida"] }, values });
      return dbErrorToState(error, "saveBudget:insert", values);
    }
  }

  revalidateFinance();
  return { ok: true };
}

export async function setBudgetArchived(id: string, archived: boolean): Promise<ActionState> {
  return setArchived("budgets", id, archived);
}

const copyArgs = z.object({ from: z.string().regex(/^\d{4}-\d{2}-01$/), to: z.string().regex(/^\d{4}-\d{2}-01$/) });

/** D-52: copia los presupuestos de un mes a otro, omitiendo los que ya existen. */
export async function copyBudgets(from: string, to: string): Promise<ActionState & { copied?: number }> {
  const { workspace } = await getWorkspaceContext();
  const args = copyArgs.safeParse({ from, to });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_budgets", {
    p_workspace_id: workspace.id,
    p_from_month: args.data.from,
    p_to_month: args.data.to,
  });
  if (error) return txError(error, "copyBudgets", {});

  revalidateFinance();
  return { ok: true, copied: data ?? 0 };
}

// --- Obligaciones (D-54) ------------------------------------------------------------

/** Crea o edita una obligación pendiente. La moneda solo se fija al crear. */
export async function saveObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = optionalUuid.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la obligación a editar.", { values });

  const supabase = await createClient();
  const raw = formDataToObject(formData);

  if (id.data) {
    const parsed = obligationEditSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { data, error } = await supabase
      .from("financial_obligations")
      .update({
        name: parsed.data.name,
        amount: parsed.data.amount,
        due_date: parsed.data.dueDate,
        recurrence: parsed.data.recurrence,
        category_id: parsed.data.categoryId,
      })
      .eq("id", id.data)
      .eq("workspace_id", workspace.id)
      .in("status", ["pending", "cancelled"])
      .select("id");
    if (error) return dbError(error, "saveObligation:update", values);
    if (!data?.length) return fail("La obligación ya no existe o ya fue pagada.", { values });
  } else {
    const parsed = obligationInputSchema.safeParse(raw);
    if (!parsed.success) return failFromZod(parsed.error, values);
    const { error } = await supabase.from("financial_obligations").insert({
      workspace_id: workspace.id,
      name: parsed.data.name,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      due_date: parsed.data.dueDate,
      recurrence: parsed.data.recurrence,
      category_id: parsed.data.categoryId,
    });
    if (error) return dbError(error, "saveObligation:insert", values);
  }

  revalidateFinance();
  return { ok: true };
}

const statusArgs = z.object({ id: idSchema, status: z.enum(["pending", "cancelled"]) });

/** Cancelar o reactivar una obligación (no se borran). Las pagadas no cambian. */
export async function setObligationStatus(id: string, status: "pending" | "cancelled"): Promise<ActionState> {
  const { workspace } = await getWorkspaceContext();
  const args = statusArgs.safeParse({ id, status });
  if (!args.success) return fail("Solicitud no válida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_obligations")
    .update({ status: args.data.status })
    .eq("id", args.data.id)
    .eq("workspace_id", workspace.id)
    .in("status", ["pending", "cancelled"])
    .select("id");
  if (error) return dbErrorToState(error, "setObligationStatus");
  if (!data?.length) return fail("La obligación ya no existe o ya fue pagada.");

  revalidateFinance();
  return { ok: true };
}

/** Paga una obligación: registra el gasto, la marca como pagada y crea la siguiente si es mensual. */
export async function payObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await getWorkspaceContext();
  const values = echoValues(formData);

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("No se encontró la obligación.", { values });

  const parsed = payObligationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);
  const problem = futureDate(parsed.data.date, profile.timezone);
  if (problem) return fail("Revisa los campos marcados.", { fieldErrors: { date: [problem] }, values });

  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_obligation", {
    p_obligation_id: id.data,
    p_account_id: parsed.data.accountId,
    p_paid_date: parsed.data.date,
    p_category_id: parsed.data.categoryId,
  });
  if (error) return txError(error, "payObligation", values);

  revalidateFinance();
  return { ok: true };
}
