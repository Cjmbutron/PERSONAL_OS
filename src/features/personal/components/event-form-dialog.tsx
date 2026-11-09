"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { saveEvent } from "@/features/personal/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { instantToLocalInput } from "@/lib/utils/date";
import type { CalendarEventRow, LifeAreaRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function EventForm({
  event,
  areas,
  today,
  timezone,
  defaultDate,
  onDone,
}: {
  event?: CalendarEventRow;
  areas: LifeAreaRow[];
  today: string;
  timezone: string;
  defaultDate?: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveEvent(prev, formData);
      if (result.ok) {
        toast("Evento guardado");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const [kind, setKind] = useState<string>(state.values?.kind ?? (event?.all_day ? "allday" : event ? "timed" : "timed"));

  const day = defaultDate ?? today;
  const startsAt = event?.starts_at ? instantToLocalInput(event.starts_at, timezone) : `${day}T09:00`;
  const endsAt = event?.ends_at ? instantToLocalInput(event.ends_at, timezone) : `${day}T10:00`;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <FormMessage message={state.message} />
      <TextField
        name="title"
        label="Título"
        required
        maxLength={150}
        autoFocus
        defaultValue={v("title", event?.title ?? "")}
        error={state.fieldErrors?.title}
      />
      <SelectField
        name="kind"
        label="Tipo"
        required
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        options={[
          { value: "timed", label: "Con hora" },
          { value: "allday", label: "Todo el día" },
        ]}
      />
      {kind === "timed" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="startsAt"
            label="Inicio"
            type="datetime-local"
            required
            defaultValue={v("startsAt", startsAt)}
            error={state.fieldErrors?.startsAt}
          />
          <TextField
            name="endsAt"
            label="Fin"
            type="datetime-local"
            required
            defaultValue={v("endsAt", endsAt)}
            error={state.fieldErrors?.endsAt}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="startDate"
            label="Desde"
            type="date"
            required
            defaultValue={v("startDate", event?.start_date ?? day)}
            error={state.fieldErrors?.startDate}
          />
          <TextField
            name="endDate"
            label="Hasta (incluido)"
            type="date"
            required
            defaultValue={v("endDate", event?.end_date ?? day)}
            error={state.fieldErrors?.endDate}
          />
        </div>
      )}
      <TextField
        name="location"
        label="Lugar (opcional)"
        maxLength={200}
        defaultValue={v("location", event?.location ?? "")}
        error={state.fieldErrors?.location}
      />
      <SelectField
        name="lifeAreaId"
        label="Dimensión (opcional)"
        placeholder="Sin dimensión"
        defaultValue={v("lifeAreaId", event?.life_area_id ?? "")}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
        error={state.fieldErrors?.lifeAreaId}
      />
      <TextareaField
        name="description"
        label="Notas (opcional)"
        rows={3}
        maxLength={2000}
        defaultValue={v("description", event?.description ?? "")}
        error={state.fieldErrors?.description}
      />
      <SubmitButton pendingText="Guardando…">{event ? "Guardar cambios" : "Crear evento"}</SubmitButton>
    </form>
  );
}

export function EventFormDialog({
  event,
  areas,
  today,
  timezone,
  defaultDate,
  trigger,
  defaultOpen = false,
}: {
  event?: CalendarEventRow;
  areas: LifeAreaRow[];
  today: string;
  timezone: string;
  defaultDate?: string;
  trigger: React.ReactNode;
  /** Abre el formulario al montar (lo usa el registro rápido). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) clearQuickParam();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>Un compromiso con hora o de todo el día.</DialogDescription>
        </DialogHeader>
        <EventForm event={event} areas={areas} today={today} timezone={timezone} defaultDate={defaultDate} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
