import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { PiggyBank, Pencil, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatMoney, roundMoney } from "@/lib/finance/money";
import { budgetRemaining } from "@/lib/finance/stats";
import { todayIn } from "@/lib/utils/date";
import { addMonths, monthLabel, monthStart } from "@/lib/utils/month";
import { monthParamSchema } from "@/lib/validations/fitness";
import { getCategoryTotals, getMonthlyTotals, listBudgets, listCategories } from "@/features/finance/queries";
import { setBudgetArchived } from "@/features/finance/actions";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { BudgetFormDialog } from "@/features/finance/components/budget-form-dialog";
import { BudgetProgress } from "@/features/finance/components/budget-progress";
import { CopyBudgetsButton } from "@/features/finance/components/copy-budgets-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Presupuestos" };

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function BudgetsPage({ searchParams }: PageProps<"/finance/budgets">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <BudgetsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BudgetsContent({ searchParams }: { searchParams: PageProps<"/finance/budgets">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";

  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const currentMonth = monthStart(today);
  const parsed = monthParamSchema.safeParse(first(raw.month));
  const month = parsed.success ? `${parsed.data}-01` : currentMonth;

  const [budgets, categories, catTotals, monthTotals] = await Promise.all([
    listBudgets(ctx.workspace.id, month, { archived }),
    listCategories(ctx.workspace.id, { archived: "all" }),
    getCategoryTotals(ctx.workspace.id, month),
    getMonthlyTotals(ctx.workspace.id, month, month),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const spentByCategory = new Map(catTotals.filter((t) => t.kind === "expense").map((t) => [`${t.currency}:${t.category_id}`, t.total]));
  const spentTotal = new Map(monthTotals.filter((t) => t.kind === "expense").map((t) => [t.currency, t.total]));

  const spentOf = (b: (typeof budgets)[number]) =>
    b.category_id ? (spentByCategory.get(`${b.currency}:${b.category_id}`) ?? 0) : (spentTotal.get(b.currency) ?? 0);

  const total = budgets.find((b) => b.category_id === null);
  const byCategory = budgets
    .filter((b) => b.category_id !== null)
    .sort((a, b) => spentOf(b) / b.amount - spentOf(a) / a.amount);

  const budgeted = new Set(budgets.map((b) => b.category_id));
  const available = categories.filter((c) => c.kind === "expense" && c.archived_at === null && !budgeted.has(c.id));
  const unbudgeted = catTotals
    .filter((t) => t.kind === "expense" && !budgets.some((b) => b.category_id === t.category_id && b.currency === t.currency))
    .sort((a, b) => b.total - a.total);

  const q = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      month: month === currentMonth ? undefined : month.slice(0, 7),
      archived: archived ? "1" : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/finance/budgets${qs ? `?${qs}` : ""}`;
  };

  const next = addMonths(month, 1);
  const canAdd = !archived && (available.length > 0 || !total);

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description={archived ? "Presupuestos archivados del mes. Puedes restaurarlos." : "Un límite de gasto por categoría y, si quieres, un tope del total del mes."}
        actions={
          !archived ? (
            <div className="flex flex-wrap items-start gap-2">
              {budgets.length > 0 ? <CopyBudgetsButton from={month} to={next} /> : null}
              {canAdd ? (
                <BudgetFormDialog
                  month={month.slice(0, 7)}
                  categories={available}
                  hasTotal={Boolean(total)}
                  trigger={
                    <Button>
                      <Plus aria-hidden />
                      Nuevo presupuesto
                    </Button>
                  }
                />
              ) : null}
            </div>
          ) : undefined
        }
      />

      <MonthNav
        label={monthLabel(month)}
        prevHref={q({ month: addMonths(month, -1).slice(0, 7) })}
        nextHref={q({ month: next.slice(0, 7) })}
        currentHref={month !== currentMonth ? q({ month: undefined }) : undefined}
      />

      <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
        <Link href={q({ archived: undefined })} aria-current={archived ? undefined : "page"} className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}>
          Activos
        </Link>
        <span aria-hidden className="text-muted-foreground">·</span>
        <Link href={q({ archived: "1" })} aria-current={archived ? "page" : undefined} className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
          Archivados
        </Link>
      </nav>

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={archived ? "No hay presupuestos archivados en este mes" : `Sin presupuestos para ${monthLabel(month)}`}
          description={archived ? undefined : "Crea uno o copia los del mes anterior desde su pantalla."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {[...(total ? [total] : []), ...byCategory].map((b) => {
            const spent = spentOf(b);
            const name = b.category_id ? (categoryName.get(b.category_id) ?? "Categoría") : "Total del mes";
            const remaining = budgetRemaining(spent, b.amount);
            return (
              <Card key={b.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{name}</CardTitle>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(spent, b.currency)} de {formatMoney(b.amount, b.currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!archived ? (
                      <BudgetFormDialog
                        budget={b}
                        title={name}
                        month={month.slice(0, 7)}
                        categories={[]}
                        hasTotal
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Editar el presupuesto ${name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    ) : null}
                    <ArchiveButton action={setBudgetArchived} id={b.id} archived={archived} label={`el presupuesto ${name}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <BudgetProgress spent={spent} limit={b.amount} label={name} />
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                    {remaining >= 0 ? `Quedan ${formatMoney(remaining, b.currency)}` : `Excedido por ${formatMoney(-remaining, b.currency)}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!archived && unbudgeted.length > 0 ? (
        <section aria-label="Gastos sin presupuesto" className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gastos sin presupuesto</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {unbudgeted.map((t) => (
              <li key={`${t.currency}:${t.category_id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{categoryName.get(t.category_id) ?? "Categoría"}</span>
                <span className="tabular-nums text-muted-foreground">{formatMoney(roundMoney(t.total), t.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
