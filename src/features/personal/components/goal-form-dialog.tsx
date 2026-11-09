"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { saveGoal } from "@/features/personal/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { GoalRow, LifeAreaRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function GoalForm({
  goal,
  areas,
  hasMilestones,
  onDone,
}: {
  goal?: GoalRow;
  areas: LifeAreaRow[];
  hasMilestones: boolean;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveGoal(prev, formData);
      if (result.ok) {
        toast("Objetivo guardado");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
      <FormMessage message={state.message} />
      <TextField
        name="title"
        label="Objetivo"
        required
        maxLength={150}
        autoFocus
        defaultValue={v("title", goal?.title ?? "")}
        error={state.fieldErrors?.title}
        hint="Ej.: Correr 10 km, ahorrar para el viaje, terminar la certificación."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="targetDate"
          label="Fecha objetivo (opcional)"
          type="date"
          defaultValue={v("targetDate", goal?.target_date ?? "")}
          error={state.fieldErrors?.targetDate}
        />
        <SelectField
          name="lifeAreaId"
          label="Dimensión (opcional)"
          placeholder="Sin dimensión"
          defaultValue={v("lifeAreaId", goal?.life_area_id ?? "")}
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
          error={state.fieldErrors?.lifeAreaId}
        />
      </div>
      {hasMilestones ? null : (
        <TextField
          name="manualProgress"
          label="Avance (%)"
          type="number"
          inputMode="numeric"
          min="0"
          max="100"
          step="1"
          defaultValue={v("manualProgress", String(goal?.manual_progress ?? 0))}
          error={state.fieldErrors?.manualProgress}
          hint="Si añades hitos, el avance se calcula solo con ellos."
        />
      )}
      <TextareaField
        name="description"
        label="Descripción (opcional)"
        rows={3}
        maxLength={2000}
        defaultValue={v("description", goal?.description ?? "")}
        error={state.fieldErrors?.description}
      />
      <SubmitButton pendingText="Guardando…">{goal ? "Guardar cambios" : "Crear objetivo"}</SubmitButton>
    </form>
  );
}

export function GoalFormDialog({
  goal,
  areas,
  hasMilestones = false,
  trigger,
}: {
  goal?: GoalRow;
  areas: LifeAreaRow[];
  hasMilestones?: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar objetivo" : "Nuevo objetivo"}</DialogTitle>
          <DialogDescription>Algo que quieres lograr, con o sin fecha.</DialogDescription>
        </DialogHeader>
        <GoalForm goal={goal} areas={areas} hasMilestones={hasMilestones} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
