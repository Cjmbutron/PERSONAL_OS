"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ListTodo, Pencil } from "lucide-react";
import { setProjectArchived } from "@/features/projects/actions";
import { PROJECT_STATUS_LABELS } from "@/lib/constants/labels";
import { formatDate, isOverdue } from "@/lib/utils/date";
import type { LifeAreaRow, ProjectRow, ProjectStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectFormDialog } from "./project-form-dialog";

const STATUS_TONE: Record<ProjectStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  on_hold: "warning",
  completed: "neutral",
};

export function ProjectCard({
  project,
  areas,
  stats,
  today,
}: {
  project: ProjectRow;
  areas: LifeAreaRow[];
  stats: { total: number; completed: number };
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const archived = project.archived_at !== null;
  const percent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
  const overdue = project.status !== "completed" && isOverdue(project.due_date, today);

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setProjectArchived(project.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li>
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="break-words">{project.name}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
              {archived ? <Badge>Archivado</Badge> : null}
              {project.due_date ? (
                <Badge tone={overdue ? "danger" : "neutral"}>
                  {overdue ? "Vencido · " : "Hasta "}
                  {formatDate(project.due_date)}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {project.description ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{project.description}</p>
          ) : null}

          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {stats.total === 0
                  ? "Sin tareas todavía"
                  : `${stats.completed} de ${stats.total} tareas completadas`}
              </span>
              {stats.total > 0 ? <span>{percent}%</span> : null}
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={`Progreso de ${project.name}`}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/work/tasks?project=${project.id}&status=all`}>
                <ListTodo aria-hidden />
                Ver tareas
              </Link>
            </Button>
            <div className="ml-auto flex items-center gap-1">
              {!archived ? (
                <ProjectFormDialog
                  project={project}
                  areas={areas}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar “${project.name}”`}>
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
                aria-label={`${archived ? "Restaurar" : "Archivar"} “${project.name}”`}
              >
                {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
