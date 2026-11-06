import Link from "next/link";
import { buildMonthGrid, itemsOnDay, type CalendarItem } from "@/lib/personal/calendar";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_PER_CELL = 3;

const KIND_STYLE: Record<CalendarItem["kind"], string> = {
  event: "bg-primary/10 text-primary",
  task: "bg-muted text-foreground",
  obligation: "bg-warning/10 text-warning",
};

/** Cuadrícula mensual (lunes a domingo). En pantallas pequeñas se oculta y queda la agenda. */
export function MonthGrid({ month, items, today }: { month: string; items: CalendarItem[]; today: string }) {
  const weeks = buildMonthGrid(month);
  const prefix = month.slice(0, 7);
  return (
    <div role="grid" aria-label="Calendario del mes" className="hidden overflow-hidden rounded-lg border border-border md:block">
      <div role="row" className="grid grid-cols-7 border-b border-border bg-muted text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} role="row" className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((day) => {
            const inMonth = day.startsWith(prefix);
            const dayItems = itemsOnDay(items, day);
            return (
              <div
                key={day}
                role="gridcell"
                className={cn("min-h-24 border-r border-border p-1.5 last:border-r-0", !inMonth && "bg-muted/40 text-muted-foreground")}
              >
                <p className={cn("mb-1 text-xs tabular-nums", day === today && "font-semibold text-primary")}>
                  {day === today ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground">{Number(day.slice(8))}</span> : Number(day.slice(8))}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {dayItems.slice(0, MAX_PER_CELL).map((i) => {
                    const label = `${i.time ? `${i.time} ` : ""}${i.title}`;
                    const cls = cn("block truncate rounded px-1 py-0.5 text-[11px] leading-tight", KIND_STYLE[i.kind]);
                    return (
                      <li key={`${day}-${i.key}`}>
                        {i.href ? (
                          <Link href={i.href} className={cn(cls, "hover:underline")} title={label}>
                            {label}
                          </Link>
                        ) : (
                          <span className={cls} title={label}>
                            {label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {dayItems.length > MAX_PER_CELL ? (
                    <li className="px-1 text-[11px] text-muted-foreground">+{dayItems.length - MAX_PER_CELL} más</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
