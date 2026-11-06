import { addDays } from "@/lib/utils/date";
import { addMonths } from "@/lib/utils/month";
import { roundMoney } from "./money";

// --- Presupuestos (D-53) -----------------------------------------------------

export type BudgetLevel = "ok" | "warning" | "exceeded";

export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  ok: "En orden",
  warning: "Cerca del límite",
  exceeded: "Excedido",
};

/** Semáforo fijo: menos de 80 % normal, de 80 a 100 % aviso, más de 100 % excedido. */
export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (limit <= 0) return "ok";
  const ratio = spent / limit;
  if (ratio > 1) return "exceeded";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

/** Porcentaje gastado, entero y sin límite superior (130 % es válido). */
export function budgetPercent(spent: number, limit: number): number {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

export function budgetRemaining(spent: number, limit: number): number {
  return roundMoney(limit - spent);
}

// --- Obligaciones (D-54) -----------------------------------------------------

export type DueState = "overdue" | "due_soon" | "upcoming";

export const DUE_SOON_DAYS = 7;

/** Vencida = vencimiento anterior a hoy; próxima = dentro de los siguientes 7 días (incluido hoy). */
export function dueState(dueDate: string, today: string): DueState {
  if (dueDate < today) return "overdue";
  if (dueDate <= addDays(today, DUE_SOON_DAYS)) return "due_soon";
  return "upcoming";
}

/** Días hasta el vencimiento (negativo si ya venció). */
export function daysUntil(dueDate: string, today: string): number {
  const ms = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function dueLabel(dueDate: string, today: string): string {
  const d = daysUntil(dueDate, today);
  if (d < 0) return d === -1 ? "Venció ayer" : `Venció hace ${-d} días`;
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  return `Vence en ${d} días`;
}

/** Vencimiento del mes siguiente conservando el día original (31 → 28 en febrero → 31 en marzo). Replica pay_obligation. */
export function nextDueDate(dueDate: string, anchorDay: number): string {
  const next = addMonths(`${dueDate.slice(0, 7)}-01`, 1);
  const [y, m] = next.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${next.slice(0, 8)}${String(Math.min(anchorDay, lastDay)).padStart(2, "0")}`;
}

// --- Reportes (D-55) ---------------------------------------------------------

export type MonthPoint = { month: string; income: number; expense: number; balance: number };

/** Últimos `n` meses terminando en `endMonth` (primer día), con ceros donde no hubo movimientos. */
export function monthlyTrend(
  rows: readonly { month: string; kind: "income" | "expense"; total: number }[],
  endMonth: string,
  n: number,
): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = n - 1; i >= 0; i--) out.push({ month: addMonths(endMonth, -i), income: 0, expense: 0, balance: 0 });
  const index = new Map(out.map((p, i) => [p.month, i]));
  for (const r of rows) {
    const i = index.get(r.month);
    if (i !== undefined) out[i][r.kind] = roundMoney(out[i][r.kind] + r.total);
  }
  for (const p of out) p.balance = roundMoney(p.income - p.expense);
  return out;
}
