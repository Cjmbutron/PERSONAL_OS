import type { Metadata } from "next";
import { Suspense } from "react";
import { ListChecks, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { taskFiltersSchema } from "@/lib/validations/work";
import { todayIn } from "@/lib/utils/date";
import { listTasks } from "@/features/tasks/queries";
import { listProjects } from "@/features/projects/queries";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { TaskRow } from "@/features/tasks/components/task-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Tareas" };

/** Los parámetros de búsqueda pueden llegar como arreglo: se toma el primer valor. */
function firstValues(raw: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

export default function TasksPage({ searchParams }: PageProps<"/work/tasks">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <TasksContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TasksContent({ searchParams }: { searchParams: PageProps<"/work/tasks">["searchParams"] }) {
  const filters = taskFiltersSchema.parse(firstValues(await searchParams));
  const ctx = await getWorkspaceContext();
  const [tasks, projects] = await Promise.all([
    listTasks(ctx.workspace.id, filters),
    listProjects(ctx.workspace.id),
  ]);

  const today = todayIn(ctx.profile.timezone);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const filtered =
    filters.status !== "open" || filters.priority || filters.project || filters.archived;

  return (
    <>
      <PageHeader
        title="Tareas"
        description={filters.archived ? "Tareas archivadas." : "Lo que tienes por hacer, ordenado por vencimiento."}
        actions={
          <TaskFormDialog
            projects={projects}
            areas={ctx.lifeAreas}
            defaultProjectId={filters.project && filters.project !== "none" ? filters.project : undefined}
            trigger={
              <Button>
                <Plus aria-hidden />
                Nueva tarea
              </Button>
            }
          />
        }
      />

      <TaskFilters filters={filters} projects={projects} />

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filtered ? "No hay tareas con estos filtros" : "Aún no tienes tareas"}
          description={
            filtered
              ? "Prueba cambiando o limpiando los filtros."
              : "Crea tu primera tarea para empezar a organizar tu día."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Lista de tareas">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectName={task.project_id ? projectNames.get(task.project_id) : undefined}
              projects={projects}
              areas={ctx.lifeAreas}
              today={today}
            />
          ))}
        </ul>
      )}
    </>
  );
}
