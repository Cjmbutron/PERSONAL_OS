"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { saveWorkoutRoutine } from "@/features/fitness/actions";
import type { RoutineDetail } from "@/features/fitness/queries";
import { initialActionState, type ActionState } from "@/lib/actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { RoutineEditor, plannedFromRows } from "./routine-editor";

function RoutineForm({ routine, month, onDone }: { routine?: RoutineDetail; month: string; onDone: () => void }) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveWorkoutRoutine(prev, formData);
      if (result.ok) {
        toast("Rutina guardada");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {routine ? <input type="hidden" name="id" value={routine.id} /> : null}
      <FormMessage message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          label="Nombre"
          required
          maxLength={100}
          autoFocus
          defaultValue={v("name", routine?.name ?? "")}
          error={state.fieldErrors?.name}
        />
        <TextField
          name="periodMonth"
          label="Mes"
          type="month"
          required
          defaultValue={v("periodMonth", (routine?.period_month ?? month).slice(0, 7))}
          error={state.fieldErrors?.periodMonth}
          hint="Una rutina por mes."
        />
      </div>
      <TextareaField
        name="description"
        label="Descripción"
        maxLength={1000}
        defaultValue={v("description", routine?.description ?? "")}
        error={state.fieldErrors?.description}
      />
      <RoutineEditor initial={routine ? plannedFromRows(routine.exercises) : []} />
      <SubmitButton pendingText="Guardando…">{routine ? "Guardar cambios" : "Crear rutina"}</SubmitButton>
    </form>
  );
}

export function RoutineFormDialog({
  routine,
  month,
  trigger,
}: {
  routine?: RoutineDetail;
  /** Mes (YYYY-MM-01) sugerido para una rutina nueva. */
  month: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{routine ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>Planifica los ejercicios de cada día de la semana para el mes.</DialogDescription>
        </DialogHeader>
        <RoutineForm routine={routine} month={month} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
