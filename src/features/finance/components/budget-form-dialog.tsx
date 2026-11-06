"use client";

import { useActionState, useState } from "react";
import { saveBudget } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { formatMoney } from "@/lib/finance/money";
import type { BudgetRow, TransactionCategoryRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function BudgetForm({
  budget,
  month,
  categories,
  hasTotal,
  onDone,
}: {
  budget?: BudgetRow;
  /** Mes en formato YYYY-MM. */
  month: string;
  /** Categorías de gasto que aún no tienen presupuesto este mes. */
  categories: TransactionCategoryRow[];
  hasTotal: boolean;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveBudget(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} />
      {budget ? (
        <input type="hidden" name="id" value={budget.id} />
      ) : (
        <>
          <input type="hidden" name="periodMonth" value={month} />
          <input type="hidden" name="currency" value="BOB" />
          <SelectField
            name="categoryId"
            label="Categoría"
            defaultValue={v("categoryId", categories[0]?.id ?? "")}
            placeholder={hasTotal ? undefined : "Total del mes (todas las categorías)"}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            error={state.fieldErrors?.categoryId}
            hint={hasTotal ? "El total del mes ya tiene presupuesto." : "Deja “Total del mes” para fijar un tope general."}
          />
        </>
      )}
      <TextField
        name="amount"
        label="Límite (BOB)"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        required
        autoFocus
        defaultValue={v("amount", budget ? String(budget.amount) : "")}
        error={state.fieldErrors?.amount}
      />
      <SubmitButton pendingText="Guardando…">{budget ? "Guardar cambios" : "Crear presupuesto"}</SubmitButton>
    </form>
  );
}

export function BudgetFormDialog({
  budget,
  month,
  categories,
  hasTotal,
  title,
  trigger,
}: {
  budget?: BudgetRow;
  month: string;
  categories: TransactionCategoryRow[];
  hasTotal: boolean;
  title?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? `Editar presupuesto${title ? `: ${title}` : ""}` : "Nuevo presupuesto"}</DialogTitle>
          <DialogDescription>
            {budget ? `Límite actual: ${formatMoney(budget.amount, budget.currency)}.` : "Un límite de gasto para el mes."}
          </DialogDescription>
        </DialogHeader>
        <BudgetForm budget={budget} month={month} categories={categories} hasTotal={hasTotal} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
