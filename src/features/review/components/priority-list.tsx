"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Plus, Target, X } from "lucide-react";
import { addPriority, deletePriority, setPriorityDone } from "@/features/review/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { WeeklyPriorityRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/shared/fields";
import { FormMessage } from "@/components/shared/form-message";

export const MAX_PRIORITIES = 5;

export type LinkOption = { value: string; label: string };

/** Lista de prioridades de una semana, con casilla de cumplida; con `editable` permite añadir y quitar. */
export function PriorityList({
  week,
  priorities,
  linkOptions = [],
  editable = true,
}: {
  week: string;
  priorities: WeeklyPriorityRow[];
  linkOptions?: LinkOption[];
  editable?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await addPriority(prev, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    initialActionState,
  );

  function run(fn: () => Promise<ActionState>) {
    setError(undefined);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <div>
      {priorities.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay prioridades para esta semana.</p> : null}
      <ul className="flex flex-col">
        {priorities.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-[var(--color-primary)]"
              checked={p.done}
              disabled={pending}
              aria-label={`Prioridad: ${p.title}`}
              onChange={(e) => run(() => setPriorityDone(p.id, e.target.checked))}
            />
            <span className={p.done ? "min-w-0 flex-1 text-sm text-muted-foreground line-through" : "min-w-0 flex-1 text-sm"}>
              {p.title}
              {p.goal_id ? <Target className="ml-1 inline size-3 text-muted-foreground" aria-label="Objetivo" /> : null}
            </span>
            {editable ? (
              <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Quitar ${p.title}`} onClick={() => run(() => deletePriority(p.id))}>
                <X aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {editable && priorities.length < MAX_PRIORITIES ? (
        <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-3 border-t border-border pt-3" noValidate>
          <input type="hidden" name="week" value={week} />
          <FormMessage message={state.message} />
          <TextField
            name="title"
            label="Nueva prioridad"
            maxLength={150}
            placeholder="Ej.: Entregar la propuesta del cliente"
            error={state.fieldErrors?.title}
            defaultValue={state.values?.title ?? ""}
          />
          {linkOptions.length > 0 ? (
            <SelectField
              name="link"
              label="Vincular a (opcional)"
              placeholder="Sin vínculo"
              options={linkOptions}
              error={state.fieldErrors?.link}
              defaultValue={state.values?.link ?? ""}
            />
          ) : null}
          <div>
            <Button type="submit" variant="outline">
              <Plus aria-hidden />
              Añadir prioridad
            </Button>
          </div>
        </form>
      ) : editable ? (
        <p className="mt-2 text-xs text-muted-foreground">Máximo {MAX_PRIORITIES} prioridades por semana.</p>
      ) : null}
    </div>
  );
}
