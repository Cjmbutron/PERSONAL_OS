"use client";

import { Pencil } from "lucide-react";
import { setTransactionArchived, setTransferArchived } from "@/features/finance/actions";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils/date";
import type { FinancialAccountRow, TransactionCategoryRow, TransactionRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArchiveButton } from "./archive-button";
import { TransactionFormDialog } from "./transaction-form-dialog";

const isTransfer = (t: TransactionRow) => t.kind === "transfer_in" || t.kind === "transfer_out";

export function TransactionRowView({
  transaction: t,
  accountName,
  counterpartName,
  categoryName,
  accounts,
  categories,
  today,
}: {
  transaction: TransactionRow;
  accountName: string;
  /** Nombre de la otra cuenta en una transferencia, si se conoce. */
  counterpartName?: string;
  categoryName?: string;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
}) {
  const archived = t.archived_at !== null;
  const positive = t.kind === "income" || t.kind === "transfer_in";
  const transfer = isTransfer(t);

  const title = transfer
    ? t.kind === "transfer_out"
      ? `Transferencia a ${counterpartName ?? "otra cuenta"}`
      : `Transferencia desde ${counterpartName ?? "otra cuenta"}`
    : (t.description ?? categoryName ?? "Movimiento");
  const label = `${title} del ${formatDate(t.transaction_date)}`;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{accountName}</span>
          {transfer ? <Badge>Transferencia</Badge> : categoryName ? <Badge>{categoryName}</Badge> : null}
          {transfer && t.description ? <span className="truncate">{t.description}</span> : null}
          {archived ? <Badge>Archivado</Badge> : null}
        </div>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          transfer ? "text-foreground" : positive ? "text-success" : "text-foreground",
        )}
      >
        <span className="sr-only">{positive ? "Entra" : "Sale"} </span>
        {positive ? "+" : "−"}
        {formatMoney(t.amount, t.currency)}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {!transfer && !archived ? (
          <TransactionFormDialog
            kind={t.kind as "income" | "expense"}
            transaction={t}
            accounts={accounts}
            categories={categories}
            today={today}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label}`}>
                <Pencil aria-hidden />
              </Button>
            }
          />
        ) : null}
        <ArchiveButton
          action={transfer ? (_id, a) => setTransferArchived(t.transfer_group_id!, a) : setTransactionArchived}
          id={t.id}
          archived={archived}
          label={transfer ? `la ${label.toLowerCase()} (se archivan ambos movimientos)` : label}
        />
      </div>
    </li>
  );
}
