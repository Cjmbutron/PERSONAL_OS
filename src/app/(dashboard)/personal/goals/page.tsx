import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { Plus, Target } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import { listGoals } from "@/features/personal/queries";
import { GoalCard } from "@/features/personal/components/goal-card";
import { GoalFormDialog } from "@/features/personal/components/goal-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Objetivos" };

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

export default function GoalsPage({ searchParams }: PageProps<"/personal/goals">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <GridSkeleton />
        </>
      }
    >
      <GoalsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function GoalsContent({ searchParams }: { searchParams: PageProps<"/personal/goals">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(Array.isArray(raw.archived) ? raw.archived[0] : raw.archived) === "1";
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const goals = await listGoals(ctx.workspace.id, { archived });

  const open = goals.filter((g) => g.status === "active" || g.status === "paused");
  const closed = goals.filter((g) => g.status === "completed" || g.status === "cancelled");

  const grid = (title: string, list: typeof goals) =>
    list.length > 0 ? (
      <section aria-label={title} className="mt-8 first:mt-0">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} areas={ctx.lifeAreas} today={today} />
          ))}
        </div>
      </section>
    ) : null;

  return (
    <>
      <PageHeader
        title={archived ? "Objetivos archivados" : "Objetivos"}
        description="Lo que quieres lograr. El avance se calcula con tus hitos."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={archived ? "/personal/goals" : "/personal/goals?archived=1"}>{archived ? "Ver activos" : "Ver archivados"}</Link>
            </Button>
            {archived ? null : (
              <GoalFormDialog
                areas={ctx.lifeAreas}
                trigger={
                  <Button>
                    <Plus aria-hidden />
                    Nuevo objetivo
                  </Button>
                }
              />
            )}
          </>
        }
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={archived ? "No tienes objetivos archivados" : "Aún no tienes objetivos"}
          description={archived ? undefined : "Define algo que quieras lograr y divídelo en hitos para ver tu avance."}
        />
      ) : (
        <>
          {grid(archived ? "Abiertos" : "En curso y en pausa", open)}
          {grid("Cerrados", closed)}
        </>
      )}
    </>
  );
}
