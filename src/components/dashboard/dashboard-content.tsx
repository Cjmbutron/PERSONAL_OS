import { listNotices } from "@/features/notices/queries";
import Link from "next/link";
import { Suspense } from "react";
import { TrendsCard, TrendsSkeleton } from "./trends-card";
import { AlertTriangle, CalendarClock, CalendarDays, Target, CheckCircle2, Dumbbell, Flame, FolderKanban, ListTodo, Moon, Utensils, Wallet } from "lucide-react";
import { getHabitViews } from "@/features/habits/queries";
import { listSleepRecords } from "@/features/sleep/queries";
import { listMeals } from "@/features/nutrition/queries";
import { getRoutineForMonth, listSessions } from "@/features/fitness/queries";
import { exercisesForDay, formatKg, isoDayOfWeek, monthStart, sessionsThisWeek, setsVolume } from "@/lib/fitness/stats";
import { weekStart } from "@/lib/habits/streaks";
import { getBalances, getMonthlyTotals, listAccounts, listObligations } from "@/features/finance/queries";
import { formatMoney, sumByCurrency } from "@/lib/finance/money";
import { dueLabel, dueState } from "@/lib/finance/stats";
import { getReview, listPriorities } from "@/features/review/queries";
import { PriorityList } from "@/features/review/components/priority-list";
import { cn } from "@/lib/utils/cn";
import { listEvents, listGoals } from "@/features/personal/queries";
import { eventWhen } from "@/lib/personal/event-format";
import { goalPercent } from "@/lib/personal/calendar";
import { formatGrams, formatKcal, sumNutrients } from "@/lib/nutrition/stats";
import { formatDuration, summarizeSleep } from "@/lib/sleep/stats";
import { getWorkspaceContext } from "@/lib/auth/session";
import { MODULES, PRIORITY_LABELS } from "@/lib/constants/labels";
import { addDays, formatDate, startOfDayInstant, todayIn } from "@/lib/utils/date";
import { countCompletedSince, listOpenTasks } from "@/features/tasks/queries";
import { listProjects } from "@/features/projects/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MODULE_ICONS } from "@/components/layout/nav-icons";
import { StatCard } from "./stat-card";

const UPCOMING_LIMIT = 6;
const PROJECTS_LIMIT = 5;

