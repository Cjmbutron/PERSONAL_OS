"use client";

import { useActionState, useState } from "react";
import { createHabit, updateHabit } from "@/features/habits/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { HABIT_FREQUENCY_LABELS, WEEKDAY_LABELS } from "@/lib/constants/labels";
import { HABIT_FREQUENCIES, type HabitFrequency, type HabitRow, type LifeAreaRow } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function HabitForm({
  habit,
  areas,
  onDone,
}: {
  habit?: HabitRow;
  areas: LifeAreaRow[];
  onDone: () => void;
}) {
  const editing = Boolean(habit);

  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await (editing ? updateHabit : createHabit)(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );

  // Estado controlado: React 19 reinicia los campos no controlados tras cada envío,
  // y aquí el usuario no debe perder la frecuencia que eligió si hay un error.
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency_type ?? "daily");
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? []);
  const [target, setTarget] = useState(String(habit?.target_per_week ?? 3));

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  function toggleDay(day: number, checked: boolean) {
    setDays((prev) => (checked ? [...new Set([...prev, day])] : prev.filter((d) => d !== day)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={habit!.id} /> : null}
      <FormMessage message={state.message} />

      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={100}
        autoFocus
        placeholder="Ej.: Leer 20 minutos"
        defaultValue={v("name", habit?.name ?? "")}
        error={state.fieldErrors?.name}
      />
      <TextareaField
        name="description"
        label="Descripción"
        maxLength={1000}
        defaultValue={v("description", habit?.description ?? "")}
        error={state.fieldErrors?.description}
      />

      <SelectField
        name="frequencyType"
        label="Frecuencia"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
        options={HABIT_FREQUENCIES.map((f) => ({ value: f, label: HABIT_FREQUENCY_LABELS[f] }))}
        error={state.fieldErrors?.frequencyType}
      />

      {frequency === "days_of_week" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Días de la semana</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const checked = days.includes(day);
              return (
                <label
                  key={day}
                  title={WEEKDAY_LABELS[day].long}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={day}
                    checked={checked}
                    onChange={(e) => toggleDay(day, e.target.checked)}
                    className="sr-only"
                  />
                  <span aria-hidden>{WEEKDAY_LABELS[day].short}</span>
                  <span className="sr-only">{WEEKDAY_LABELS[day].long}</span>
                </label>
              );
            })}
          </div>
          {state.fieldErrors?.daysOfWeek?.length ? (
            <p role="alert" className="text-xs text-destructive">
              {state.fieldErrors.daysOfWeek[0]}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {frequency === "times_per_week" ? (
        <TextField
          name="targetPerWeek"
          label="Veces por semana"
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          hint="Cuenta los días distintos en que lo cumples, de lunes a domingo."
          error={state.fieldErrors?.targetPerWeek}
        />
      ) : null}

      <SelectField
        name="lifeAreaId"
        label="Dimensión"
        placeholder="Sin dimensión"
        defaultValue={v("lifeAreaId", habit?.life_area_id ?? "")}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
        error={state.fieldErrors?.lifeAreaId}
      />

      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Crear hábito"}</SubmitButton>
    </form>
  );
}
