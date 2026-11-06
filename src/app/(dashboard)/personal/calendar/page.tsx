import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { CalendarDays, Plus } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addDays, formatDate, todayIn } from "@/lib/utils/date";
import { addMonths, monthLabel, monthStart } from "@/lib/utils/month";
import { monthParamSchema } from "@/lib/validations/fitness";
import { itemsOnDay } from "@/lib/personal/calendar";
import { getCalendarItems } from "@/features/personal/queries";
import { EventFormDialog } from "@/features/personal/components/event-form-dialog";
import { EventRowView } from "@/features/personal/components/event-row";
import { MonthGrid } from "@/features/personal/components/month-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Calendario" };

const areaSchema = z.uuid().optional().catch(undefined);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default function CalendarPage({ searchParams }: PageProps<"/personal/calendar">) {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CalendarContent({ searchParams }: { searchParams: PageProps<"/personal/calendar">["searchParams"] }) {
  const raw = await searchParams;
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const currentMonth = monthStart(today);
  const parsedMonth = monthParamSchema.safeParse(first(raw.month));
  const month = parsedMonth.success ? `${parsedMonth.data}-01` : currentMonth;

  const areaId = areaSchema.parse(first(raw.area));
  const area = ctx.lifeAreas.find((a) => a.id === areaId);
  const activeArea = area?.id;

  // La cuadrícula muestra semanas completas: se cargan los días de las semanas visibles.
  const lastOfMonth = addDays(addMonths(month, 1), -1);
  const from = addDays(month, -6);
  const to = addDays(lastOfMonth, 6);
  const { items, events } = await getCalendarItems(ctx.workspace.id, ctx.profile.timezone, from, to, {
    areaId: activeArea,
    includeObligations: !area || area.code === "FINANCE",
  });

  const href = (m: string, a?: string) => {
    const q = new URLSearchParams();
    if (m !== currentMonth) q.set("month", m.slice(0, 7));
    if (a) q.set("area", a);
    const s = q.toString();
    return s ? `/personal/calendar?${s}` : "/personal/calendar";
  };

  // Agenda: solo los días del mes con algo, en orden.
  const days: string[] = [];
  for (let d = month; d <= lastOfMonth; d = addDays(d, 1)) if (itemsOnDay(items, d).length > 0) days.push(d);
  const eventsById = new Map(events.map((e) => [`event-${e.id}`, e]));

  const trigger = (
    <Button>
      <Plus aria-hidden />
      Nuevo evento
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Tus eventos, las tareas con vencimiento y los pagos pendientes."
        actions={<EventFormDialog areas={ctx.lifeAreas} today={today} timezone={ctx.profile.timezone} defaultDate={month === currentMonth ? today : month} trigger={trigger} />}
      />

      <nav aria-label="Filtrar por dimensión" className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href={href(month)}
          aria-current={!activeArea ? "true" : undefined}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium", !activeArea ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
        >
          Todas
        </Link>
        {ctx.lifeAreas.map((a) => (
          <Link
            key={a.id}
            href={href(month, a.id)}
            aria-current={activeArea === a.id ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", activeArea === a.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {a.name}
          </Link>
        ))}
      </nav>

      <MonthNav
        label={monthLabel(month)}
        prevHref={href(addMonths(month, -1), activeArea)}
        nextHref={href(addMonths(month, 1), activeArea)}
        currentHref={month !== currentMonth ? href(currentMonth, activeArea) : undefined}
      />

      <MonthGrid month={month} items={items} today={today} />
      <p className="mt-2 hidden gap-3 text-xs text-muted-foreground md:flex">
        <span className="rounded bg-primary/10 px-1.5 text-primary">Evento</span>
        <span className="rounded bg-muted px-1.5">Tarea con vencimiento</span>
        <span className="rounded bg-warning/10 px-1.5 text-warning">Pago pendiente</span>
      </p>

      <section aria-label="Agenda del mes" className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agenda</h2>
        {days.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nada programado este mes"
            description="Crea un evento para empezar a llenar tu calendario."
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {days.map((day) => (
              <li key={day}>
                <h3 className={cn("mb-1 text-sm font-medium", day === today && "text-primary")}>
                  {formatDate(day)}
                  {day === today ? " · hoy" : ""}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {itemsOnDay(items, day).map((i) => {
                    const event = eventsById.get(i.key);
                    if (event) {
                      return <EventRowView key={`${day}-${i.key}`} event={event} areas={ctx.lifeAreas} today={today} timezone={ctx.profile.timezone} />;
                    }
                    return (
                      <li key={`${day}-${i.key}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                        <Link href={i.href ?? "#"} className="min-w-0 truncate text-sm hover:underline">
                          {i.title}
                        </Link>
                        <Badge tone={i.kind === "obligation" ? "warning" : "neutral"}>{i.kind === "obligation" ? "Pago" : "Tarea"}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