/** Todo lo que se muestra sale de la base de datos del usuario; no hay cifras simuladas (D-14). */
export async function DashboardContent({ period = 7 }: { period?: 7 | 30 }) {
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  // Indicadores por periodo (D-77): últimos 7 o 30 días contando hoy, en la zona del usuario.
  const since = startOfDayInstant(addDays(today, -(period - 1)), ctx.profile.timezone);
  const lastWeekMonday = addDays(weekStart(today), -7);

  const [openTasks, projects, completedWeek, habitViews, sleepWeek, mealsToday, weekSessions, routine, accounts, balances, monthTotals, pendingObligations, upcomingEvents, activeGoals, weekPriorities, lastReview, notices] = await Promise.all([
    listOpenTasks(ctx.workspace.id),
    listProjects(ctx.workspace.id),
    countCompletedSince(ctx.workspace.id, since.toISOString()),
    getHabitViews(ctx.workspace.id, today),
    listSleepRecords(ctx.workspace.id, { sinceDate: addDays(today, -(period - 1)) }),
    listMeals(ctx.workspace.id, { date: today }),
    listSessions(ctx.workspace.id, { sinceDate: weekStart(today) }),
    getRoutineForMonth(ctx.workspace.id, monthStart(today)),
    listAccounts(ctx.workspace.id),
    getBalances(ctx.workspace.id),
    getMonthlyTotals(ctx.workspace.id, monthStart(today), monthStart(today)),
    listObligations(ctx.workspace.id, "pending", 50),
    listEvents(ctx.workspace.id, today, addDays(today, 7)),
    listGoals(ctx.workspace.id, { status: "active" }),
    listPriorities(ctx.workspace.id, weekStart(today)),
    getReview(ctx.workspace.id, lastWeekMonday),
    listNotices(ctx.workspace.id, today).catch(() => []),
  ]);

  // Finanzas (D-56): saldo por moneda, gastos del mes y obligaciones vencidas o próximas. Nunca se mezclan monedas.
  const balanceTotals = sumByCurrency(accounts.map((a) => ({ currency: a.currency, amount: balances.get(a.id)?.balance ?? a.opening_balance })));
  const monthExpenses = monthTotals.filter((t) => t.kind === "expense");
  const urgentObligations = pendingObligations.filter((o) => dueState(o.due_date, today) !== "upcoming");

  const weekVolume = setsVolume(weekSessions.flatMap((s) => s.exercises.flatMap((e) => e.sets)));
  const trainedToday = weekSessions.some((s) => s.started_date === today);
  const plannedToday = routine ? exercisesForDay(routine.exercises, isoDayOfWeek(today)) : [];

  const nutrition = sumNutrients(mealsToday);

  const goalMinutes = Math.round(ctx.profile.sleep_goal_hours * 60);
  const sleep = summarizeSleep(sleepWeek, goalMinutes);

  const habitsDue = habitViews.filter((v) => v.dueToday);
  const habitsDone = habitsDue.filter((v) => v.doneToday).length;

  const overdue = openTasks.filter((t) => t.due_date !== null && t.due_date < today);
  const dueToday = openTasks.filter((t) => t.due_date === today);
  const activeProjects = projects.filter((p) => p.archived_at === null && p.status === "active");
  const openByProject = new Map<string, number>();
  for (const t of openTasks) {
    if (t.project_id) openByProject.set(t.project_id, (openByProject.get(t.project_id) ?? 0) + 1);
  }
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const upcoming = openTasks.slice(0, UPCOMING_LIMIT);

  const reviewPending = lastReview?.status !== "completed";

  // "Atención de hoy": lo que pide acción ahora, de lo más urgente a lo menos. Cada línea lleva a donde se resuelve.
  const eventsToday = upcomingEvents.filter((e) => e.first_day <= today && today <= e.last_day);
  const attention: { key: string; text: string; href: string; tone: "danger" | "warning" | "neutral" }[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (overdue.length > 0) attention.push({ key: "overdue", text: `${plural(overdue.length, "tarea vencida", "tareas vencidas")}`, href: "/work/tasks", tone: "danger" });
  const overdueMoney = pendingObligations.filter((o) => dueState(o.due_date, today) === "overdue").length;
  if (overdueMoney > 0) attention.push({ key: "money-overdue", text: `${plural(overdueMoney, "pago vencido", "pagos vencidos")}`, href: "/finance/obligations", tone: "danger" });
  if (eventsToday.length > 0)
    attention.push({ key: "events", text: eventsToday.length === 1 ? `Hoy: ${eventsToday[0].title}` : `${eventsToday.length} eventos hoy`, href: "/personal/calendar", tone: "warning" });
  if (dueToday.length > 0) attention.push({ key: "due-today", text: `${plural(dueToday.length, "tarea vence hoy", "tareas vencen hoy")}`, href: "/work/tasks", tone: "warning" });
  const soonMoney = urgentObligations.length - overdueMoney;
  if (soonMoney > 0) attention.push({ key: "money-soon", text: `${plural(soonMoney, "pago por vencer", "pagos por vencer")}`, href: "/finance/obligations", tone: "warning" });
  if (habitsDue.length - habitsDone > 0)
    attention.push({ key: "habits", text: `${plural(habitsDue.length - habitsDone, "hábito pendiente", "hábitos pendientes")} hoy`, href: "/habits", tone: "neutral" });
  // Aviso de la revisión semanal (D-99): mismo cálculo que el centro de avisos.
  const weeklyNotice = notices.find((n) => n.kind === "weekly-review" && n.state !== "dismissed");
  if (weeklyNotice) attention.push({ key: "weekly-review", text: weeklyNotice.title, href: weeklyNotice.href, tone: "neutral" });
  if (!sleepWeek.some((r) => r.sleep_date === today)) attention.push({ key: "sleep", text: "Registra cómo dormiste", href: "/sleep?nuevo=sueno", tone: "neutral" });

  const unreadNotices = notices.filter((n) => n.state === "new").length;

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-1" role="group" aria-label="Periodo de los indicadores">
        <span className="mr-1 text-xs text-muted-foreground">Periodo</span>
        {([7, 30] as const).map((p) => (
          <Link
            key={p}
            href={p === 7 ? "/dashboard" : `/dashboard?period=${p}`}
            aria-current={period === p ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              period === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {p} días
          </Link>
        ))}
      </div>

      <section aria-label="Atención de hoy" className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Atención de hoy</h2>
          <Link href="/notices" className="text-sm font-medium text-primary hover:underline">
            {unreadNotices > 0 ? `Ver avisos (${unreadNotices} sin leer)` : "Ver avisos"}
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            Todo al día: nada vencido ni pendiente por ahora.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((a) => (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-muted",
                    a.tone === "danger" ? "border-destructive/40 text-destructive" : a.tone === "warning" ? "border-warning/40" : "border-border",
                  )}
                >
                  {a.tone === "danger" ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : null}
                  <span className="min-w-0 truncate">{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Esta semana" className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">Esta semana</h2>
          <Link href="/review" className="text-sm font-medium text-primary hover:underline">
            {reviewPending ? "Revisar la semana pasada" : "Planificar la próxima"}
          </Link>
        </div>
        {weekPriorities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No definiste prioridades para esta semana.{" "}
            <Link href="/review" className="font-medium text-primary hover:underline">
              Elige hasta 5
            </Link>
            .
          </p>
        ) : (
          <div className="mt-2">
            <PriorityList week={weekStart(today)} priorities={weekPriorities} editable={false} />
          </div>
        )}
      </section>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Tareas abiertas" value={openTasks.length} icon={ListTodo} href="/work/tasks" />
        <StatCard
          label="Vencidas"
          value={overdue.length}
          icon={AlertTriangle}
          tone={overdue.length > 0 ? "danger" : "neutral"}
          href="/work/tasks"
        />
        <StatCard
          label="Para hoy"
          value={dueToday.length}
          icon={CalendarClock}
          tone={dueToday.length > 0 ? "warning" : "neutral"}
          href="/work/tasks"
        />
        <StatCard label="Proyectos activos" value={activeProjects.length} icon={FolderKanban} href="/work/projects" />
        <StatCard
          label={`Completadas (${period} días)`}
          value={completedWeek}
          icon={CheckCircle2}
          tone={completedWeek > 0 ? "success" : "neutral"}
          href="/work/tasks?status=completed"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card area="work">
          <CardHeader>
            <CardTitle>Próximas tareas</CardTitle>
            <CardDescription>Lo más urgente primero.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="No tienes tareas abiertas"
                description="Cuando crees tareas aparecerán aquí."
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((t) => {
                  const isOverdue = t.due_date !== null && t.due_date < today;
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.project_id ? (projectNames.get(t.project_id) ?? "Proyecto") : "Sin proyecto"} ·{" "}
                          {PRIORITY_LABELS[t.priority]}
                        </p>
                      </div>
                      {t.due_date ? (
                        <Badge tone={isOverdue ? "danger" : t.due_date === today ? "warning" : "neutral"}>
                          {isOverdue ? "Vencida · " : t.due_date === today ? "Hoy · " : ""}
                          {formatDate(t.due_date)}
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {openTasks.length > UPCOMING_LIMIT ? (
              <Link href="/work/tasks" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ver todas ({openTasks.length})
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card area="work">
          <CardHeader>
            <CardTitle>Proyectos activos</CardTitle>
            <CardDescription>Tareas abiertas por proyecto.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No tienes proyectos activos"
                description="Crea un proyecto para agrupar tus tareas."
              />
            ) : (
              <ul className="divide-y divide-border">
                {activeProjects.slice(0, PROJECTS_LIMIT).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link
                      href={`/work/tasks?project=${p.id}`}
                      className="min-w-0 truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <Badge>{openByProject.get(p.id) ?? 0} abiertas</Badge>
                  </li>
                ))}
              </ul>
            )}
            {activeProjects.length > PROJECTS_LIMIT ? (
              <Link href="/work/projects" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ver todos ({activeProjects.length})
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
      <Card area="habits">
        <CardHeader>
          <CardTitle>Hábitos de hoy</CardTitle>
          <CardDescription>
            {habitsDue.length > 0
              ? `${habitsDone} de ${habitsDue.length} cumplidos.`
              : "Lo que toca sostener hoy."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {habitsDue.length === 0 ? (
            <EmptyState
              icon={Flame}
              title={habitViews.length === 0 ? "Aún no tienes hábitos" : "Hoy no tienes hábitos pendientes"}
              description={habitViews.length === 0 ? "Crea uno para empezar tu primera racha." : undefined}
              action={
                habitViews.length === 0 ? (
                  <Link href="/habits" className="text-sm font-medium text-primary hover:underline">
                    Ir a Hábitos
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {habitsDue.map((v) => (
                <li key={v.habit.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href="/habits" className="min-w-0 truncate text-sm font-medium hover:underline">
                    {v.habit.name}
                  </Link>
                  <Badge tone={v.doneToday ? "success" : "neutral"}>
                    {v.doneToday ? "Cumplido" : "Pendiente"}
                    {v.schedule.type === "times_per_week" ? ` · ${v.weekDone}/${v.schedule.target} sem.` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card area="finance">
        <CardHeader>
          <CardTitle>Finanzas</CardTitle>
          <CardDescription>Saldo, gastos del mes y vencimientos.</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aún no tienes cuentas"
              action={
                <Link href="/finance" className="text-sm font-medium text-primary hover:underline">
                  Crear una cuenta
                </Link>
              }
            />
          ) : (
            <>
              <dl className="flex flex-col gap-2 text-sm">
                {[...balanceTotals].map(([currency, amount]) => (
                  <div key={currency} className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Saldo ({currency})</dt>
                    <dd className="font-semibold tabular-nums">{formatMoney(amount, currency)}</dd>
                  </div>
                ))}
                {monthExpenses.map((t) => (
                  <div key={t.currency} className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Gastos del mes ({t.currency})</dt>
                    <dd className="tabular-nums">{formatMoney(t.total, t.currency)}</dd>
                  </div>
                ))}
              </dl>
              {urgentObligations.length > 0 ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Obligaciones</p>
                  <ul className="mt-1 text-sm">
                    {urgentObligations.slice(0, 3).map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="min-w-0 truncate">{o.name}</span>
                        <Badge tone={dueState(o.due_date, today) === "overdue" ? "danger" : "warning"}>{dueLabel(o.due_date, today)}</Badge>
                      </li>
                    ))}
                  </ul>
                  {urgentObligations.length > 3 ? (
                    <p className="text-xs text-muted-foreground">y {urgentObligations.length - 3} más</p>
                  ) : null}
                </div>
              ) : null}
              <Link href="/finance/transactions" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ver movimientos
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <Card area="personal">
        <CardHeader>
          <CardTitle>Vida personal</CardTitle>
          <CardDescription>Eventos de los próximos 7 días y objetivos en curso.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 && activeGoals.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin eventos ni objetivos"
              action={
                <Link href="/personal" className="text-sm font-medium text-primary hover:underline">
                  Ir a Vida personal
                </Link>
              }
            />
          ) : (
            <>
              {upcomingEvents.length > 0 ? (
                <ul className="text-sm">
                  {upcomingEvents.slice(0, 3).map((e) => (
                    <li key={e.id} className="py-0.5">
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{eventWhen(e, ctx.profile.timezone)}</p>
                    </li>
                  ))}
                  {upcomingEvents.length > 3 ? <li className="text-xs text-muted-foreground">y {upcomingEvents.length - 3} más</li> : null}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin eventos esta semana.</p>
              )}
              {activeGoals.length > 0 ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Target className="size-3" aria-hidden /> Objetivos
                  </p>
                  <ul className="mt-1 text-sm">
                    {activeGoals.slice(0, 3).map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="min-w-0 truncate">{g.title}</span>
                        <Badge tone="primary">{goalPercent(g.manual_progress, g.milestonesTotal, g.milestonesDone)}%</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href="/personal" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ver detalle
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <Card area="fitness">
        <CardHeader>
          <CardTitle>Entrenamiento · semana</CardTitle>
          <CardDescription>
            {weekSessions.length > 0
              ? `${sessionsThisWeek(weekSessions, today)} ${sessionsThisWeek(weekSessions, today) === 1 ? "sesión" : "sesiones"} esta semana.`
              : "Sin sesiones esta semana."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plannedToday.length > 0 ? (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground">
                Hoy toca{trainedToday ? " (ya entrenaste)" : ""}
              </p>
              <ul className="mt-1 text-sm">
                {plannedToday.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate">{e.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {e.target_sets} × {e.target_reps}
                    </span>
                  </li>
                ))}
              </ul>
              {plannedToday.length > 4 ? (
                <p className="text-xs text-muted-foreground">y {plannedToday.length - 4} más</p>
              ) : null}
            </div>
          ) : null}
          {weekSessions.length === 0 && plannedToday.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Aún no entrenas esta semana"
              action={
                <Link href="/fitness" className="text-sm font-medium text-primary hover:underline">
                  Ir a Entrenamiento
                </Link>
              }
            />
          ) : (
            <>
              {weekVolume > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Volumen de la semana: <span className="font-semibold tabular-nums text-foreground">{formatKg(weekVolume)}</span>
                </p>
              ) : null}
              <Link href="/fitness" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ver detalle
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <Card area="sleep">
        <CardHeader>
          <CardTitle>Sueño · últimos {period} días</CardTitle>
          <CardDescription>
            {sleep.nights > 0 ? `${sleep.nights} ${sleep.nights === 1 ? "noche registrada" : "noches registradas"}.` : "Sin registros esta semana."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sleep.nights === 0 ? (
            <EmptyState
              icon={Moon}
              title="Aún no registras tu sueño"
              action={
                <Link href="/sleep" className="text-sm font-medium text-primary hover:underline">
                  Ir a Sueño
                </Link>
              }
            />
          ) : (
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Promedio</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {sleep.avgMinutes === null ? "—" : formatDuration(sleep.avgMinutes)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Con la meta</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {sleep.goalMet} de {sleep.nights}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Calidad</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {sleep.avgQuality === null ? "—" : `${sleep.avgQuality} / 5`}
                </dd>
              </div>
            </dl>
          )}
          {sleep.nights > 0 ? (
            <Link href="/sleep" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Ver detalle
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card area="nutrition">
        <CardHeader>
          <CardTitle>Alimentación · hoy</CardTitle>
          <CardDescription>
            {nutrition.meals > 0
              ? `${nutrition.meals} ${nutrition.meals === 1 ? "comida registrada" : "comidas registradas"}.`
              : "Sin comidas registradas hoy."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nutrition.meals === 0 ? (
            <EmptyState
              icon={Utensils}
              title="Aún no registras comidas hoy"
              action={
                <Link href="/nutrition" className="text-sm font-medium text-primary hover:underline">
                  Ir a Alimentación
                </Link>
              }
            />
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums">
                {nutrition.calories === null ? "Sin calorías" : formatKcal(nutrition.calories)}
              </p>
              {nutrition.protein !== null || nutrition.carbs !== null || nutrition.fat !== null ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    nutrition.protein !== null ? `Proteínas ${formatGrams(nutrition.protein)}` : null,
                    nutrition.carbs !== null ? `Carbohidratos ${formatGrams(nutrition.carbs)}` : null,
                    nutrition.fat !== null ? `Grasas ${formatGrams(nutrition.fat)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <Link href="/nutrition" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                Ver detalle
              </Link>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      <Suspense fallback={<TrendsSkeleton />}>
        <TrendsCard />
      </Suspense>

      <section aria-labelledby="accesos" className="mt-8">
        <h2 id="accesos" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accesos rápidos
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MODULES.filter((m) => m.code !== "DASHBOARD").map((m) => {
            const Icon = MODULE_ICONS[m.code];
            return (
              <li key={m.code}>
                <Link
                  href={m.href}
                  className="flex h-full items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{m.label}</span>
                  {!m.available ? <span className="text-[10px] uppercase text-muted-foreground">Pronto</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
