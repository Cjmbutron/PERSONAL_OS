"use client";

import Link from "next/link";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants/labels";
import { PRIORITIES, TASK_STATUSES } from "@/types/database";
import type { TaskFilters as Filters } from "@/lib/validations/work";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ProjectOption } from "./task-form";

/**
 * Filtros como formulario GET: funciona sin JavaScript (botón "Filtrar") y,
 * con JavaScript, se aplica al cambiar cualquier selector.
 */
export function TaskFilters({ filters, projects }: { filters: Filters; projects: ProjectOption[] }) {
  const hasFilters =
    filters.status !== "open" || Boolean(filters.priority) || Boolean(filters.project) || filters.archived;

  return (
    <form
      method="get"
      action="/work/tasks"
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="mb-5 flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-status" className="text-xs text-muted-foreground">Estado</Label>
        <Select id="f-status" name="status" defaultValue={filters.status} className="h-9 w-40">
          <option value="open">Abiertas</option>
          <option value="all">Todas</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-priority" className="text-xs text-muted-foreground">Prioridad</Label>
        <Select id="f-priority" name="priority" defaultValue={filters.priority ?? ""} className="h-9 w-36">
          <option value="">Todas</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-project" className="text-xs text-muted-foreground">Proyecto</Label>
        <Select id="f-project" name="project" defaultValue={filters.project ?? ""} className="h-9 w-48">
          <option value="">Todos</option>
          <option value="none">Sin proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.archived_at ? " (archivado)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="archived"
          value="1"
          defaultChecked={filters.archived}
          className="size-4 accent-[var(--primary)]"
        />
        Ver archivadas
      </label>
      <Button type="submit" variant="secondary" size="sm" className="h-9">
        Filtrar
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href="/work/tasks">Limpiar</Link>
        </Button>
      ) : null}
    </form>
  );
}
