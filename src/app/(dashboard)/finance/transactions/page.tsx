import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatMoney, roundMoney } from "@/lib/finance/money";
import { todayIn } from "@/lib/utils/date";
import { addMonths, monthLabel, monthStart } from "@/lib/utils/month";
import { monthParamSchema } from "@/lib/validations/fitness";
import { MAX_MONTH_TRANSACTIONS, listAccounts, listCategories, listTransactions } from "@/features/finance/queries";
import { TransactionFormDialog } from "@/features/finance/components/transaction-form-dialog";
import { TransactionRowView } from "@/features/finance/components/transaction-row";
import { TransferFormDialog } from "@/features/finance/components/transfer-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Movimientos" };

const archivedSchema = z.enum(["1"]).optional().catch(undefined);
const uuidSchema = z.uuid().optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function TransactionsPage({ searchParams }: PageProps<"/finance/transactions">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TransactionsContent({ searchParams }: { searchParams: PageProps<"/finance/transactions">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";
  const accountFilter = uuidSchema.parse(first(raw.account));

  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const currentMonth = monthStart(today);
  const parsedMonth = monthParamSchema.safeParse(first(raw.month));
  const month = parsedMonth.success ? `${parsedMonth.data}-01` : currentMonth;

  const [allAccounts, categories, all] = await Promise.all([
    listAccounts(ctx.workspace.id, { archived: "all" }),
    listCategories(ctx.workspace.id, { archived: "all" }),
    listTransactions(ctx.workspace.id, month, { archived }),
  ]);
  const activeAccounts = allAccounts.filter((a) => a.archived_at === null);
  const activeCategories = categories.filter((c) => c.archived_at === null);
  const accountName = new Map(allAccounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // La otra pata de cada transferencia se busca en el mes completo, aunque haya filtro de cuenta.
  const legs = new Map<string, typeof all>();
  for (const t of all) if (t.transfer_group_id) legs.set(t.transfer_group_id, [...(legs.get(t.transfer_group_id) ?? []), t]);
  const counterpart = (t: (typeof all)[number]) =>
    t.transfer_group_id ? legs.get(t.transfer_group_id)?.find((l) => l.id !== t.id) : undefined;

  const transactions = accountFilter ? all.filter((t) => t.account_id === accountFilter) : all;

  // Resumen del mes por moneda (D-55): las transferencias no cuentan como ingreso ni gasto (D-42: sin mezclar monedas).
  const summary = new Map<string, { income: number; expense: number }>();
  if (!archived) {
    for (const t of transactions) {
      if (t.kind !== "income" && t.kind !== "expense") continue;
      const s = summary.get(t.currency) ?? { income: 0, expense: 0 };
      s[t.kind] = roundMoney(s[t.kind] + t.amount);
      summary.set(t.currency, s);
    }
  }

  const q = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      month: month === currentMonth ? undefined : month.slice(0, 7),
      account: accountFilter,
      archived: archived ? "1" : undefined,
      ...over,
    };
    for (const [k, val] of Object.entries(merged)) if (val) params.set(k, val);
    const qs = params.toString();
    return `/finance/transactions${qs ? `?${qs}` : ""}`;
  };

  const canRegister = activeAccounts.length > 0;

  return (
    <>
      <PageHeader
        title="Movimientos"
        description={archived ? "Movimientos archivados del mes. Puedes restaurarlos." : "Ingresos, gastos y transferencias de tus cuentas."}
        actions={
          canRegister && !archived ? (
            <div className="flex flex-wrap gap-2">
              <TransactionFormDialog
                kind="income"
                accounts={activeAccounts}
                categories={activeCategories}
                today={today}
                defaultAccountId={accountFilter}
                trigger={
                  <Button variant="outline">
                    <Plus aria-hidden />
                    Ingreso
                  </Button>
                }
              />
              <TransactionFormDialog
                kind="expense"
                accounts={activeAccounts}
                categories={activeCategories}
                today={today}
                defaultAccountId={accountFilter}
                trigger={
                  <Button>
                    <Plus aria-hidden />
                    Gasto
                  </Button>
                }
              />
              {activeAccounts.length >= 2 ? (
                <TransferFormDialog
                  accounts={activeAccounts}
                  today={today}
                  trigger={
                    <Button variant="outline">
                      <ArrowLeftRight aria-hidden />
                      Transferir
                    </Button>
                  }
                />
              ) : null}
            </div>
          ) : undefined
        }
      />

      <nav aria-label="Mes" className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={q({ month: addMonths(month, -1).slice(0, 7) })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <div className="text-center">
          <p className="font-medium capitalize">{monthLabel(month)}</p>
          {month !== currentMonth ? (
            <Link href={q({ month: undefined })} className="text-xs font-medium text-primary hover:underline">
              Ir al mes actual
            </Link>
          ) : null}
        </div>
        <Link
          href={q({ month: addMonths(month, 1).slice(0, 7) })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Mes siguiente"
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <nav aria-label="Vista" className="flex gap-2">
          <Link href={q({ archived: undefined })} aria-current={archived ? undefined : "page"} className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}>
            Activos
          </Link>
          <span aria-hidden className="text-muted-foreground">·</span>
          <Link href={q({ archived: "1" })} aria-current={archived ? "page" : undefined} className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
            Archivados
          </Link>
        </nav>
        {allAccounts.length > 1 ? (
          <nav aria-label="Filtrar por cuenta" className="flex flex-wrap items-center gap-1.5">
            <Link
              href={q({ account: undefined })}
              aria-current={!accountFilter ? "page" : undefined}
              className={!accountFilter ? "rounded-md bg-muted px-2 py-1 font-medium" : "rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"}
            >
              Todas
            </Link>
            {allAccounts.map((a) => (
              <Link
                key={a.id}
                href={q({ account: a.id })}
                aria-current={accountFilter === a.id ? "page" : undefined}
                className={accountFilter === a.id ? "rounded-md bg-muted px-2 py-1 font-medium" : "rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"}
              >
                {a.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {summary.size > 0 ? (
        <section aria-label="Resumen del mes" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...summary].map(([currency, s]) => (
            <Card key={currency}>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground">{currency} · {monthLabel(month)}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Ingresos</dt>
                    <dd className="font-semibold tabular-nums text-success">{formatMoney(s.income, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Gastos</dt>
                    <dd className="font-semibold tabular-nums">{formatMoney(s.expense, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Balance</dt>
                    <dd className="font-semibold tabular-nums">{formatMoney(roundMoney(s.income - s.expense), currency)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {!canRegister && !archived && allAccounts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Primero crea una cuenta"
          description="Los movimientos se registran dentro de una cuenta."
          action={
            <Link href="/finance" className="text-sm font-medium text-primary hover:underline">
              Ir a Cuentas
            </Link>
          }
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={archived ? "No hay movimientos archivados en este mes" : `Sin movimientos en ${monthLabel(month)}`}
          description={archived ? undefined : "Registra un ingreso, un gasto o una transferencia."}
        />
      ) : (
        <>
          {all.length >= MAX_MONTH_TRANSACTIONS ? (
            <p role="status" className="mb-2 text-xs text-warning">
              Se muestran los {MAX_MONTH_TRANSACTIONS} movimientos más recientes del mes; los totales podrían estar incompletos.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2" aria-label="Movimientos">
            {transactions.map((t) => (
              <TransactionRowView
                key={t.id}
                transaction={t}
                accountName={accountName.get(t.account_id) ?? "Cuenta"}
                counterpartName={(() => {
                  const c = counterpart(t);
                  return c ? accountName.get(c.account_id) : undefined;
                })()}
                categoryName={t.category_id ? categoryName.get(t.category_id) : undefined}
                accounts={activeAccounts}
                categories={activeCategories}
                today={today}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
