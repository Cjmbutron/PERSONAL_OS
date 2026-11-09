import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Droplet, Egg, Flame, Plus, Utensils, Wheat } from "lucide-react";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatGrams, formatKcal, groupTotalsByDate, sumNutrients, suggestMealType } from "@/lib/nutrition/stats";
import { addDays, formatDate, instantToLocalInput, isoWeekdayLabel, todayIn } from "@/lib/utils/date";
import { dateParamSchema } from "@/lib/validations/nutrition";
import { listMeals } from "@/features/nutrition/queries";
import { quickParam } from "@/lib/utils/quick-param";
import { MealFormDialog } from "@/features/nutrition/components/meal-form-dialog";
import { MealRow } from "@/features/nutrition/components/meal-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Alimentación" };

const HISTORY_DAYS = 7;

const archivedSchema = z.enum(["1"]).optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function NutritionPage({ searchParams }: PageProps<"/nutrition">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <NutritionContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NutritionContent({ searchParams }: { searchParams: PageProps<"/nutrition">["searchParams"] }) {
  const raw = await searchParams;
  const archived = archivedSchema.parse(first(raw.archived)) === "1";

  const ctx = await getWorkspaceContext();
  const { timezone } = ctx.profile;
  const today = todayIn(timezone);

  // Fecha inválida o futura → hoy.
  const parsedDate = dateParamSchema.safeParse(first(raw.date));
  const date = parsedDate.success && parsedDate.data <= today ? parsedDate.data : today;

  const header = (
    <PageHeader
      title="Alimentación"
      description={
        archived ? "Comidas archivadas. Puedes restaurarlas." : "Registra lo que comes y revisa tu día."
      }
    />
  );

  if (archived) {
    const meals = await listMeals(ctx.workspace.id, { archived: true });
    return (
      <>
        {header}
        <ViewTabs archived />
        {meals.length === 0 ? (
          <EmptyState icon={Utensils} title="No tienes comidas archivadas" />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Comidas archivadas">
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} timezone={timezone} showDate />
            ))}
          </ul>
        )}
      </>
    );
  }

  const weekStart = addDays(today, -(HISTORY_DAYS - 1));
  const [dayMeals, weekMeals] = await Promise.all([
    listMeals(ctx.workspace.id, { date }),
    listMeals(ctx.workspace.id, { sinceDate: weekStart }),
  ]);

  const totals = sumNutrients(dayMeals);
  const history = groupTotalsByDate(weekMeals);
  const isToday = date === today;

  // Valores iniciales del formulario: ahora (si es hoy) o mediodía del día consultado.
  const defaultEatenAt = isToday ? instantToLocalInput(new Date(), timezone) : `${date}T12:00`;
  const defaultType = suggestMealType(Number(defaultEatenAt.slice(11, 13)));

  const kcal = (n: number | null) => (n === null ? "—" : formatKcal(n));
  const grams = (n: number | null) => (n === null ? "—" : formatGrams(n));

  return (
    <>
      <PageHeader
        title="Alimentación"
        description="Registra lo que comes y revisa tu día."
        actions={
          <MealFormDialog
            defaultOpen={quickParam(raw) === "comida"}
            timezone={timezone}
            defaultEatenAt={defaultEatenAt}
            defaultType={defaultType}
            trigger={
              <Button>
                <Plus aria-hidden />
                Registrar comida
              </Button>
            }
          />
        }
      />

      <ViewTabs archived={false} />

      <nav aria-label="Día" className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/nutrition?date=${addDays(date, -1)}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <div className="text-center">
          <p className="font-medium">{isoWeekdayLabel(date)} {formatDate(date)}</p>
          {isToday ? (
            <p className="text-xs text-muted-foreground">Hoy</p>
          ) : (
            <Link href="/nutrition" className="text-xs font-medium text-primary hover:underline">
              Ir a hoy
            </Link>
          )}
        </div>
        {isToday ? (
          <span className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground/40" aria-hidden>
            Siguiente
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link
            href={date >= addDays(today, -1) ? "/nutrition" : `/nutrition?date=${addDays(date, 1)}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            aria-label="Día siguiente"
          >
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </nav>

      <section aria-label="Totales del día" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Calorías" value={kcal(totals.calories)} icon={Flame} />
        <StatCard label="Proteínas" value={grams(totals.protein)} icon={Egg} />
        <StatCard label="Carbohidratos" value={grams(totals.carbs)} icon={Wheat} />
        <StatCard label="Grasas" value={grams(totals.fat)} icon={Droplet} />
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        Los totales suman solo las comidas que tienen ese dato. “—” significa que ninguna lo registró.
      </p>

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Comidas del día
      </h2>
      {dayMeals.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title={isToday ? "Aún no registras comidas hoy" : "No hay comidas registradas este día"}
          description="Registra una comida para empezar el historial."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Comidas del día">
          {dayMeals.map((m) => (
            <MealRow key={m.id} meal={m} timezone={timezone} />
          ))}
        </ul>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Últimos {HISTORY_DAYS} días</CardTitle>
          <CardDescription>Elige un día para ver su detalle.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, -i)).map((d) => {
              const t = history.get(d);
              return (
                <li key={d}>
                  <Link
                    href={d === today ? "/nutrition" : `/nutrition?date=${d}`}
                    aria-current={d === date ? "date" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/50",
                      d === date && "font-medium text-primary",
                    )}
                  >
                    <span>
                      {isoWeekdayLabel(d)} {formatDate(d).slice(0, 5)}
                      {d === today ? " · hoy" : ""}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {t
                        ? `${t.meals} ${t.meals === 1 ? "comida" : "comidas"}${t.calories !== null ? ` · ${formatKcal(t.calories)}` : ""}`
                        : "Sin registros"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function ViewTabs({ archived }: { archived: boolean }) {
  return (
    <nav aria-label="Vista" className="mb-4 flex gap-2 text-sm">
      <Link
        href="/nutrition"
        aria-current={archived ? undefined : "page"}
        className={archived ? "text-muted-foreground hover:text-foreground" : "font-medium text-primary"}
      >
        Por día
      </Link>
      <span aria-hidden className="text-muted-foreground">·</span>
      <Link
        href="/nutrition?archived=1"
        aria-current={archived ? "page" : undefined}
        className={archived ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}
      >
        Archivadas
      </Link>
    </nav>
  );
}
