import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Flame, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import { getHabitViews } from "@/features/habits/queries";
import { HabitFormDialog } from "@/features/habits/components/habit-form-dialog";
import { HabitRow } from "@/features/habits/components/habit-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Hábitos" };

export default function HabitsPage({ searchParams }: PageProps<"/habits">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <HabitsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HabitsContent({ searchParams }: { searchParams: PageProps<"/habits">["searchParams"] }) {
  const raw = (await searchParams).archived;
  const archived = (Array.isArray(raw) ? raw[0] : raw) === "1";

  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const views = await getHabitViews(ctx.workspace.id, today, archived);
  const areaNames = new Map(ctx.lifeAreas.map((a) => [a.id, a.name]));

  // Pendientes de hoy primero; luego los cumplidos; al final los que hoy no tocan.
  const rank = (v: (typeof views)[number]) => (v.dueToday && !v.doneToday ? 0 : v.doneToday ? 1 : 2);
  const ordered = archived ? views : [...views].sort((a, b) => rank(a) - rank(b));
  const dueCount = views.filter((v) => v.dueToday).length;
  const doneCount = views.filter((v) => v.dueToday && v.doneToday).length;

  return (
    <>
      <PageHeader
        title="Hábitos"
        description={
          archived
            ? "Hábitos archivados. Puedes restaurarlos."
            : views.length > 0
              ? `Hoy: ${doneCount} de ${dueCount} cumplidos.`
              : "Registra lo que quieres sostener en el tiempo."
        }
        actions={
          archived ? null : (
            <HabitFormDialog
              areas={ctx.lifeAreas}
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nuevo hábito
                </Button>
              }
            />
          )
        }
      />

      {!archived && dueCount > 0 ? (
        <div className="mb-4" role="progressbar" aria-valuemin={0} aria-valuemax={dueCount} aria-valuenow={doneCount} aria-label="Hábitos cumplidos hoy">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[var(--area-habits)] transition-all" style={{ width: `${Math.round((doneCount / dueCount) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {doneCount === dueCount ? "Hoy cumpliste todos tus hábitos." : `Te faltan ${dueCount - doneCount} por marcar hoy.`}
          </p>
        </div>
      ) : null}

      <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
        <Link
          href="/habits"
          aria-current={archived ? undefined : "page"}
          className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}
        >
          Activos
        </Link>
        <span aria-hidden className="text-muted-foreground">·</span>
        <Link
          href="/habits?archived=1"
          aria-current={archived ? "page" : undefined}
          className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Archivados
        </Link>
      </nav>

      {views.length === 0 ? (
        <EmptyState
          icon={Flame}
          title={archived ? "No tienes hábitos archivados" : "Aún no tienes hábitos"}
          description={
            archived ? undefined : "Crea tu primer hábito y márcalo cada día para construir una racha."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Lista de hábitos">
          {ordered.map((view) => (
            <HabitRow
              key={view.habit.id}
              view={view}
              areas={ctx.lifeAreas}
              today={today}
              areaName={view.habit.life_area_id ? areaNames.get(view.habit.life_area_id) : undefined}
            />
          ))}
        </ul>
      )}
    </>
  );
}
