"use client";

import { useActionState } from "react";
import { saveReview } from "@/features/review/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { WeeklyReviewRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/shared/fields";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";

export function ReviewForm({ week, review }: { week: string; review: WeeklyReviewRow | null }) {
  const [state, formAction] = useActionState(saveReview, initialActionState as ActionState);
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const completed = review?.status === "completed";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="week" value={week} />
      {state.ok && state.message ? (
        <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : (
        <FormMessage message={state.message} />
      )}
      <TextareaField
        name="wentWell"
        label="¿Qué salió bien?"
        rows={3}
        maxLength={2000}
        defaultValue={v("wentWell", review?.went_well ?? "")}
        error={state.fieldErrors?.wentWell}
      />
      <TextareaField
        name="toImprove"
        label="¿Qué mejorar?"
        rows={3}
        maxLength={2000}
        defaultValue={v("toImprove", review?.to_improve ?? "")}
        error={state.fieldErrors?.toImprove}
      />
      <TextareaField
        name="learnings"
        label="Aprendizajes"
        rows={3}
        maxLength={2000}
        defaultValue={v("learnings", review?.learnings ?? "")}
        error={state.fieldErrors?.learnings}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="complete" pendingText="Guardando…">
          {completed ? "Guardar cambios" : "Completar revisión"}
        </SubmitButton>
        {completed ? null : (
          <Button type="submit" name="intent" value="draft" variant="outline">
            Guardar borrador
          </Button>
        )}
      </div>
      {completed ? <p className="text-xs text-muted-foreground">Esta revisión está completada; puedes seguir editándola.</p> : null}
    </form>
  );
}
