import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Pencil, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import {
  addMonths,
  exercisesForDay,
  formatKg,
  monthLabel,
  monthStart,
  trainingDays,
  weekdayName,
} from "@/lib/fitness/stats";
import { monthParamSchema } from "@/lib/validations/fitness";
import { getRoutineForMonth, listArchivedRoutines, listRoutineMonths } from "@/features/fitness/queries";
import { RoutineActions } from "@/features/fitness/components/routine-actions";
import { RoutineFormDialog } from "@/features/fitness/components/routine-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Rutinas" };

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function RoutinesPage({ searchParams }: PageProps<"/fitness/routines">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <RoutinesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RoutinesContent({ searchParams }: { searchParams: PageProps<"/fitness/routines">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";

  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const currentMonth = monthStart(today);

  if (archived) {
    const routines = await listArchivedRoutines(ctx.workspace.id);
    return (
      <>
        <PageHeader title="Rutinas" description="Rutinas archivadas. Puedes restaurarlas." />
        <ViewTabs archived />
        {routines.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tienes rutinas archivadas" />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Rutinas archivadas">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{monthLabel(r.period_month)}</p>
                </div>
                <RoutineActions routineId={r.id} nextMonth={addMonths(r.period_month, 1)} archived label={r.name} />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // Mes consultado: ?month=YYYY-MM, por defecto el actual.
  const parsedMonth = monthParamSchema.safeParse(first(raw.month));
  const month = parsedMonth.success ? `${parsedMonth.data}-01` : currentMonth;
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  const [routine, months] = await Promise.all([
    getRoutineForMonth(ctx.workspace.id, month),
    listRoutineMonths(ctx.workspace.id),
  ]);
  const days = routine ? trainingDays(routine.exercises) : [];

  return (
    <>
      <PageHeader
        title="Rutinas"
        description="Una rutina por mes: planifica qué entrenas cada día de la semana."
        actions={
          !routine ? (
            <RoutineFormDialog
              month={month}
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nueva rutina
                </Button>
              }
            />
          ) : undefined
        }
      />
      <ViewTabs archived={false} />

      <nav aria-label="Mes" className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/fitness/routines?month=${prev.slice(0, 7)}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <div className="text-center">
          <p className="font-medium capitalize">{monthLabel(month)}</p>
          {month === currentMonth ? (
            <p className="text-xs text-muted-foreground">Mes actual</p>
          ) : (
            <Link href="/fitness/routines" className="text-xs font-medium text-primary hover:underline">
              Ir al mes actual
            </Link>
          )}
        </div>
        <Link
          href={`/fitness/routines?month=${next.slice(0, 7)}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Mes siguiente"
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>

      {!routine ? (
        <EmptyState
          icon={CalendarDays}
          title={`Sin rutina para ${monthLabel(month)}`}
          description="Crea una nueva o duplica la del mes anterior desde su pantalla."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{routine.name}</h2>
              {routine.description ? (
                <p className="mt-1 max-w-prose whitespace-pre-line break-words text-sm text-muted-foreground">
                  {routine.description}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {days.length === 0
                  ? "Sin ejercicios planificados."
                  : `Entrenas ${days.length} ${days.length === 1 ? "día" : "días"} a la semana.`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <RoutineFormDialog
                routine={routine}
                month={month}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                }
              />
              <RoutineActions routineId={routine.id} nextMonth={next} label={routine.name} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {days.map((d) => (
              <Card key={d}>
                <CardHeader>
                  <CardTitle className="text-base">{weekdayName(d)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {exercisesForDay(routine.exercises, d).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium">{e.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {e.target_sets} × {e.target_reps}
                          {e.target_weight_kg !== null ? ` · ${formatKg(e.target_weight_kg)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {months.length > 0 ? (
        <section aria-label="Meses con rutina" className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Meses con rutina</h2>
          <ul className="flex flex-wrap gap-2">
            {months.map((m) => (
              <li key={m}>
                <Link href={`/fitness/routines?month=${m.slice(0, 7)}`} aria-current={m === month ? "page" : undefined}>
                  <Badge tone={m === month ? "primary" : "neutral"} className="capitalize">
                    {monthLabel(m)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function ViewTabs({ archived }: { archived: boolean }) {
  return (
    <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
      <Link
        href="/fitness/routines"
        aria-current={archived ? undefined : "page"}
        className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}
      >
        Por mes
      </Link>
      <span aria-hidden className="text-muted-foreground">·</span>
      <Link
        href="/fitness/routines?archived=1"
        aria-current={archived ? "page" : undefined}
        className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}
      >
        Archivadas
      </Link>
    </nav>
  );
}
