"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAY_NAMES } from "@/lib/fitness/stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newKey } from "./exercises-editor";

export type PlannedExercise = {
  key: string;
  day: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  notes: string;
};

const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function plannedFromRows(
  rows: readonly {
    day_of_week: number;
    name: string;
    target_sets: number;
    target_reps: number;
    target_weight_kg: number | null;
    notes: string | null;
  }[],
): PlannedExercise[] {
  return rows.map((r) => ({
    key: newKey(),
    day: r.day_of_week,
    name: r.name,
    sets: String(r.target_sets),
    reps: String(r.target_reps),
    weight: num(r.target_weight_kg),
    notes: r.notes ?? "",
  }));
}

/** El orden dentro de cada día es el de la lista; las filas completamente vacías se descartan. */
export function serializePlanned(items: readonly PlannedExercise[]): string {
  return JSON.stringify(
    items
      .filter((e) => e.name.trim())
      .map((e) => ({
        day_of_week: e.day,
        name: e.name,
        target_sets: e.sets,
        target_reps: e.reps,
        target_weight_kg: e.weight,
        notes: e.notes,
      })),
  );
}

/** Editor semanal: un bloque por día de la semana (D-35). Los días con ejercicios son los de entrenamiento. */
export function RoutineEditor({ initial }: { initial: PlannedExercise[] }) {
  const [items, setItems] = useState<PlannedExercise[]>(initial);
  const uid = useId();

  const update = (key: string, patch: Partial<PlannedExercise>) =>
    setItems((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const add = (day: number) =>
    setItems((list) => [...list, { key: newKey(), day, name: "", sets: "3", reps: "10", weight: "", notes: "" }]);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Ejercicios por día</legend>
      <input type="hidden" name="exercisesJson" value={serializePlanned(items)} />

      {WEEKDAY_NAMES.map((dayName, i) => {
        const day = i + 1;
        const rows = items.filter((e) => e.day === day);
        return (
          <section key={day} aria-label={dayName} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{dayName}</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => add(day)}>
                <Plus aria-hidden />
                Ejercicio
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Día de descanso.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {rows.map((r) => {
                  const base = `${uid}-${r.key}`;
                  return (
                    <li key={r.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_4.5rem_4.5rem_6rem_auto]">
                      <Input
                        aria-label={`${dayName}: nombre del ejercicio`}
                        value={r.name}
                        maxLength={120}
                        placeholder="Ej.: Sentadilla"
                        onChange={(e) => update(r.key, { name: e.target.value })}
                        className="col-span-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="sm:order-last"
                        aria-label={`Quitar ${r.name || "el ejercicio"} del ${dayName.toLowerCase()}`}
                        onClick={() => setItems((l) => l.filter((e) => e.key !== r.key))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                      <div className="col-span-2 grid grid-cols-3 gap-2 sm:contents">
                        <Input
                          id={`${base}-sets`}
                          aria-label={`${r.name || "Ejercicio"}: series`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          placeholder="Series"
                          value={r.sets}
                          onChange={(e) => update(r.key, { sets: e.target.value })}
                        />
                        <Input
                          aria-label={`${r.name || "Ejercicio"}: repeticiones`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={1000}
                          placeholder="Reps"
                          value={r.reps}
                          onChange={(e) => update(r.key, { reps: e.target.value })}
                        />
                        <Input
                          aria-label={`${r.name || "Ejercicio"}: peso objetivo en kilos`}
                          type="number"
                          inputMode="decimal"
                          step={0.5}
                          min={0}
                          max={1000}
                          placeholder="kg"
                          value={r.weight}
                          onChange={(e) => update(r.key, { weight: e.target.value })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">Series × repeticiones y peso objetivo (opcional).</p>
    </fieldset>
  );
}
