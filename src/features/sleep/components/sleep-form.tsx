"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState } from "react";
import { createSleepRecord, updateSleepRecord } from "@/features/sleep/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { SLEEP_QUALITY_LABELS } from "@/lib/constants/labels";
import { addDays, instantToLocalInput } from "@/lib/utils/date";
import type { SleepRecordRow } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export function SleepForm({
  record,
  timezone,
  today,
  onDone,
}: {
  record?: SleepRecordRow;
  timezone: string;
  today: string;
  onDone: () => void;
}) {
  const editing = Boolean(record);

  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await (editing ? updateSleepRecord : createSleepRecord)(prev, formData);
      if (result.ok) {
        toast("Sueño guardado");
        onDone();
      }
      return result;
    },
    initialActionState,
  );

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  // Valores iniciales sugeridos para un registro nuevo: anoche a las 23:00 → hoy a las 07:00.
  const defaultBed = record ? instantToLocalInput(record.bedtime, timezone) : `${addDays(today, -1)}T23:00`;
  const defaultWake = record ? instantToLocalInput(record.wake_time, timezone) : `${today}T07:00`;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={record!.id} /> : null}
      <FormMessage message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="bedtime"
          label="Me acosté"
          type="datetime-local"
          required
          defaultValue={v("bedtime", defaultBed)}
          error={state.fieldErrors?.bedtime}
        />
        <TextField
          name="wakeTime"
          label="Desperté"
          type="datetime-local"
          required
          defaultValue={v("wakeTime", defaultWake)}
          error={state.fieldErrors?.wakeTime}
        />
      </div>

      <SelectField
        name="quality"
        label="Calidad percibida"
        placeholder="Sin valorar"
        defaultValue={v("quality", record?.quality ? String(record.quality) : "")}
        options={Object.entries(SLEEP_QUALITY_LABELS).map(([value, label]) => ({
          value,
          label: `${value} · ${label}`,
        }))}
        error={state.fieldErrors?.quality}
      />

      <TextareaField
        name="notes"
        label="Observaciones"
        maxLength={1000}
        defaultValue={v("notes", record?.notes ?? "")}
        error={state.fieldErrors?.notes}
      />

      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Registrar sueño"}</SubmitButton>
    </form>
  );
}
