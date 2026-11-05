import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { Activity, CalendarCheck, Dumbbell, Plus, Weight } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addDays, formatDate, instantToLocalInput, todayIn } from "@/lib/utils/date";
import {
  exerciseProgress,
  formatKg,
  monthStart,
  sessionsThisWeek,
  setsVolume,
  weeklySessionCounts,
} from "@/lib/fitness/stats";
import { getRoutineForMonth, listSessions } from "@/features/fitness/queries";
import { SessionFormDialog } from "@/features/fitness/components/session-form-dialog";
import { SessionRow } from "@/features/fitness/components/session-row";
import { WeeklyChart } from "@/features/fitness/components/weekly-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Entrenamiento" };

const WEEKS = 8;
/** 60 días cubren las 8 semanas del gráfico y la comparación 30 vs 30 días anteriores. */
const WINDOW_DAYS = 60;

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function FitnessPage({ searchParams }: PageProps<"/fitness">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <FitnessContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FitnessContent({ searchParams }: { searchParams: PageProps<"/fitness">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";

  const ctx = await getWorkspaceContext();
  const { timezone } = ctx.profile;
  const today = todayIn(timezone);

  if (archived) {
    const sessions = await listSessions(ctx.workspace.id, { archived: true, limit: 100 });
    return (
      <>
        <PageHeader title="Entrenamiento" description="Entrenamientos archivados. Puedes restaurarlos." />
        <ViewTabs archived />
        {sessions.length === 0 ? (
          <EmptyState icon={Dumbbell} title="No tienes entrenamientos archivados" />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Entrenamientos archivados">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} routine={null} timezone={timezone} />
            ))}
          </ul>
        )}
      </>
    );
  }

  const [sessions, routine] = await Promise.all([
    listSessions(ctx.workspace.id, { sinceDate: addDays(today, -(WINDOW_DAYS - 1)) }),
    getRoutineForMonth(ctx.workspace.id, monthStart(today)),
  ]);

  const last30From = addDays(today, -29);
  const last30 = sessions.filter((s) => s.started_date >= last30From);
  const volume30 = setsVolume(last30.flatMap((s) => s.exercises.flatMap((e) => e.sets)));

  const weeks = weeklySessionCounts(sessions, today, WEEKS);
  const progress = exerciseProgress(
    sessions.flatMap((s) =>
      s.exercises.map((e) => ({
        name: e.name,
        date: s.started_date,
        volume: setsVolume(e.sets),
        maxWeight: e.sets.reduce<number | null>(
          (max, set) => (set.weight_kg !== null && (max === null || set.weight_kg > max) ? set.weight_kg : max),
          null,
        ),
      })),
    ),
    today,
  );

  const defaultStartedAt = instantToLocalInput(new Date(), timezone);

  return (
    <>
      <PageHeader
        title="Entrenamiento"
        description="Registra tus sesiones, series y pesos, y mira cómo evolucionas."
        actions={
          <SessionFormDialog
            routine={routine}
            timezone={timezone}
            defaultStartedAt={defaultStartedAt}
            trigger={
              <Button>
                <Plus aria-hidden />
                Registrar entrenamiento
              </Button>
            }
          />
        }
      />

      <ViewTabs archived={false} />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Esta semana" value={sessionsThisWeek(sessions, today)} icon={CalendarCheck} />
        <StatCard label="Últimos 30 días" value={last30.length} icon={Activity} />
        <StatCard label="Volumen (30 días)" value={volume30 > 0 ? formatKg(volume30) : "—"} icon={Weight} />
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        Volumen = suma de repeticiones × peso de todas las series. Las series de peso corporal no suman carga.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Entrenamientos por semana</CardTitle>
          <CardDescription>Últimas {WEEKS} semanas (lunes a domingo).</CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyChart data={weeks.map((w) => ({ label: formatDate(w.weekStart).slice(0, 5), sessions: w.sessions }))} />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            {weeks.map((w) => (
              <li key={w.weekStart} className="flex justify-between tabular-nums">
                <span>Sem. {formatDate(w.weekStart).slice(0, 5)}</span>
                <span className="font-medium text-foreground">{w.sessions}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Progreso por ejercicio</CardTitle>
          <CardDescription>Volumen de los últimos 30 días frente a los 30 anteriores.</CardDescription>
        </CardHeader>
        <CardContent>
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Registra ejercicios con series para ver su evolución.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Ejercicio</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Sesiones</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Peso máx.</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Volumen</th>
                    <th scope="col" className="py-2 text-right font-medium">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.slice(0, 15).map((p) => (
                    <tr key={p.key} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">{p.name}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.sessions}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.maxWeight === null ? "—" : formatKg(p.maxWeight)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.volume > 0 ? formatKg(p.volume) : "—"}</td>
                      <td className="py-2 text-right">
                        {p.changePct === null ? (
                          <span className="text-muted-foreground">Sin datos previos</span>
                        ) : (
                          <Badge tone={p.changePct > 0 ? "success" : p.changePct < 0 ? "warning" : "neutral"}>
                            {p.changePct > 0 ? "+" : ""}
                            {p.changePct}%
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Entrenamientos recientes
      </h2>
      {sessions.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Aún no registras entrenamientos"
          description="Registra tu primera sesión; puedes partir de tu rutina del mes."
          action={
            <Link href="/fitness/routines" className="text-sm font-medium text-primary hover:underline">
              Ir a Rutinas
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Entrenamientos recientes">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} routine={routine} timezone={timezone} />
          ))}
        </ul>
      )}
    </>
  );
}

function ViewTabs({ archived }: { archived: boolean }) {
  return (
    <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
      <Link
        href="/fitness"
        aria-current={archived ? undefined : "page"}
        className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}
      >
        Recientes
      </Link>
      <span aria-hidden className="text-muted-foreground">·</span>
      <Link
        href="/fitness?archived=1"
        aria-current={archived ? "page" : undefined}
        className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}
      >
        Archivados
      </Link>
    </nav>
  );
}
