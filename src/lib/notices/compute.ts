import { addDays, formatDate } from "@/lib/utils/date";
import { daysUntil, dueLabel } from "@/lib/finance/stats";
import { isoWeekday, weekStart } from "@/lib/habits/streaks";
import { weekLabel } from "@/lib/personal/weekly";

/** Avisos calculados al abrir la app (D-97). Lógica pura: no toca base de datos ni reloj. */

export type NoticeKind = "task" | "obligation" | "weekly-review";
export type NoticeTone = "danger" | "warning" | "info";

export type Notice = {
  /** Clave determinista: cambia si cambia la situación (p. ej. de "hoy" a "vencida"), y el aviso reaparece. */
  key: string;
  kind: NoticeKind;
  tone: NoticeTone;
  title: string;
  detail: string;
  href: string;
};

export type NoticeTask = { id: string; title: string; due_date: string | null };
export type NoticeObligation = { id: string; name: string; amount: number; currency: string; due_date: string };

/** Tareas: se avisa de las vencidas, las de hoy y las de los próximos 2 días. */
export const TASK_WARN_DAYS = 2;
/** Obligaciones: se avisa de las vencidas y las de los próximos 7 días (igual que dueState). */
export const OBLIGATION_WARN_DAYS = 7;

export function taskNotices(tasks: readonly NoticeTask[], today: string): Notice[] {
  const out: Notice[] = [];
  for (const t of tasks) {
    if (!t.due_date) continue;
    const days = daysUntil(t.due_date, today);
    if (days > TASK_WARN_DAYS) continue;
    const bucket = days < 0 ? "overdue" : days === 0 ? "today" : "soon";
    out.push({
      key: `task:${t.id}:${t.due_date}:${bucket}`,
      kind: "task",
      tone: bucket === "overdue" ? "danger" : bucket === "today" ? "warning" : "info",
      title: t.title,
      detail: `Tarea · ${dueLabel(t.due_date, today)} (${formatDate(t.due_date)})`,
      href: "/work/tasks",
    });
  }
  return out;
}

export function obligationNotices(items: readonly NoticeObligation[], today: string): Notice[] {
  const out: Notice[] = [];
  for (const o of items) {
    const days = daysUntil(o.due_date, today);
    if (days > OBLIGATION_WARN_DAYS) continue;
    out.push({
      key: `obligation:${o.id}:${o.due_date}:${days < 0 ? "overdue" : "soon"}`,
      kind: "obligation",
      tone: days < 0 ? "danger" : days <= 1 ? "warning" : "info",
      title: o.name,
      detail: `Pago · ${dueLabel(o.due_date, today)} · ${o.amount.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${o.currency}`,
      href: "/finance/obligations",
    });
  }
  return out;
}

/**
 * Semana que toca revisar (D-99): sábado y domingo → la semana en curso;
 * lunes y martes → la semana que acaba de terminar; el resto de la semana, ninguna.
 */
export function weekToReview(today: string): string | null {
  const dow = isoWeekday(today);
  if (dow >= 6) return weekStart(today);
  if (dow <= 2) return addDays(weekStart(today), -7);
  return null;
}

export function weeklyReviewNotice(today: string, completedWeeks: ReadonlySet<string>): Notice | null {
  const week = weekToReview(today);
  if (!week || completedWeeks.has(week)) return null;
  const ending = week === weekStart(today);
  return {
    key: `weekly-review:${week}`,
    kind: "weekly-review",
    tone: "info",
    title: ending ? "Cierra tu semana" : "Revisa la semana que terminó",
    detail: `${weekLabel(week)} · 5 minutos para ver qué salió bien y elegir tus prioridades.`,
    href: `/review?week=${week}`,
  };
}

const ORDER: Record<NoticeTone, number> = { danger: 0, warning: 1, info: 2 };

/** Más urgentes primero; a igual urgencia, orden estable por clave. */
export function sortNotices(notices: readonly Notice[]): Notice[] {
  return [...notices].sort((a, b) => ORDER[a.tone] - ORDER[b.tone] || a.key.localeCompare(b.key));
}
