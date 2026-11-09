"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { RoutineDetail, SessionDetail } from "@/features/fitness/queries";
import { SessionForm } from "./session-form";

export function SessionFormDialog({
  session,
  routine,
  timezone,
  defaultStartedAt,
  trigger,
}: {
  session?: SessionDetail;
  routine: RoutineDetail | null;
  timezone: string;
  defaultStartedAt: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
