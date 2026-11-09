"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { saveWorkoutSession } from "@/features/fitness/actions";
import type { RoutineDetail, SessionDetail } from "@/features/fitness/queries";
import { initialActionState, type ActionState } from "@/lib/actions";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants/labels";
import { exercisesForDay, isoDayOfWeek, trainingDays, weekdayName } from "@/lib/fitness/stats";
import { instantToLocalInput } from "@/lib/utils/date";
import { WORKOUT_TYPES } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  SessionExercisesEditor,
  exercisesFromRoutineDay,
  exercisesFromSession,
  type EditorExercise,
} from "./exercises-editor";

export function SessionForm({
  session,
  routine,
  timezone,
  defaultStartedAt,
  onDone,
}: {
  session?: SessionDetail;
  /** Rutina vigente del mes: permite entrenar desde ella (D-37). */
  routine: RoutineDetail | null;
  timezone: string;
  /** Hora local sugerida para una sesión nueva ("YYYY-MM-DDTHH:mm"). */
  defaultStartedAt: string;
  onDone: () => void;
}) {
  const editing = Boolean(session);

  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveWorkoutSession(prev, formData);
      if (result.ok) {
        toast("Sesión guardada");
        onDone();
      }
      return result;
    },
    initialActionState,
  );

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

  const days = routine ? trainingDays(routine.exercises) : [];
  const startedAt = v("startedAt", session ? instantToLocalInput(session.started_at, timezone) : defaultStartedAt);

  // Al elegir un día de la rutina se reemplazan los ejercicios (con la clave se reinicia el editor).
  const initialDay = session?.routine_day ?? null;
  const [routineDay, setRoutineDay] = useState<string>(
    session ? (session.routine_id && initialDay ? String(initialDay) : "") : "",
  );
  const [exercises, setExercises] = useState<EditorExercise[]>(session ? exercisesFromSession(session.exercises) : []);
  const [editorVersion, setEditorVersion] = useState(0);

  function chooseDay(value: string) {
    setRoutineDay(value);
    if (!routine) return;
    if (value === "") return;
    const planned = exercisesForDay(routine.exercises, Number(value));
    setExercises(exercisesFromRoutineDay(planned));
    setEditorVersion((n) => n + 1);
  }

  const suggestedDay = isoDayOfWeek(startedAt.slice(0, 10));
  const linkedRoutineId = routineDay !== "" && routine ? routine.id : session?.routine_id && routineDay !== "" ? session.routine_id : "";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={session!.id} /> : null}
      <input type="hidden" name="routineId" value={linkedRoutineId} />
      <input type="hidden" name="routineDay" value={linkedRoutineId ? routineDay : ""} />
      <FormMessage message={state.message} />

      {routine && days.length > 0 ? (
        <SelectField
          name="routineDayPicker"
          label={`Entrenar desde la rutina “${routine.name}”`}
          value={routineDay}
          onChange={(e) => chooseDay(e.target.value)}
          placeholder="Sin rutina (sesión libre)"
          hint={
            days.includes(suggestedDay)
              ? `Hoy toca: ${weekdayName(suggestedDay)}. Se precargan los ejercicios; ajusta lo que realmente hiciste.`
              : "Se precargan los ejercicios del día elegido; ajusta lo que realmente hiciste."
          }
          options={days.map((d) => ({ value: String(d), label: weekdayName(d) }))}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="type"
          label="Tipo"
          required
          defaultValue={v("type", session?.type ?? "strength")}
          options={WORKOUT_TYPES.map((t) => ({ value: t, label: WORKOUT_TYPE_LABELS[t] }))}
          error={state.fieldErrors?.type}
        />
        <TextField
          name="startedAt"
          label="Inicio"
          type="datetime-local"
          required
          defaultValue={startedAt}
          error={state.fieldErrors?.startedAt}
        />
        <TextField
          name="durationMinutes"
          label="Duración (min)"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          defaultValue={v("durationMinutes", num(session?.duration_minutes))}
          error={state.fieldErrors?.durationMinutes}
        />
        <TextField
          name="rpe"
          label="Esfuerzo percibido (1–10)"
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          defaultValue={v("rpe", num(session?.rpe))}
          error={state.fieldErrors?.rpe}
          hint="1 = muy suave, 10 = máximo esfuerzo."
        />
      </div>

      <SessionExercisesEditor key={editorVersion} initial={exercises} />

      <TextareaField
        name="notes"
        label="Notas"
        maxLength={1000}
        defaultValue={v("notes", session?.notes ?? "")}
        error={state.fieldErrors?.notes}
      />

      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Registrar entrenamiento"}</SubmitButton>
    </form>
  );
}
