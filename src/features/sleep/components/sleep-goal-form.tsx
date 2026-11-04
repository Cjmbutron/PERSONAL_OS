"use client";

import { useActionState } from "react";
import { updateSleepGoal } from "@/features/sleep/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

/** Formulario compacto de la meta de sueño (D-28). */
export function SleepGoalForm({ goalHours }: { goalHours: number }) {
  const [state, formAction] = useActionState(
    (prev: ActionState, formData: FormData) => updateSleepGoal(prev, formData),
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="w-40">
        <TextField
          name="goalHours"
          label="Meta (horas por noche)"
          type="number"
          inputMode="decimal"
          step={0.5}
          min={4}
          max={12}
          // `key` reinicia el campo cuando cambia el valor guardado.
          key={goalHours}
          defaultValue={state.values?.goalHours ?? String(goalHours)}
          error={state.fieldErrors?.goalHours}
        />
      </div>
      <SubmitButton pendingText="Guardando…">Guardar meta</SubmitButton>
      {state.ok && state.message ? (
        <p role="status" className="pb-2 text-sm text-success">
          {state.message}
        </p>
      ) : state.message ? (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
