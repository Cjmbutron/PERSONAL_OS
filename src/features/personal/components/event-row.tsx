"use client";

import { Pencil } from "lucide-react";
import { setEventArchived } from "@/features/personal/actions";
import { eventWhen } from "@/lib/personal/event-format";
import type { CalendarEventRow, LifeAreaRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { ArchiveButton } from "@/features/finance/components/archive-button";
import { EventFormDialog } from "./event-form-dialog";

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
