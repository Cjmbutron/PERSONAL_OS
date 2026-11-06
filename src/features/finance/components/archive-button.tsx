"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Archivar / restaurar con mensaje de error accesible (D-45). */
export function ArchiveButton({
  action,
  id,
  archived,
  label,
}: {
  action: (id: string, archived: boolean) => Promise<ActionState>;
  id: string;
  archived: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`${archived ? "Restaurar" : "Archivar"} ${label}`}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await action(id, !archived);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
      </Button>
      {error ? (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
