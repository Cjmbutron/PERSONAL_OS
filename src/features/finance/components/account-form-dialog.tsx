"use client";

import { useActionState, useState } from "react";
import { saveAccount } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/labels";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/finance/money";
import { ACCOUNT_TYPES, type FinancialAccountRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function AccountForm({ account, onDone }: { account?: FinancialAccountRow; onDone: () => void }) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveAccount(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <FormMessage message={state.message} />
      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={100}
        autoFocus
        defaultValue={v("name", account?.name ?? "")}
        error={state.fieldErrors?.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="accountType"
          label="Tipo"
          required
          defaultValue={v("accountType", account?.account_type ?? "bank")}
          options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))}
          error={state.fieldErrors?.accountType}
        />
        {account ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Moneda</span>
            <p className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
              {account.currency}
            </p>
            <p className="text-xs text-muted-foreground">La moneda no se puede cambiar.</p>
          </div>
        ) : (
          <SelectField
            name="currency"
            label="Moneda"
            required
            defaultValue={v("currency", "BOB")}
            options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABELS[c] }))}
            error={state.fieldErrors?.currency}
            hint="No se podrá cambiar después."
          />
        )}
      </div>
      <TextField
        name="openingBalance"
        label="Saldo inicial"
        type="number"
        inputMode="decimal"
        step="0.01"
        defaultValue={v("openingBalance", account ? String(account.opening_balance) : "0")}
        error={state.fieldErrors?.openingBalance}
        hint="El saldo con el que empiezas a registrar. Puede ser negativo si la cuenta empieza con deuda."
      />
      <SubmitButton pendingText="Guardando…">{account ? "Guardar cambios" : "Crear cuenta"}</SubmitButton>
    </form>
  );
}

export function AccountFormDialog({ account, trigger }: { account?: FinancialAccountRow; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            {account ? "Cambiar el saldo inicial modifica el saldo actual." : "Una cuenta guarda sus movimientos en una sola moneda."}
          </DialogDescription>
        </DialogHeader>
        <AccountForm account={account} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
