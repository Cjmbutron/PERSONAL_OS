"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EditorSet = { reps: string; weight: string };
export type EditorExercise = {
  key: string;
  name: string;
  notes: string;
  distance: string;
  duration: string;
  sets: EditorSet[];
};

let counter = 0;
export const newKey = () => `ex-${Date.now().toString(36)}-${counter++}`;

export const emptyExercise = (): EditorExercise => ({
  key: newKey(),
  name: "",
  notes: "",
  distance: "",
  duration: "",
  sets: [{ reps: "", weight: "" }],
});

/**
 * Convierte el estado del editor en el JSON del campo oculto. Se descartan filas completamente vacías;
 * lo incompleto (p. ej. peso sin repeticiones) se envía tal cual para que el servidor lo señale.
 */
export function serializeExercises(exercises: readonly EditorExercise[]): string {
  const out = exercises
    .filter((e) => e.name.trim() || e.sets.some((s) => s.reps.trim() || s.weight.trim()))
    .map((e) => ({
      name: e.name,
      notes: e.notes,
      distance_km: e.distance,
      duration_min: e.duration,
      sets: e.sets.filter((s) => s.reps.trim() || s.weight.trim()).map((s) => ({ reps: s.reps, weight_kg: s.weight })),
    }));
  return JSON.stringify(out);
}

const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function exercisesFromSession(
  exercises: readonly {
    name: string;
    notes: string | null;
    distance_km: number | null;
    duration_min: number | null;
    sets: readonly { reps: number; weight_kg: number | null }[];
  }[],
): EditorExercise[] {
  return exercises.map((e) => ({
    key: newKey(),
    name: e.name,
    notes: e.notes ?? "",
    distance: num(e.distance_km),
    duration: num(e.duration_min),
    sets: e.sets.map((s) => ({ reps: String(s.reps), weight: num(s.weight_kg) })),
  }));
}

/** D-37: precarga los ejercicios planificados con sus series objetivo; el usuario ajusta lo realmente hecho. */
export function exercisesFromRoutineDay(
  planned: readonly { name: string; notes: string | null; target_sets: number; target_reps: number; target_weight_kg: number | null }[],
): EditorExercise[] {
  return planned.map((p) => ({
    key: newKey(),
    name: p.name,
    notes: "",
    distance: "",
    duration: "",
    sets: Array.from({ length: p.target_sets }, () => ({ reps: String(p.target_reps), weight: num(p.target_weight_kg) })),
  }));
}

export function SessionExercisesEditor({
  initial,
  error,
}: {
  initial: EditorExercise[];
  error?: string;
}) {
  const [items, setItems] = useState<EditorExercise[]>(initial);
  const uid = useId();

  const update = (key: string, patch: Partial<EditorExercise>) =>
    setItems((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const setSet = (key: string, index: number, patch: Partial<EditorSet>) =>
    setItems((list) =>
      list.map((e) => (e.key === key ? { ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : e)),
    );

  const addSet = (key: string) =>
    setItems((list) =>
      list.map((e) => {
        if (e.key !== key) return e;
        const last = e.sets[e.sets.length - 1];
        // Copia la serie anterior: lo habitual es repetir peso y repeticiones.
        return { ...e, sets: [...e.sets, last ? { ...last } : { reps: "", weight: "" }] };
      }),
    );

  const removeSet = (key: string, index: number) =>
    setItems((list) => list.map((e) => (e.key === key ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">
        Ejercicios y series <span className="font-normal text-muted-foreground">(opcional)</span>
      </legend>
      <input type="hidden" name="exercisesJson" value={serializeExercises(items)} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no añadiste ejercicios.</p>
      ) : null}

      {items.map((ex, exIndex) => {
        const base = `${uid}-${ex.key}`;
        return (
          <div key={ex.key} className="rounded-lg border border-border p-3">
            <div className="flex items-end gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`${base}-name`} className="text-xs font-medium text-muted-foreground">
                  Ejercicio {exIndex + 1}
                </label>
                <Input
                  id={`${base}-name`}
                  value={ex.name}
                  maxLength={120}
                  placeholder="Ej.: Press banca"
                  onChange={(e) => update(ex.key, { name: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar el ejercicio ${ex.name || exIndex + 1}`}
                onClick={() => setItems((list) => list.filter((e) => e.key !== ex.key))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>

            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-12 pb-1 font-medium">Serie</th>
                  <th className="pb-1 font-medium">Reps</th>
                  <th className="pb-1 font-medium">Peso (kg)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((s, i) => (
                  <tr key={i}>
                    <td className="py-1 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <Input
                        aria-label={`${ex.name || "Ejercicio"}, serie ${i + 1}: repeticiones`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={1000}
                        value={s.reps}
                        onChange={(e) => setSet(ex.key, i, { reps: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        aria-label={`${ex.name || "Ejercicio"}, serie ${i + 1}: peso en kilos (vacío = peso corporal)`}
                        type="number"
                        inputMode="decimal"
                        step={0.5}
                        min={0}
                        max={1000}
                        placeholder="Corporal"
                        value={s.weight}
                        onChange={(e) => setSet(ex.key, i, { weight: e.target.value })}
                      />
                    </td>
                    <td className="py-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar la serie ${i + 1} de ${ex.name || "este ejercicio"}`}
                        onClick={() => removeSet(ex.key, i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addSet(ex.key)}>
                <Plus aria-hidden />
                Serie
              </Button>
              <span className="text-xs text-muted-foreground">Copia la anterior. Peso vacío = peso corporal.</span>
            </div>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Cardio y notas del ejercicio
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${base}-dist`} className="text-xs text-muted-foreground">Distancia (km)</label>
                  <Input
                    id={`${base}-dist`}
                    type="number"
                    inputMode="decimal"
                    step={0.01}
                    min={0}
                    max={1000}
                    value={ex.distance}
                    onChange={(e) => update(ex.key, { distance: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${base}-dur`} className="text-xs text-muted-foreground">Duración (min)</label>
                  <Input
                    id={`${base}-dur`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1440}
                    value={ex.duration}
                    onChange={(e) => update(ex.key, { duration: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor={`${base}-notes`} className="text-xs text-muted-foreground">Notas</label>
                  <Input
                    id={`${base}-notes`}
                    value={ex.notes}
                    maxLength={500}
                    onChange={(e) => update(ex.key, { notes: e.target.value })}
                  />
                </div>
              </div>
            </details>
          </div>
        );
      })}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setItems((l) => [...l, emptyExercise()])}>
          <Plus aria-hidden />
          Añadir ejercicio
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : null}
    </fieldset>
  );
}
