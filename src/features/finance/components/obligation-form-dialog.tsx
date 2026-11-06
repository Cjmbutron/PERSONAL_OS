"use client";

import { useActionState, useState } from "react";
import { saveObligation } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { OBLIGATION_RECURRENCE_LABELS } from "@/lib/constants/labels";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/finance/money";
import { OBLIGATION_RECURRENCES, type ObligationRow, type TransactionCategoryRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function ObligationForm({
  obligation,
  categories,
  today,
  onDone,
}: {
  obligation?: ObligationRow;
  categories: TransactionCategoryRow[];
  today: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveObligation(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {obligation ? <input type="hidden" name="id" value={obligation.id} /> : null}
      <FormMessage message={state.message} />
      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={100}
        autoFocus
        defaultValue={v("name", obligation?.name ?? "")}
        error={state.fieldErrors?.name}
        hint="Ej.: Alquiler, internet, cuota del préstamo."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          label="Importe"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          defaultValue={v("amount", obligation ? String(obligation.amount) : "")}
          error={state.fieldErrors?.amount}
        />
        {obligation ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Moneda</span>
            <p className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
              {obligation.currency}
            </p>
          </div>
        ) : (
          <SelectField
            name="currency"
            label="Moneda"
            required
            defaultValue={v("currency", "BOB")}
            options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABELS[c] }))}
            error={state.fieldErrors?.currency}
          />
        )}
        <TextField
          name="dueDate"
          label="Vencimiento"
          type="date"
          required
          defaultValue={v("dueDate", obligation?.due_date ?? today)}
          error={state.fieldErrors?.dueDate}
        />
        <SelectField
          name="recurrence"
          label="Repetición"
          required
          defaultValue={v("recurrence", obligation?.recurrence ?? "none")}
          options={OBLIGATION_RECURRENCES.map((r) => ({ value: r, label: OBLIGATION_RECURRENCE_LABELS[r] }))}
          error={state.fieldErrors?.recurrence}
          hint="“Cada mes” crea la siguiente al pagar."
        />
      </div>
      <SelectField
        name="categoryId"
        label="Categoría de gasto (opcional)"
        placeholder="Elegir al pagar"
        defaultValue={v("categoryId", obligation?.category_id ?? "")}
        options={categories.filter((c) => c.kind === "expense").map((c) => ({ value: c.id, label: c.name }))}
        error={state.fieldErrors?.categoryId}
      />
      <SubmitButton pendingText="Guardando…">{obligation ? "Guardar cambios" : "Crear obligación"}</SubmitButton>
    </form>
  );
}

export function ObligationFormDialog({
  obligation,
  categories,
  today,
  trigger,
}: {
  obligation?: ObligationRow;
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
          <DialogTitle>{obligation ? "Editar obligación" : "Nueva obligación"}</DialogTitle>
          <DialogDescription>Un pago futuro con fecha de vencimiento.</DialogDescription>
        </DialogHeader>
        <ObligationForm obligation={obligation} categories={categories} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
