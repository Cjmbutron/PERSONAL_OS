import { getWorkspaceContext } from "@/lib/auth/session";
import { getTrends } from "@/features/review/trends";
import { formatDate, todayIn } from "@/lib/utils/date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniBars } from "./mini-bars";

export function TrendsSkeleton() {
  return <Skeleton className="mt-6 h-52" />;
}

/** Cómo vienen las últimas 4 semanas. Se carga aparte para no retrasar el resto del dashboard. */
export async function TrendsCard() {
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const t = await getTrends(ctx.workspace.id, ctx.profile.timezone, today);
  const labels = t.weeks.map((w) => formatDate(w).slice(0, 5));
  const n = (v: number) => String(v);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Últimas 4 semanas</CardTitle>
        <CardDescription>Cada barra es una semana (desde el lunes); la última es la actual.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          <MiniBars title="Tareas completadas" area="work" values={t.tasks} labels={labels} format={n} />
          <MiniBars title="Hábitos cumplidos" area="habits" values={t.habits} labels={labels} format={n} />
          <MiniBars title="Gasto (Bs)" area="finance" values={t.expenses} labels={labels} format={(v) => String(Math.round(v))} />
        </div>
      </CardContent>
    </Card>
  );
}
