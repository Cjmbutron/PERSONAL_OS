import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Target } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addDays, formatDate, todayIn } from "@/lib/utils/date";
import { listEvents, listGoals } from "@/features/personal/queries";
import { listTasks } from "@/features/tasks/queries";
import { EventRowView } from "@/features/personal/components/event-row";
import { ProgressBar } from "@/features/personal/components/goal-card";
import { goalPercent } from "@/lib/personal/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Vida personal" };

export default function PersonalPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <GridSkeleton />
        </>
      }
    >
      <PersonalContent />
    </Suspense>
  );
}

async function PersonalContent() {
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const personalArea = ctx.lifeAreas.find((a) => a.code === "PERSONAL");

  const [events, goals, personalTasks] = await Promise.all([
    listEvents(ctx.workspace.id, today, addDays(today, 14)),
    listGoals(ctx.workspace.id, { status: "active" }),
    personalArea
      ? listTasks(ctx.workspace.id, { status: "open", archived: false }).then((all) => all.filter((t) => t.life_area_id === personalArea.id))
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Vida personal" description="Tus próximos eventos, objetivos en curso y pendientes personales." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos 14 días</CardTitle>
            <CardDescription>Eventos de tu calendario.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin eventos próximos" />
            ) : (
              <ul className="flex flex-col gap-2">
                {events.slice(0, 6).map((e) => (
                  <EventRowView key={e.id} event={e} areas={ctx.lifeAreas} today={today} timezone={ctx.profile.timezone} />
                ))}
              </ul>
            )}
            <Link href="/personal/calendar" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Abrir calendario
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objetivos en curso</CardTitle>
            <CardDescription>Avance según tus hitos.</CardDescription>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <EmptyState icon={Target} title="Aún no tienes objetivos en curso" />
            ) : (
              <ul className="flex flex-col gap-3">
                {goals.slice(0, 5).map((g) => {
                  const p = goalPercent(g.manual_progress, g.milestonesTotal, g.milestonesDone);
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium">{g.title}</span>
                        <span className="tabular-nums text-muted-foreground">{p}%</span>
                      </div>
                      <ProgressBar percent={p} label={`Avance de ${g.title}`} />
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/personal/goals" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Ver objetivos
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pendientes personales</CardTitle>
            <CardDescription>Tareas abiertas de la dimensión Vida personal.</CardDescription>
          </CardHeader>
          <CardContent>
            {personalTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes tareas personales abiertas. Crea una tarea en <Link href="/work/tasks" className="font-medium text-primary hover:underline">Trabajo</Link> y asígnale la dimensión Vida personal.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {personalTasks.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href="/work/tasks" className="min-w-0 truncate text-sm hover:underline">
                      {t.title}
                    </Link>
                    {t.due_date ? <Badge tone={t.due_date < today ? "danger" : "neutral"}>{formatDate(t.due_date)}</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
