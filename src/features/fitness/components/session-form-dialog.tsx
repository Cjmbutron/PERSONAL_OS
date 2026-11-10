"use client";

import { useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { RoutineDetail, SessionDetail } from "@/features/fitness/queries";
import { SessionForm } from "./session-form";

export function SessionFormDialog({
  session,
  routine,
  timezone,
  defaultStartedAt,
  trigger,
  defaultOpen = false,
}: {
  session?: SessionDetail;
  routine: RoutineDetail | null;
  timezone: string;
  defaultStartedAt: string;
  trigger: React.ReactNode;
  /** Abre el formulario al montar (lo usa el registro rápido). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) clearQuickParam();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{session ? "Editar entrenamiento" : "Registrar entrenamiento"}</DialogTitle>
          <DialogDescription>La hora se interpreta en tu zona horaria.</DialogDescription>
        </DialogHeader>
        <SessionForm
          session={session}
          routine={routine}
          timezone={timezone}
          defaultStartedAt={defaultStartedAt}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
