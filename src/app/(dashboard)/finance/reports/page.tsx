import { rollupTotals } from "@/lib/finance/categories";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatMoney, roundMoney } from "@/lib/finance/money";
import { monthlyTrend } from "@/lib/finance/stats";
import { todayIn } from "@/lib/utils/date";
import { addMonths, monthLabel, monthStart } from "@/lib/utils/month";
import { monthParamSchema } from "@/lib/validations/fitness";
import { getBalances, getCategoryTotals, getMonthlyTotals, listAccounts, listCategories } from "@/features/finance/queries";
import { CategoryChart, TrendChart } from "@/features/finance/components/finance-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Reportes" };

const MONTHS_IN_TREND = 6;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function ReportsPage({ searchParams }: PageProps<"/finance/reports">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({ searchParams }: { searchParams: PageProps<"/finance/reports">["searchParams"] }) {
  const raw = await searchParams;
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const currentMonth = monthStart(today);
  const parsed = monthParamSchema.safeParse(first(raw.month));
  const month = parsed.success ? `${parsed.data}-01` : currentMonth;

  const [accounts, categories, balances, totals, catTotals] = await Promise.all([
    listAccounts(ctx.workspace.id, { archived: "all" }),
    listCategories(ctx.workspace.id, { archived: "all" }),
    getBalances(ctx.workspace.id),
    getMonthlyTotals(ctx.workspace.id, addMonths(month, -(MONTHS_IN_TREND - 1)), month),
    getCategoryTotals(ctx.workspace.id, month),
  ]);

  // Nunca se mezclan monedas (D-42): un bloque por moneda.
  const currencies = [...new Set([...accounts.map((a) => a.currency), ...totals.map((t) => t.currency)])].sort();

  const q = (m: string | undefined) => `/finance/reports${m ? `?month=${m}` : ""}`;

  return (
    <>
      <PageHeader title="Reportes" description="Ingresos, gastos y saldos por mes. Las transferencias no cuentan como ingreso ni gasto." />
      <MonthNav
        label={monthLabel(month)}
        prevHref={q(addMonths(month, -1).slice(0, 7))}
        nextHref={q(addMonths(month, 1).slice(0, 7))}
        currentHref={month !== currentMonth ? q(undefined) : undefined}
      />

      {currencies.length === 0 ? (
        <EmptyState icon={BarChart3} title="Aún no hay datos" description="Crea una cuenta y registra movimientos para ver tus reportes." />
      ) : (
        <div className="flex flex-col gap-8">
          {currencies.map((currency) => {
            const trend = monthlyTrend(
              totals.filter((t) => t.currency === currency),
              month,
              MONTHS_IN_TREND,
            );
            const current = trend[trend.length - 1];
            // Totales por categoría principal, con el desglose de sus subcategorías (D-113).
            const expenseRows = rollupTotals(
              catTotals.filter((t) => t.kind === "expense"),
              categories,
              currency,
            ).map((r) => ({
              ...r,
              total: roundMoney(r.total),
              children: r.children.map((c) => ({ ...c, total: roundMoney(c.total) })),
            }));
            const expenses = expenseRows.map((r) => ({ name: r.name, total: r.total }));
            const accountRows = accounts
              .filter((a) => a.currency === currency && (a.archived_at === null || (balances.get(a.id)?.balance ?? 0) !== 0))
              .map((a) => ({ id: a.id, name: a.name, archived: a.archived_at !== null, balance: balances.get(a.id)?.balance ?? a.opening_balance }));
            const accountTotal = roundMoney(accountRows.reduce((s, a) => s + a.balance, 0));

            return (
              <section key={currency} aria-label={`Reporte en ${currency}`} className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold">{currency}</h2>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Ingresos</p>
                      <p className="text-xl font-semibold tabular-nums text-success">{formatMoney(current.income, currency)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Gastos</p>
                      <p className="text-xl font-semibold tabular-nums">{formatMoney(current.expense, currency)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Balance del mes</p>
                      <p className="text-xl font-semibold tabular-nums">{formatMoney(current.balance, currency)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Gastos por categoría</CardTitle>
                    <CardDescription>{monthLabel(month)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin gastos en este mes.</p>
                    ) : (
                      <>
                        <CategoryChart data={expenses} currency={currency} />
                        <table className="mt-4 w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th scope="col" className="py-2 pr-3 font-medium">Categoría</th>
                              <th scope="col" className="py-2 pr-3 text-right font-medium">Importe</th>
                              <th scope="col" className="py-2 text-right font-medium">% del gasto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseRows.flatMap((e) => [
                              <tr key={e.id} className="border-b border-border last:border-0">
                                <th scope="row" className="py-2 pr-3 text-left font-medium">{e.name}</th>
                                <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(e.total, currency)}</td>
                                <td className="py-2 text-right tabular-nums">
                                  {current.expense > 0 ? Math.round((e.total / current.expense) * 100) : 0} %
                                </td>
                              </tr>,
                              ...e.children.map((c) => (
                                <tr key={c.id} className="border-b border-border text-muted-foreground last:border-0">
                                  <th scope="row" className="py-1.5 pl-5 pr-3 text-left text-xs font-normal">{c.name}</th>
                                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums">{formatMoney(c.total, currency)}</td>
                                  <td className="py-1.5 text-right text-xs tabular-nums">
                                    {current.expense > 0 ? Math.round((c.total / current.expense) * 100) : 0} %
                                  </td>
                                </tr>
                              )),
                              ...(e.children.length > 0 && e.own > 0
                                ? [
                                    <tr key={`${e.id}-own`} className="border-b border-border text-muted-foreground last:border-0">
                                      <th scope="row" className="py-1.5 pl-5 pr-3 text-left text-xs font-normal">Sin subcategoría</th>
                                      <td className="py-1.5 pr-3 text-right text-xs tabular-nums">{formatMoney(roundMoney(e.own), currency)}</td>
                                      <td className="py-1.5" />
                                    </tr>,
                                  ]
                                : []),
                            ])}
                          </tbody>
                        </table>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia de {MONTHS_IN_TREND} meses</CardTitle>
                    <CardDescription>Hasta {monthLabel(month)}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      currency={currency}
                      data={trend.map((p) => ({ label: monthLabel(p.month).split(" ")[0].slice(0, 3), income: p.income, expense: p.expense }))}
                    />
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th scope="col" className="py-2 pr-3 font-medium">Mes</th>
                            <th scope="col" className="py-2 pr-3 text-right font-medium">Ingresos</th>
                            <th scope="col" className="py-2 pr-3 text-right font-medium">Gastos</th>
                            <th scope="col" className="py-2 text-right font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trend.map((p) => (
                            <tr key={p.month} className="border-b border-border last:border-0">
                              <th scope="row" className="py-2 pr-3 text-left font-medium capitalize">{monthLabel(p.month)}</th>
                              <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(p.income, currency)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(p.expense, currency)}</td>
                              <td className="py-2 text-right tabular-nums">{formatMoney(p.balance, currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Saldo por cuenta</CardTitle>
                    <CardDescription>Saldo actual, sin importar el mes mostrado.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-border">
                      {accountRows.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="truncate">
                            {a.name}
                            {a.archived ? <span className="text-muted-foreground"> (archivada)</span> : null}
                          </span>
                          <span className="tabular-nums">{formatMoney(a.balance, currency)}</span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-3 py-2 text-sm font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">{formatMoney(accountTotal, currency)}</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
