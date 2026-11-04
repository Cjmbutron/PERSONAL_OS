import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, Moon, Plus, Star, Target } from "lucide-react";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { buildSleepSeries, formatDuration, summarizeSleep } from "@/lib/sleep/stats";
import { addDays, formatDate, todayIn } from "@/lib/utils/date";
import { listSleepRecords } from "@/features/sleep/queries";
import { SleepChart } from "@/features/sleep/components/sleep-chart";
import { SleepFormDialog } from "@/features/sleep/components/sleep-form-dialog";
import { SleepGoalForm } from "@/features/sleep/components/sleep-goal-form";
import { SleepRow } from "@/features/sleep/components/sleep-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Sueño" };

const RANGES = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
] as const;

const paramsSchema = z.object({
  range: z.enum(["7", "30", "90"]).catch("30"),
  archived: z
    .enum(["1"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
});

function first(raw: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

export default function SleepPage({ searchParams }: PageProps<"/sleep">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <SleepContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SleepContent({ searchParams }: { searchParams: PageProps<"/sleep">["searchParams"] }) {
  const { range, archived } = paramsSchema.parse(first(await searchParams));
  const days = Number(range);

  const ctx = await getWorkspaceContext();
  const { timezone, sleep_goal_hours: goalHours } = ctx.profile;
  const today = todayIn(timezone);
  const goalMinutes = Math.round(goalHours * 60);

  const records = archived
    ? await listSleepRecords(ctx.workspace.id, { archived: true })
    : await listSleepRecords(ctx.workspace.id, { sinceDate: addDays(today, -(days - 1)) });

  const summary = summarizeSleep(records, goalMinutes);
  const series = buildSleepSeries(records, today, days).map((d) => ({
    date: d.date,
    label: formatDate(d.date).slice(0, 5),
    hours: d.minutes === null ? null : Math.round((d.minutes / 60) * 10) / 10,
  }));

  return (
    <>
      <PageHeader
        title="Sueño"
        description={archived ? "Registros archivados. Puedes restaurarlos." : "Cuánto y qué tan bien descansas."}
        actions={
          archived ? null : (
            <SleepFormDialog
              timezone={timezone}
              today={today}
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Registrar sueño
                </Button>
              }
            />
          )
        }
      />

      <nav aria-label="Vista" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex gap-2">
          <Link
            href="/sleep"
            aria-current={archived ? undefined : "page"}
            className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}
          >
            Activos
          </Link>
          <span aria-hidden className="text-muted-foreground">·</span>
          <Link
            href="/sleep?archived=1"
            aria-current={archived ? "page" : undefined}
            className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}
          >
            Archivados
          </Link>
        </div>
        {archived ? null : (
          <div className="flex gap-1" role="group" aria-label="Periodo">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={r.value === "30" ? "/sleep" : `/sleep?range=${r.value}`}
                aria-current={range === r.value ? "true" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  range === r.value ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {archived ? null : (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Promedio por noche" value={summary.avgMinutes === null ? "—" : formatDuration(summary.avgMinutes)} icon={Moon} />
            <StatCard
              label="Calidad media"
              value={summary.avgQuality === null ? "—" : `${summary.avgQuality} / 5`}
              icon={Star}
            />
            <StatCard
              label="Noches con la meta"
              value={`${summary.goalMet} de ${summary.nights}`}
              icon={Target}
              tone={summary.nights > 0 && summary.goalMet === summary.nights ? "success" : "neutral"}
            />
            <StatCard label={`Días con registro (de ${days})`} value={summary.nights} icon={CalendarCheck} />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Horas dormidas</CardTitle>
                <CardDescription>Últimos {days} días, con tu meta de {goalHours} h.</CardDescription>
              </CardHeader>
              <CardContent>
                <SleepChart data={series} goalHours={goalHours} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tu meta</CardTitle>
                <CardDescription>Sirve de referencia en los indicadores.</CardDescription>
              </CardHeader>
              <CardContent>
                <SleepGoalForm goalHours={goalHours} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registros</h2>
      {records.length === 0 ? (
        <EmptyState
          icon={Moon}
          title={archived ? "No tienes registros archivados" : "Aún no hay registros en este periodo"}
          description={archived ? undefined : "Registra cuándo te acostaste y cuándo despertaste para ver tu tendencia."}
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Registros de sueño">
          {records.map((record) => (
            <SleepRow key={record.id} record={record} timezone={timezone} today={today} goalMinutes={goalMinutes} />
          ))}
        </ul>
      )}
    </>
  );
}
