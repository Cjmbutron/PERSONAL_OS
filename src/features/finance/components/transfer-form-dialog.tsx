"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { createTransfer } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { FinancialAccountRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function TransferForm({ accounts, today, onDone }: { accounts: FinancialAccountRow[]; today: string; onDone: () => void }) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createTransfer(prev, formData);
      if (result.ok) {
        toast("Transferencia registrada");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const options = accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }));

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="fromAccountId"
          label="Desde"
          required
          defaultValue={v("fromAccountId", accounts[0]?.id ?? "")}
          options={options}
          error={state.fieldErrors?.fromAccountId}
        />
        <SelectField
          name="toAccountId"
          label="Hacia"
          required
          defaultValue={v("toAccountId", accounts[1]?.id ?? "")}
          options={options}
          error={state.fieldErrors?.toAccountId}
          hint="Debe tener la misma moneda."
        />
        <TextField
          name="amount"
          label="Importe"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          autoFocus
          defaultValue={v("amount", "")}
          error={state.fieldErrors?.amount}
        />
        <TextField
          name="date"
          label="Fecha"
          type="date"
          required
          max={today}
          defaultValue={v("date", today)}
          error={state.fieldErrors?.date}
        />
      </div>
      <TextField
        name="description"
        label="Descripción"
        maxLength={300}
        defaultValue={v("description", "")}
        error={state.fieldErrors?.description}
      />
      <SubmitButton pendingText="Transfiriendo…">Transferir</SubmitButton>
    </form>
  );
}

export function TransferFormDialog({
  accounts,
  today,
  trigger,
}: {
  accounts: FinancialAccountRow[];
  today: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir entre cuentas</DialogTitle>
          <DialogDescription>Se registran la salida y la entrada juntas, o ninguna.</DialogDescription>
        </DialogHeader>
        <TransferForm accounts={accounts} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
