import { formatDuration } from "@/lib/sleep/stats";
import { formatKg } from "@/lib/fitness/stats";
import { formatMoney } from "@/lib/finance/money";
import type { WeekSummary } from "@/features/review/queries";
import { ProgressBar } from "@/features/personal/components/goal-card";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Resumen automático de la semana (D-75): solo lectura, calculado con datos reales. */
export function WeekSummaryView({ summary: s }: { summary: WeekSummary }) {
  const habitsDone = s.habits.reduce((n, h) => n + h.done, 0);
  const habitsTarget = s.habits.reduce((n, h) => n + h.target, 0);
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tareas completadas" value={String(s.tasksCompleted)} hint={s.tasksOverdue > 0 ? `${s.tasksOverdue} abiertas vencidas` : "Sin vencidas"} />
        <Stat
          label="Hábitos"
          value={habitsTarget > 0 ? `${habitsDone} de ${habitsTarget}` : "—"}
          hint={habitsTarget > 0 ? `${Math.round((habitsDone / habitsTarget) * 100)} % de cumplimiento` : "Sin hábitos que tocaran"}
        />
        <Stat
          label="Entrenamiento"
          value={`${s.sessions} ${s.sessions === 1 ? "sesión" : "sesiones"}`}
          hint={s.volumeKg > 0 ? `Volumen ${formatKg(s.volumeKg)}` : undefined}
        />
        <Stat
          label="Sueño"
          value={s.sleep.avgMinutes === null ? "—" : formatDuration(s.sleep.avgMinutes)}
          hint={s.sleep.nights > 0 ? `${s.sleep.nights} noches · ${s.sleep.goalMet} con la meta` : "Sin registros"}
        />
      </dl>

      {s.habits.length > 0 ? (
        <section aria-label="Hábitos de la semana">
          <h3 className="mb-1 text-sm font-medium">Hábitos</h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {s.habits.map((h) => (
              <li key={h.name} className="flex justify-between gap-2 py-0.5 text-sm">
                <span className="truncate">{h.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {h.done} / {h.target}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Finanzas de la semana">
        <h3 className="mb-1 text-sm font-medium">Finanzas</h3>
        {s.money.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingresos ni gastos registrados.</p>
        ) : (
          <ul className="text-sm">
            {s.money.map((m) => (
              <li key={m.currency} className="flex flex-wrap justify-between gap-2 py-0.5">
                <span className="text-muted-foreground">{m.currency}</span>
                <span className="tabular-nums">
                  Ingresos {formatMoney(m.income, m.currency)} · Gastos {formatMoney(m.expense, m.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Objetivos">
        <h3 className="mb-1 text-sm font-medium">
          Objetivos{s.goalsCompleted > 0 ? ` · ${s.goalsCompleted} completado${s.goalsCompleted === 1 ? "" : "s"} esta semana` : ""}
        </h3>
        {s.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes objetivos en curso.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {s.goals.slice(0, 6).map((g) => (
              <li key={g.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="tabular-nums text-muted-foreground">{g.percent}%</span>
                </div>
                <ProgressBar percent={g.percent} label={`Avance de ${g.title}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
