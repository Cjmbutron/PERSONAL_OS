"use client";

import { Pencil } from "lucide-react";
import { setEventArchived } from "@/features/personal/actions";
import { formatClock, formatDate } from "@/lib/utils/date";
import type { CalendarEventRow, LifeAreaRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { EventFormDialog } from "./event-form-dialog";

/** Cuándo ocurre un evento, en palabras: "Hoy 14:00–16:00", "12 nov – 14 nov", etc. */
export function eventWhen(e: CalendarEventRow, timezone: string): string {
  if (e.all_day) {
    return e.first_day === e.last_day ? `${formatDate(e.first_day)} · todo el día` : `${formatDate(e.first_day)} – ${formatDate(e.last_day)} · todo el día`;
  }
  const start = e.starts_at as string;
  const end = e.ends_at as string;
  const startClock = formatClock(start, timezone);
  const endClock = formatClock(end, timezone);
  if (e.first_day === e.last_day) return `${formatDate(e.first_day)} · ${startClock}${endClock !== startClock ? `–${endClock}` : ""}`;
  return `${formatDate(e.first_day)} ${startClock} – ${formatDate(e.last_day)} ${endClock}`;
}

export function EventRowView({
  event,
  areas,
  today,
  timezone,
}: {
  event: CalendarEventRow;
  areas: LifeAreaRow[];
  today: string;
  timezone: string;
}) {
  const area = areas.find((a) => a.id === event.life_area_id);
  return (
    <li className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground">
          {eventWhen(event, timezone)}
          {event.location ? ` · ${event.location}` : ""}
          {area ? ` · ${area.name}` : ""}
        </p>
        {event.description ? <p className="mt-1 text-xs text-muted-foreground">{event.description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center">
        <EventFormDialog
          event={event}
          areas={areas}
          today={today}
          timezone={timezone}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${event.title}`}>
              <Pencil aria-hidden />
            </Button>
          }
        />
        <ArchiveButton action={setEventArchived} id={event.id} archived={false} label={event.title} />
      </div>
    </li>
  );
}
