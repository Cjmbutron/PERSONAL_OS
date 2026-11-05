"use client";

import { useActionState } from "react";
import { createMeal, updateMeal } from "@/features/nutrition/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { MEAL_TYPE_LABELS } from "@/lib/constants/labels";
import { instantToLocalInput } from "@/lib/utils/date";
import { MEAL_TYPES, type MealLogRow, type MealType } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export function MealForm({
  meal,
  timezone,
  defaultEatenAt,
  defaultType,
  onDone,
}: {
  meal?: MealLogRow;
  timezone: string;
  /** Hora local sugerida para una comida nueva ("YYYY-MM-DDTHH:mm"). */
  defaultEatenAt: string;
  defaultType: MealType;
  onDone: () => void;
}) {
  const editing = Boolean(meal);

  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await (editing ? updateMeal : createMeal)(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={meal!.id} /> : null}
      <FormMessage message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="mealType"
          label="Tipo de comida"
          required
          defaultValue={v("mealType", meal?.meal_type ?? defaultType)}
          options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_TYPE_LABELS[t] }))}
          error={state.fieldErrors?.mealType}
        />
        <TextField
          name="eatenAt"
          label="Fecha y hora"
          type="datetime-local"
          required
          defaultValue={v("eatenAt", meal ? instantToLocalInput(meal.eaten_at, timezone) : defaultEatenAt)}
          error={state.fieldErrors?.eatenAt}
        />
      </div>

      <TextareaField
        name="description"
        label="¿Qué comiste?"
        required
        maxLength={500}
        autoFocus
        defaultValue={v("description", meal?.description ?? "")}
        error={state.fieldErrors?.description}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          Datos nutricionales <span className="font-normal text-muted-foreground">(opcionales)</span>
        </legend>
        <p className="-mt-1 text-xs text-muted-foreground">
          Déjalos vacíos si no los conoces. Vacío significa “sin dato”, no cero.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextField
            name="calories"
            label="Calorías"
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            defaultValue={v("calories", num(meal?.calories))}
            error={state.fieldErrors?.calories}
          />
          <TextField
            name="proteinG"
            label="Proteínas (g)"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={0}
            max={2000}
            defaultValue={v("proteinG", num(meal?.protein_g))}
            error={state.fieldErrors?.proteinG}
          />
          <TextField
            name="carbsG"
            label="Carbohidratos (g)"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={0}
            max={2000}
            defaultValue={v("carbsG", num(meal?.carbs_g))}
            error={state.fieldErrors?.carbsG}
          />
          <TextField
            name="fatG"
            label="Grasas (g)"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={0}
            max={2000}
            defaultValue={v("fatG", num(meal?.fat_g))}
            error={state.fieldErrors?.fatG}
          />
        </div>
      </fieldset>

      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Registrar comida"}</SubmitButton>
    </form>
  );
}
