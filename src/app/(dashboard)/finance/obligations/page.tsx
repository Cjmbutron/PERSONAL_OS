import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatMoney, sumByCurrency } from "@/lib/finance/money";
import { dueState } from "@/lib/finance/stats";
import { todayIn } from "@/lib/utils/date";
import { listAccounts, listCategoryPaths, listObligations } from "@/features/finance/queries";
import { ObligationFormDialog } from "@/features/finance/components/obligation-form-dialog";
import { ObligationRowView } from "@/features/finance/components/obligation-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Obligaciones" };

export default function ObligationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <ObligationsContent />
    </Suspense>
  );
}

async function ObligationsContent() {
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);

  const [pending, paid, cancelled, accounts, categories] = await Promise.all([
    listObligations(ctx.workspace.id, "pending"),
    listObligations(ctx.workspace.id, "paid", 15),
    listObligations(ctx.workspace.id, "cancelled", 30),
    listAccounts(ctx.workspace.id),
    listCategoryPaths(ctx.workspace.id, { archived: "all" }),
  ]);
  const activeCategories = categories.filter((c) => c.archived_at === null);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const overdue = pending.filter((o) => dueState(o.due_date, today) === "overdue");
  const overdueTotals = sumByCurrency(overdue.map((o) => ({ currency: o.currency, amount: o.amount })));

  const section = (title: string, items: typeof pending) =>
    items.length > 0 ? (
      <section aria-label={title} className="mt-8 first:mt-0">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <ul className="flex flex-col gap-2">
          {items.map((o) => (
            <ObligationRowView
              key={o.id}
              obligation={o}
              categoryName={o.category_id ? categoryName.get(o.category_id) : undefined}
              accounts={accounts}
              categories={activeCategories}
              today={today}
            />
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <>
      <PageHeader
        title="Obligaciones"
        description="Pagos con fecha de vencimiento. Al pagar una se registra el gasto en la cuenta que elijas."
        actions={
          <ObligationFormDialog
            categories={activeCategories}
            today={today}
            trigger={
              <Button>
                <Plus aria-hidden />
                Nueva obligación
              </Button>
            }
          />
        }
      />

      {overdue.length > 0 ? (
        <p role="status" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {overdue.length} {overdue.length === 1 ? "obligación vencida" : "obligaciones vencidas"}:{" "}
          {[...overdueTotals].map(([c, a]) => formatMoney(a, c)).join(" · ")}
        </p>
      ) : null}

      {pending.length === 0 && paid.length === 0 && cancelled.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Aún no tienes obligaciones"
          description="Registra tus pagos recurrentes (alquiler, internet, cuotas) para no olvidar un vencimiento."
        />
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes obligaciones pendientes.</p>
          ) : (
            section("Pendientes", pending)
          )}
          {section("Pagadas recientemente", paid)}
          {section("Canceladas", cancelled)}
        </>
      )}
    </>
  );
}
