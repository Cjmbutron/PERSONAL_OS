"use client";

import { useActionState, useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { saveTransaction } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { formatMoney } from "@/lib/finance/money";
import type { FinancialAccountRow, TransactionCategoryRow, TransactionRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

type Kind = "income" | "expense";

function TransactionForm({
  kind,
  transaction,
  accounts,
  categories,
  today,
  defaultAccountId,
  onDone,
}: {
  kind: Kind;
  transaction?: TransactionRow;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
  defaultAccountId?: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveTransaction(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const options = categories.filter((c) => c.kind === kind);
  const account = transaction ? accounts.find((a) => a.id === transaction.account_id) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {transaction ? <input type="hidden" name="id" value={transaction.id} /> : <input type="hidden" name="kind" value={kind} />}
      <FormMessage message={state.message} />

      {transaction ? (
        <p className="text-sm text-muted-foreground">
          Cuenta: <span className="font-medium text-foreground">{account?.name ?? "—"}</span> (no se puede cambiar).
        </p>
      ) : (
        <SelectField
          name="accountId"
          label="Cuenta"
          required
          defaultValue={v("accountId", defaultAccountId ?? accounts[0]?.id ?? "")}
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
          error={state.fieldErrors?.accountId}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          label={`Importe${account || accounts[0] ? ` (${(account ?? accounts[0]).currency})` : ""}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          autoFocus
          defaultValue={v("amount", transaction ? String(transaction.amount) : "")}
          error={state.fieldErrors?.amount}
        />
        <TextField
          name="date"
          label="Fecha"
          type="date"
          required
          max={today}
          defaultValue={v("date", transaction?.transaction_date ?? today)}
          error={state.fieldErrors?.date}
        />
      </div>

      <SelectField
        name="categoryId"
        label="Categoría"
        required
        placeholder="Elige una categoría"
        defaultValue={v("categoryId", transaction?.category_id ?? "")}
        options={options.map((c) => ({ value: c.id, label: c.name }))}
        error={state.fieldErrors?.categoryId}
      />

      <TextField
        name="description"
        label="Descripción"
        maxLength={300}
        defaultValue={v("description", transaction?.description ?? "")}
        error={state.fieldErrors?.description}
      />

      <SubmitButton pendingText="Guardando…">
        {transaction ? "Guardar cambios" : kind === "income" ? "Registrar ingreso" : "Registrar gasto"}
      </SubmitButton>
    </form>
  );
}

export function TransactionFormDialog({
  kind,
  transaction,
  accounts,
  categories,
  today,
  defaultAccountId,
  trigger,
  defaultOpen = false,
}: {
  kind: Kind;
  transaction?: TransactionRow;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
  defaultAccountId?: string;
  trigger: React.ReactNode;
  /** Abre el formulario al montar (lo usa el registro rápido). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = kind === "income" ? "ingreso" : "gasto";
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) clearQuickParam();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? `Editar ${label}` : `Nuevo ${label}`}</DialogTitle>
          <DialogDescription>
            {transaction
              ? `Importe actual: ${formatMoney(transaction.amount, transaction.currency)}.`
              : "El importe se registra en la moneda de la cuenta."}
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          kind={kind}
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          today={today}
          defaultAccountId={defaultAccountId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
