"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Moon, Pencil } from "lucide-react";
import { setSleepRecordArchived } from "@/features/sleep/actions";
import { SLEEP_QUALITY_LABELS } from "@/lib/constants/labels";
import { formatDuration } from "@/lib/sleep/stats";
import { formatClock, formatDate, isoWeekdayLabel } from "@/lib/utils/date";
import type { SleepRecordRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SleepFormDialog } from "./sleep-form-dialog";

export function SleepRow({
  record,
  timezone,
  today,
  goalMinutes,
}: {
  record: SleepRecordRow;
  timezone: string;
  today: string;
  goalMinutes: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const archived = record.archived_at !== null;
  const diff = record.duration_minutes - goalMinutes;
  const metGoal = diff >= 0;

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setSleepRecordArchived(record.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  const label = `${isoWeekdayLabel(record.sleep_date)} ${formatDate(record.sleep_date)}`;

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Moon className="size-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatClock(record.bedtime, timezone)} → {formatClock(record.wake_time, timezone)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={metGoal ? "success" : "warning"}>
              {formatDuration(record.duration_minutes)}
              {/* Texto además del color: el cumplimiento de la meta no depende solo del color (RNF-09). */}
              {metGoal ? " · Meta alcanzada" : ` · ${formatDuration(-diff)} menos que la meta`}
            </Badge>
            {record.quality ? (
              <Badge>
                Calidad {record.quality}/5 · {SLEEP_QUALITY_LABELS[record.quality]}
              </Badge>
            ) : null}
            {archived ? <Badge>Archivado</Badge> : null}
          </div>
          {record.notes ? <p className="mt-2 break-words text-sm text-muted-foreground">{record.notes}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!archived ? (
            <SleepFormDialog
              record={record}
              timezone={timezone}
              today={today}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Editar el sueño del ${label}`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleArchive}
            disabled={pending}
            aria-label={`${archived ? "Restaurar" : "Archivar"} el sueño del ${label}`}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 pl-11 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
