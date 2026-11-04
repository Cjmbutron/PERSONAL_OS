"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { setTaskArchived, setTaskStatus } from "@/features/tasks/actions";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants/labels";
import { cn } from "@/lib/utils/cn";
import { formatDate, isOverdue } from "@/lib/utils/date";
import type { LifeAreaRow, TaskRow as Task } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./task-form-dialog";
import type { ProjectOption } from "./task-form";

const PRIORITY_TONE = { low: "neutral", medium: "neutral", high: "warning", urgent: "danger" } as const;

export function TaskRow({
  task,
  projectName,
  projects,
  areas,
  today,
}: {
  task: Task;
  projectName?: string;
  projects: ProjectOption[];
  areas: LifeAreaRow[];
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [status, setOptimisticStatus] = useOptimistic(task.status);

  const archived = task.archived_at !== null;
  const done = status === "completed";
  const open = status === "pending" || status === "in_progress";
  const overdue = open && isOverdue(task.due_date, today);
  const dueToday = open && task.due_date === today;

  function toggle(checked: boolean) {
    setError(undefined);
    startTransition(async () => {
      setOptimisticStatus(checked ? "completed" : "pending");
      const result = await setTaskStatus(task.id, checked ? "completed" : "pending");
      if (!result.ok) setError(result.message);
    });
  }

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setTaskArchived(task.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
      <input
        type="checkbox"
        checked={done}
        disabled={archived || pending}
        onChange={(e) => toggle(e.target.checked)}
        aria-label={`Marcar “${task.title}” como ${done ? "pendiente" : "completada"}`}
        className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
      />

      <div className="min-w-0 flex-1">
        <p className={cn("break-words font-medium", (done || status === "cancelled") && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
          {status === "in_progress" || status === "cancelled" ? (
            <Badge tone="primary">{TASK_STATUS_LABELS[status]}</Badge>
          ) : null}
          {projectName ? <Badge>{projectName}</Badge> : null}
          {task.due_date ? (
            <Badge tone={overdue ? "danger" : dueToday ? "warning" : "neutral"}>
              {/* Texto además del color: la urgencia no depende solo del color (RNF-09). */}
              {overdue ? "Vencida · " : dueToday ? "Hoy · " : ""}
              {formatDate(task.due_date)}
            </Badge>
          ) : null}
          {archived ? <Badge>Archivada</Badge> : null}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!archived ? (
          <TaskFormDialog
            task={task}
            projects={projects}
            areas={areas}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Editar “${task.title}”`}>
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
          aria-label={`${archived ? "Restaurar" : "Archivar"} “${task.title}”`}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        </Button>
      </div>
    </li>
  );
}
