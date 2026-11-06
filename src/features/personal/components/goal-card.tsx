"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Pause, Pencil, Play, Plus, X } from "lucide-react";
import { addMilestone, deleteMilestone, setGoalArchived, setGoalStatus, setMilestoneDone } from "@/features/personal/actions";
import type { GoalWithProgress } from "@/features/personal/queries";
import { GOAL_STATUS_LABELS } from "@/lib/constants/labels";
import { daysUntil, goalPercent } from "@/lib/personal/calendar";
import { formatDate } from "@/lib/utils/date";
import type { GoalStatus, LifeAreaRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { GoalFormDialog } from "./goal-form-dialog";

const TONE: Record<GoalStatus, "primary" | "neutral" | "success" | "danger"> = {
  active: "primary",
  paused: "neutral",
  completed: "success",
  cancelled: "neutral",
};

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function GoalCard({ goal, areas, today }: { goal: GoalWithProgress; areas: LifeAreaRow[]; today: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const archived = goal.archived_at !== null;
  const percent = goalPercent(goal.manual_progress, goal.milestonesTotal, goal.milestonesDone, goal.status);
  const area = areas.find((a) => a.id === goal.life_area_id);
  const left = daysUntil(goal.target_date, today);
  const open = goal.status === "active" || goal.status === "paused";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
      else after?.();
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">{goal.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {area ? <span>{area.name}</span> : null}
            {goal.target_date ? (
              <span>
                Meta: {formatDate(goal.target_date)}
                {open && left !== null ? (left < 0 ? ` · venció hace ${-left} d` : left === 0 ? " · hoy" : ` · faltan ${left} d`) : ""}
              </span>
            ) : null}
          </p>
        </div>
        <Badge tone={TONE[goal.status]}>{GOAL_STATUS_LABELS[goal.status]}</Badge>
      </div>

      {goal.description ? <p className="text-sm text-muted-foreground">{goal.description}</p> : null}

      <div className="flex items-center gap-3">
        <ProgressBar percent={percent} label={`Avance de ${goal.title}`} />
        <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">{percent}%</span>
      </div>

      {goal.milestones.length > 0 || (open && !archived) ? (
        <div>
          {goal.milestones.length > 0 ? (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Hitos · {goal.milestonesDone} de {goal.milestonesTotal}
            </p>
          ) : null}
          <ul className="flex flex-col">
            {goal.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--color-primary)]"
                  checked={m.done}
                  disabled={pending || archived}
                  aria-label={`Hito: ${m.title}`}
                  onChange={(e) => run(() => setMilestoneDone(m.id, e.target.checked))}
                />
                <span className={m.done ? "min-w-0 flex-1 text-sm text-muted-foreground line-through" : "min-w-0 flex-1 text-sm"}>{m.title}</span>
                {!archived ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={`Quitar hito ${m.title}`}
                    onClick={() => run(() => deleteMilestone(m.id))}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {open && !archived ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = inputRef.current?.value ?? "";
                if (!value.trim()) return;
                run(() => addMilestone(goal.id, value), () => {
                  if (inputRef.current) inputRef.current.value = "";
                });
              }}
            >
              <Input ref={inputRef} maxLength={150} placeholder="Añadir hito…" aria-label={`Nuevo hito para ${goal.title}`} />
              <Button type="submit" variant="outline" size="icon" disabled={pending} aria-label="Añadir hito">
                <Plus aria-hidden />
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-2">
        {!archived ? (
          <>
            {goal.status === "active" ? (
              <>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setGoalStatus(goal.id, "completed"))}>
                  <Check aria-hidden />
                  Completar
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setGoalStatus(goal.id, "paused"))}>
                  <Pause aria-hidden />
                  Pausar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setGoalStatus(goal.id, "active"))}>
                <Play aria-hidden />
                {goal.status === "paused" ? "Reanudar" : "Reabrir"}
              </Button>
            )}
            {goal.status !== "cancelled" && goal.status !== "completed" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setGoalStatus(goal.id, "cancelled"))}>
                Cancelar
              </Button>
            ) : null}
            <GoalFormDialog
              goal={goal}
              areas={areas}
              hasMilestones={goal.milestonesTotal > 0}
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${goal.title}`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
          </>
        ) : null}
        <ArchiveButton action={setGoalArchived} id={goal.id} archived={archived} label={goal.title} />
      </div>
    </Card>
  );
}
