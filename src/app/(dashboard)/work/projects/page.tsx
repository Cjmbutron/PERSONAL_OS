import type { Metadata } from "next";
import { Suspense } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import { getProjectTaskStats, listProjects } from "@/features/projects/queries";
import { ProjectCard } from "@/features/projects/components/project-card";
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Proyectos" };

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <GridSkeleton />
        </>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}

async function ProjectsContent() {
  const ctx = await getWorkspaceContext();
  const [projects, stats] = await Promise.all([
    listProjects(ctx.workspace.id),
    getProjectTaskStats(ctx.workspace.id),
  ]);
  const today = todayIn(ctx.profile.timezone);

  const current = projects.filter((p) => p.archived_at === null);
  const archived = projects.filter((p) => p.archived_at !== null);

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Agrupa tus tareas y sigue el avance de cada objetivo."
        actions={
          <ProjectFormDialog
            areas={ctx.lifeAreas}
            trigger={
              <Button>
                <Plus aria-hidden />
                Nuevo proyecto
              </Button>
            }
          />
        }
      />

      {current.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no tienes proyectos"
          description="Crea un proyecto para agrupar tareas relacionadas y ver su progreso."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Proyectos">
          {current.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              areas={ctx.lifeAreas}
              stats={stats.get(p.id) ?? { total: 0, completed: 0 }}
              today={today}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Proyectos archivados ({archived.length})
          </summary>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Proyectos archivados">
            {archived.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                areas={ctx.lifeAreas}
                stats={stats.get(p.id) ?? { total: 0, completed: 0 }}
                today={today}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
