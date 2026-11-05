"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { setSessionArchived } from "@/features/fitness/actions";
import type { RoutineDetail, SessionDetail } from "@/features/fitness/queries";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants/labels";
import { formatKg, setsVolume } from "@/lib/fitness/stats";
import { formatClock, formatDate, isoWeekdayLabel } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionFormDialog } from "./session-form-dialog";

function formatSet(s: { reps: number; weight_kg: number | null }) {
  return s.weight_kg === null ? `${s.reps} reps (corporal)` : `${s.reps} × ${s.weight_kg} kg`;
}

export function SessionRow({
  session,
  routine,
  timezone,
}: {
  session: SessionDetail;
  routine: RoutineDetail | null;
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const archived = session.archived_at !== null;
  const label = `${WORKOUT_TYPE_LABELS[session.type]} del ${formatDate(session.started_date)}`;
  const allSets = session.exercises.flatMap((e) => e.sets);
  const volume = setsVolume(allSets);

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setSessionArchived(session.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">{WORKOUT_TYPE_LABELS[session.type]}</Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {isoWeekdayLabel(session.started_date)} {formatDate(session.started_date)} ·{" "}
              {formatClock(session.started_at, timezone)}
            </span>
            {session.routine_id ? <Badge>De rutina</Badge> : null}
            {archived ? <Badge>Archivado</Badge> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {session.duration_minutes !== null ? <Badge>{session.duration_minutes} min</Badge> : null}
            {session.rpe !== null ? <Badge>Esfuerzo {session.rpe}/10</Badge> : null}
            {allSets.length > 0 ? <Badge>{allSets.length} series</Badge> : null}
            {volume > 0 ? <Badge>Volumen {formatKg(volume)}</Badge> : null}
          </div>

          {session.exercises.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {session.exercises.map((ex) => (
                <li key={ex.id}>
                  <p className="font-medium">{ex.name}</p>
                  {ex.sets.length > 0 ? (
                    <p className="tabular-nums text-muted-foreground">{ex.sets.map(formatSet).join(" · ")}</p>
                  ) : null}
                  {ex.distance_km !== null || ex.duration_min !== null ? (
                    <p className="text-muted-foreground">
                      {ex.distance_km !== null ? `${ex.distance_km} km` : ""}
                      {ex.distance_km !== null && ex.duration_min !== null ? " · " : ""}
                      {ex.duration_min !== null ? `${ex.duration_min} min` : ""}
                    </p>
                  ) : null}
                  {ex.notes ? <p className="break-words text-xs text-muted-foreground">{ex.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {session.notes ? <p className="mt-2 break-words text-sm text-muted-foreground">{session.notes}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!archived ? (
            <SessionFormDialog
              session={session}
              routine={routine}
              timezone={timezone}
              defaultStartedAt=""
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label}`}>
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
            aria-label={`${archived ? "Restaurar" : "Archivar"} ${label}`}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
