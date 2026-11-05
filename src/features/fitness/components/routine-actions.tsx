"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CopyPlus } from "lucide-react";
import { duplicateRoutine, setRoutineArchived } from "@/features/fitness/actions";
import { monthLabel } from "@/lib/fitness/stats";
import { Button } from "@/components/ui/button";

/** Duplicar al mes siguiente (D-36) y archivar/restaurar (D-21). */
export function RoutineActions({
  routineId,
  nextMonth,
  archived = false,
  onlyArchive = false,
  label,
}: {
  routineId: string;
  nextMonth: string;
  archived?: boolean;
  onlyArchive?: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, okText?: string) {
    setMessage(undefined);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMessage({ text: r.message ?? "No se pudo completar la operación.", ok: false });
      else if (okText) setMessage({ text: okText, ok: true });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {!onlyArchive && !archived ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => duplicateRoutine(routineId, nextMonth), `Copiada a ${monthLabel(nextMonth)}.`)}
          >
            <CopyPlus aria-hidden />
            Duplicar a {monthLabel(nextMonth).split(" ")[0]}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`${archived ? "Restaurar" : "Archivar"} ${label}`}
          onClick={() => run(() => setRoutineArchived(routineId, !archived))}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? "Restaurar" : "Archivar"}
        </Button>
      </div>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
