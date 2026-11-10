import { withPaths } from "@/lib/finance/categories";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountBalanceRow,
  BudgetRow,
  FinancialAccountRow,
  MonthlyCategoryTotalRow,
  MonthlyTotalRow,
  ObligationRow,
  TransactionCategoryRow,
  TransactionRow,
} from "@/types/database";
import { addMonths } from "@/lib/utils/month";

function fail(context: string, error: { code?: string; message: string }, userMessage: string): never {
  console.error(`[db] ${context}`, error.code, error.message);
  throw new Error(userMessage);
}

/** `archived: "all"` devuelve activas y archivadas (para resolver nombres en el historial). */
export async function listAccounts(workspaceId: string, opts: { archived?: boolean | "all" } = {}): Promise<FinancialAccountRow[]> {
  const supabase = await createClient();
  let query = supabase.from("financial_accounts").select("*").eq("workspace_id", workspaceId);
  if (opts.archived !== "all") query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query.order("name").limit(200);
  if (error) fail("listAccounts", error, "No se pudieron cargar las cuentas.");
  return data ?? [];
}

export async function listCategories(workspaceId: string, opts: { archived?: boolean | "all" } = {}): Promise<TransactionCategoryRow[]> {
  const supabase = await createClient();
  let query = supabase.from("transaction_categories").select("*").eq("workspace_id", workspaceId);
  if (opts.archived !== "all") query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query.order("name").limit(500);
  if (error) fail("listCategories", error, "No se pudieron cargar las categorías.");
  return data ?? [];
}

/** Categorías ordenadas (principal y sus subcategorías) con el nombre completo, p. ej. "IAN › Tenis" (D-112). */
export async function listCategoryPaths(workspaceId: string, opts: { archived?: boolean | "all" } = {}): Promise<TransactionCategoryRow[]> {
  return withPaths(await listCategories(workspaceId, opts));
}

/** Saldo calculado por cuenta (D-44), por id de cuenta. */
export async function getBalances(workspaceId: string): Promise<Map<string, AccountBalanceRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("account_balances").select("*").eq("workspace_id", workspaceId).limit(500);
  if (error) fail("getBalances", error, "No se pudieron calcular los saldos.");
  return new Map((data ?? []).map((b) => [b.account_id, { ...b, balance: Number(b.balance) }]));
}

export const MAX_MONTH_TRANSACTIONS = 1000;

/** Movimientos de un mes calendario (`monthIso` = primer día), de más reciente a más antiguo. */
export async function listTransactions(
  workspaceId: string,
  monthIso: string,
  opts: { archived?: boolean } = {},
): Promise<TransactionRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("transaction_date", monthIso)
    .lt("transaction_date", addMonths(monthIso, 1));
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_MONTH_TRANSACTIONS);
  if (error) fail("listTransactions", error, "No se pudieron cargar los movimientos.");
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
}

// --- Presupuestos, obligaciones y reportes ------------------------------------------

export async function listBudgets(workspaceId: string, monthIso: string, opts: { archived?: boolean } = {}): Promise<BudgetRow[]> {
  const supabase = await createClient();
  let query = supabase.from("budgets").select("*").eq("workspace_id", workspaceId).eq("period_month", monthIso);
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query.limit(500);
  if (error) fail("listBudgets", error, "No se pudieron cargar los presupuestos.");
  return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) }));
}

/** Totales de ingresos y gastos por mes y moneda (sin transferencias), entre dos meses inclusive. */
export async function getMonthlyTotals(workspaceId: string, fromMonth: string, toMonth: string): Promise<MonthlyTotalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_totals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("month", fromMonth)
    .lte("month", toMonth)
    .limit(2000);
  if (error) fail("getMonthlyTotals", error, "No se pudieron cargar los totales.");
  return (data ?? []).map((r) => ({ ...r, total: Number(r.total) }));
}

/** Totales de un mes por categoría y moneda. */
export async function getCategoryTotals(workspaceId: string, monthIso: string): Promise<MonthlyCategoryTotalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_category_totals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("month", monthIso)
    .limit(2000);
  if (error) fail("getCategoryTotals", error, "No se pudieron cargar los totales por categoría.");
  return (data ?? []).map((r) => ({ ...r, total: Number(r.total) }));
}

/** Obligaciones por estado. Las pendientes van por vencimiento; las demás, de más reciente a más antigua. */
export async function listObligations(
  workspaceId: string,
  status: "pending" | "paid" | "cancelled",
  limit = 100,
): Promise<ObligationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_obligations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", status)
    .order(status === "paid" ? "paid_at" : "due_date", { ascending: status === "pending" })
    .limit(limit);
  if (error) fail("listObligations", error, "No se pudieron cargar las obligaciones.");
  return (data ?? []).map((o) => ({ ...o, amount: Number(o.amount) }));
}
