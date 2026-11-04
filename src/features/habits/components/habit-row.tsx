"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Check, Flame, Pencil } from "lucide-react";
import { setHabitArchived, setHabitLog } from "@/features/habits/actions";
import { WEEKDAY_LABELS } from "@/lib/constants/labels";
import type { HabitView } from "@/lib/habits/overview";
import { isoWeekday } from "@/lib/habits/streaks";
import { cn } from "@/lib/utils/cn";
import { formatDate, isoWeekdayLabel } from "@/lib/utils/date";
import type { LifeAreaRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HabitFormDialog } from "./habit-form-dialog";

type Recent = HabitView["recent"];

function scheduleLabel(view: HabitView): string {
  const s = view.schedule;
  if (s.type === "daily") return "Todos los días";
  if (s.type === "times_per_week") return `${s.target} ${s.target === 1 ? "vez" : "veces"} por semana`;
  return [...s.days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d].long.slice(0, 3))
    .join(", ");
}

function streakLabel(view: HabitView): string {
  const { current, unit } = view.streak;
  if (unit === "weeks") return `${current} ${current === 1 ? "semana" : "semanas"}`;
  return `${current} ${current === 1 ? "día" : "días"}`;
}

export function HabitRow({
  view,
  areas,
  today,
  areaName,
}: {
  view: HabitView;
  areas: LifeAreaRow[];
  today: string;
  areaName?: string;
}) {
  const { habit } = view;
  const archived = habit.archived_at !== null;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [recent, setOptimistic] = useOptimistic(view.recent, (state: Recent, change: { date: string; done: boolean }) =>
    state.map((d) => (d.date === change.date ? { ...d, done: change.done } : d)),
  );

  const doneToday = recent.find((d) => d.date === today)?.done ?? false;

  function toggleDay(date: string, done: boolean) {
    setError(undefined);
    startTransition(async () => {
      setOptimistic({ date, done });
      const result = await setHabitLog(habit.id, date, done);
      if (!result.ok) setError(result.message);
    });
  }

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setHabitArchived(habit.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={doneToday}
          aria-label={`Marcar “${habit.name}” como ${doneToday ? "no cumplido" : "cumplido"} hoy`}
          disabled={archived || pending}
          onClick={() => toggleDay(today, !doneToday)}
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            doneToday ? "border-success bg-success text-white" : "border-border hover:border-primary",
          )}
        >
          {doneToday ? <Check className="size-4" aria-hidden /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{habit.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{scheduleLabel(view)}</Badge>
            {areaName ? <Badge>{areaName}</Badge> : null}
            {view.streak.current > 0 ? (
              <Badge tone="warning">
                <Flame className="size-3" aria-hidden />
                Racha {streakLabel(view)}
              </Badge>
            ) : null}
            {view.schedule.type === "times_per_week" ? (
              <Badge tone={view.weekDone >= view.schedule.target ? "success" : "primary"}>
                {view.weekDone}/{view.schedule.target} esta semana
              </Badge>
            ) : null}
            {archived ? <Badge>Archivado</Badge> : null}
          </div>
          {view.streak.best > view.streak.current ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Mejor racha: {view.streak.best} {view.streak.unit === "weeks" ? "sem." : "días"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!archived ? (
            <HabitFormDialog
              habit={habit}
              areas={areas}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Editar “${habit.name}”`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleArchive}
            disabled={pending}
            aria-label={`${archived ? "Restaurar" : "Archivar"} “${habit.name}”`}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </div>
      </div>

      {!archived ? (
        <ul className="mt-3 flex gap-1.5 pl-11" aria-label={`Últimos 7 días de “${habit.name}”`}>
          {recent.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                role="checkbox"
                aria-checked={d.done}
                aria-label={`${isoWeekdayLabel(d.date)} ${formatDate(d.date)}${d.date === today ? " (hoy)" : ""}`}
                title={`${isoWeekdayLabel(d.date)} ${formatDate(d.date)}${d.scheduled ? "" : " · no programado"}`}
                disabled={pending}
                onClick={() => toggleDay(d.date, !d.done)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                  d.done
                    ? "border-success bg-success/15 text-success"
                    : d.scheduled
                      ? "border-border text-muted-foreground hover:bg-muted"
                      : "border-dashed border-border/60 text-muted-foreground/50 hover:bg-muted",
                  d.date === today && "ring-1 ring-primary",
                )}
              >
                {d.done ? <Check className="size-3.5" aria-hidden /> : WEEKDAY_LABELS[isoWeekday(d.date)].short}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 pl-11 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
