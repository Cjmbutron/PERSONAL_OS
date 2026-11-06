import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { Landmark, Pencil, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/labels";
import { formatMoney, sumByCurrency } from "@/lib/finance/money";
import { getBalances, listAccounts } from "@/features/finance/queries";
import { setAccountArchived } from "@/features/finance/actions";
import { AccountFormDialog } from "@/features/finance/components/account-form-dialog";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Finanzas" };

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function FinancePage({ searchParams }: PageProps<"/finance">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <AccountsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountsContent({ searchParams }: { searchParams: PageProps<"/finance">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";
  const ctx = await getWorkspaceContext();
  const [accounts, balances] = await Promise.all([listAccounts(ctx.workspace.id, { archived }), getBalances(ctx.workspace.id)]);

  // Saldo calculado (D-44); nunca se suman monedas distintas (D-42).
  const balanceOf = (id: string, fallback: number) => balances.get(id)?.balance ?? fallback;
  const totals = sumByCurrency(accounts.map((a) => ({ currency: a.currency, amount: balanceOf(a.id, a.opening_balance) })));

  return (
    <>
      <PageHeader
        title="Finanzas"
        description={archived ? "Cuentas archivadas. Puedes restaurarlas." : "Tus cuentas, cada una en una sola moneda."}
        actions={
          !archived ? (
            <AccountFormDialog
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nueva cuenta
                </Button>
              }
            />
          ) : undefined
        }
      />

      <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
        <Link href="/finance" aria-current={archived ? undefined : "page"} className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}>
          Activas
        </Link>
        <span aria-hidden className="text-muted-foreground">·</span>
        <Link href="/finance?archived=1" aria-current={archived ? "page" : undefined} className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
          Archivadas
        </Link>
      </nav>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={archived ? "No tienes cuentas archivadas" : "Aún no tienes cuentas"}
          description={archived ? undefined : "Crea tu primera cuenta (efectivo, banco o ahorro) para empezar a registrar movimientos."}
        />
      ) : (
        <>
          {!archived ? (
            <section aria-label="Saldo total por moneda" className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
              {[...totals].map(([currency, amount]) => (
                <p key={currency} className="text-sm text-muted-foreground">
                  Saldo total ({currency}):{" "}
                  <span className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(amount, currency)}</span>
                </p>
              ))}
            </section>
          ) : null}
          <ul className="flex flex-col gap-2" aria-label={archived ? "Cuentas archivadas" : "Cuentas"}>
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge>{ACCOUNT_TYPE_LABELS[a.account_type]}</Badge>
                    <Badge>{a.currency}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="font-semibold tabular-nums">{formatMoney(balanceOf(a.id, a.opening_balance), a.currency)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">Inicial {formatMoney(a.opening_balance, a.currency)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!archived ? (
                    <AccountFormDialog
                      account={a}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar la cuenta ${a.name}`}>
                          <Pencil aria-hidden />
                        </Button>
                      }
                    />
                  ) : null}
                  <ArchiveButton action={setAccountArchived} id={a.id} archived={archived} label={`la cuenta ${a.name}`} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
