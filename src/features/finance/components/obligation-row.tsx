"use client";

import { useState, useTransition } from "react";
import { Ban, Pencil, RotateCcw, Wallet } from "lucide-react";
import { setObligationStatus } from "@/features/finance/actions";
import { OBLIGATION_RECURRENCE_LABELS } from "@/lib/constants/labels";
import { formatMoney } from "@/lib/finance/money";
import { dueLabel, dueState } from "@/lib/finance/stats";
import { formatDate } from "@/lib/utils/date";
import type { FinancialAccountRow, ObligationRow, TransactionCategoryRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ObligationFormDialog } from "./obligation-form-dialog";
import { PayObligationDialog } from "./pay-obligation-dialog";

const DUE_TONE = { overdue: "danger", due_soon: "warning", upcoming: "neutral" } as const;

export function ObligationRowView({
  obligation: o,
  categoryName,
  accounts,
  categories,
  today,
}: {
  obligation: ObligationRow;
  categoryName?: string;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const isPending = o.status === "pending";
  const cancelled = o.status === "cancelled";

  function change(status: "pending" | "cancelled") {
    setError(undefined);
    startTransition(async () => {
      const r = await setObligationStatus(o.id, status);
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{o.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="tabular-nums">Vence el {formatDate(o.due_date)}</span>
            {isPending ? <Badge tone={DUE_TONE[dueState(o.due_date, today)]}>{dueLabel(o.due_date, today)}</Badge> : null}
            {o.status === "paid" ? <Badge tone="success">Pagada</Badge> : null}
            {cancelled ? <Badge>Cancelada</Badge> : null}
            {o.recurrence === "monthly" ? <Badge>{OBLIGATION_RECURRENCE_LABELS.monthly}</Badge> : null}
            {categoryName ? <Badge>{categoryName}</Badge> : null}
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(o.amount, o.currency)}</p>
      </div>

      {o.status !== "paid" ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {isPending ? (
            <PayObligationDialog
              obligation={o}
              accounts={accounts}
              categories={categories}
              today={today}
              trigger={
                <Button size="sm">
                  <Wallet aria-hidden />
                  Pagar
                </Button>
              }
            />
          ) : null}
          <ObligationFormDialog
            obligation={o}
            categories={categories}
            today={today}
            trigger={
              <Button variant="outline" size="sm" aria-label={`Editar la obligación ${o.name}`}>
                <Pencil aria-hidden />
                Editar
              </Button>
            }
          />
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => change(isPending ? "cancelled" : "pending")}
            aria-label={`${isPending ? "Cancelar" : "Reactivar"} la obligación ${o.name}`}
          >
            {isPending ? <Ban aria-hidden /> : <RotateCcw aria-hidden />}
            {isPending ? "Cancelar" : "Reactivar"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
