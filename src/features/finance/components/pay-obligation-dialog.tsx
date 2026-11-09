"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { payObligation } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { formatMoney } from "@/lib/finance/money";
import type { FinancialAccountRow, ObligationRow, TransactionCategoryRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function PayForm({
  obligation,
  accounts,
  categories,
  today,
  onDone,
}: {
  obligation: ObligationRow;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await payObligation(prev, formData);
      if (result.ok) {
        toast("Pago registrado");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  // Solo cuentas de la misma moneda que la obligación (D-41).
  const eligible = accounts.filter((a) => a.currency === obligation.currency);
  const expense = categories.filter((c) => c.kind === "expense");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={obligation.id} />
      <FormMessage message={state.message} />
      {eligible.length === 0 ? (
        <p role="alert" className="text-sm text-destructive">
          No tienes una cuenta activa en {obligation.currency}. Crea una en Cuentas para poder pagar.
        </p>
      ) : null}
      <SelectField
        name="accountId"
        label="Pagar desde"
        required
        defaultValue={v("accountId", eligible[0]?.id ?? "")}
        options={eligible.map((a) => ({ value: a.id, label: a.name }))}
        error={state.fieldErrors?.accountId}
      />
      <TextField
        name="date"
        label="Fecha de pago"
        type="date"
        required
        max={today}
        defaultValue={v("date", today)}
        error={state.fieldErrors?.date}
      />
      <SelectField
        name="categoryId"
        label="Categoría del gasto"
        required={!obligation.category_id}
        placeholder={obligation.category_id ? "La de la obligación" : "Elige una categoría"}
        defaultValue={v("categoryId", "")}
        options={expense.map((c) => ({ value: c.id, label: c.name }))}
        error={state.fieldErrors?.categoryId}
      />
      <SubmitButton pendingText="Pagando…">Pagar {formatMoney(obligation.amount, obligation.currency)}</SubmitButton>
    </form>
  );
}

export function PayObligationDialog({
  obligation,
  accounts,
  categories,
  today,
  trigger,
}: {
  obligation: ObligationRow;
  accounts: FinancialAccountRow[];
  categories: TransactionCategoryRow[];
  today: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar “{obligation.name}”</DialogTitle>
          <DialogDescription>
            Se registra un gasto en la cuenta elegida
            {obligation.recurrence === "monthly" ? " y se crea la obligación del mes siguiente." : "."}
          </DialogDescription>
        </DialogHeader>
        <PayForm obligation={obligation} accounts={accounts} categories={categories} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
