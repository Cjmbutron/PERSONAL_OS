import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addDays, todayIn } from "@/lib/utils/date";
import { canReviewWeek, normalizeWeek, weekLabel, weekStart } from "@/lib/personal/weekly";
import { listGoals } from "@/features/personal/queries";
import { getReview, getWeekSummary, listLinkableTasks, listPriorities, listReviews } from "@/features/review/queries";
import { PriorityList } from "@/features/review/components/priority-list";
import { ReviewForm } from "@/features/review/components/review-form";
import { WeekSummaryView } from "@/features/review/components/week-summary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Revisión semanal" };

export default function ReviewPage({ searchParams }: PageProps<"/review">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <GridSkeleton />
        </>
      }
    >
      <ReviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewContent({ searchParams }: { searchParams: PageProps<"/review">["searchParams"] }) {
  const raw = await searchParams;
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const thisWeek = weekStart(today);
  const param = Array.isArray(raw.week) ? raw.week[0] : raw.week;
  // Por defecto se revisa la semana que acaba de terminar, o la actual si es lunes y aún no hay nada que revisar.
  const week = normalizeWeek(param) ?? addDays(thisWeek, -7);
  const nextWeek = addDays(week, 7);
  const reviewable = canReviewWeek(week, today);

  const [review, summary, nextPriorities, thisPriorities, tasks, goals, history] = await Promise.all([
    getReview(ctx.workspace.id, week),
    reviewable ? getWeekSummary(ctx.workspace.id, ctx.profile.timezone, ctx.profile.sleep_goal_hours, week, today) : Promise.resolve(null),
    listPriorities(ctx.workspace.id, nextWeek),
    listPriorities(ctx.workspace.id, week),
    listLinkableTasks(ctx.workspace.id),
    listGoals(ctx.workspace.id, { status: "active" }),
    listReviews(ctx.workspace.id, 8),
  ]);

  const href = (w: string) => `/review?week=${w}`;
  const linkOptions = [
    ...tasks.map((t) => ({ value: `task:${t.id}`, label: `Tarea · ${t.title}` })),
    ...goals.map((g) => ({ value: `goal:${g.id}`, label: `Objetivo · ${g.title}` })),
  ];

  return (
    <>
      <PageHeader title="Revisión semanal" description="Mira cómo te fue en la semana y decide qué importa en la siguiente." />

      <MonthNav
        label={weekLabel(week)}
        prevHref={href(addDays(week, -7))}
        nextHref={href(addDays(week, 7))}
        currentHref={week !== addDays(thisWeek, -7) ? "/review" : undefined}
      />

      {!reviewable ? (
        <p role="status" className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Esta semana aún no empieza: todavía no hay nada que revisar. Puedes definir sus prioridades más abajo.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {summary ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumen de la semana</CardTitle>
              <CardDescription>Calculado con lo que registraste; no se puede editar.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeekSummaryView summary={summary} />
            </CardContent>
          </Card>
        ) : null}

        {reviewable ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Tu revisión
                {review ? <Badge tone={review.status === "completed" ? "success" : "neutral"}>{review.status === "completed" ? "Completada" : "Borrador"}</Badge> : null}
              </CardTitle>
              <CardDescription>Observaciones de la semana {weekLabel(week)}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewForm key={`${week}-${review?.updated_at ?? "new"}`} week={week} review={review} />
              {thisPriorities.length > 0 ? (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="mb-1 text-sm font-medium">Prioridades que te habías puesto</h3>
                  <PriorityList week={week} priorities={thisPriorities} editable={false} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Prioridades de la semana siguiente</CardTitle>
            <CardDescription>
              {weekLabel(nextWeek)} · hasta 5. Aparecen en tu dashboard esa semana.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityList key={nextWeek} week={nextWeek} priorities={nextPriorities} linkOptions={linkOptions} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes revisiones guardadas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={href(r.week_start)} className="text-sm font-medium hover:underline">
                      {weekLabel(r.week_start)}
                    </Link>
                    <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status === "completed" ? "Completada" : "Borrador"}</Badge>
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
