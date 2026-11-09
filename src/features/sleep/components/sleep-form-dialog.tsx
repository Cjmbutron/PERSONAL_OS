"use client";

import { useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SleepRecordRow } from "@/types/database";
import { SleepForm } from "./sleep-form";

export function SleepFormDialog({
  record,
  timezone,
  today,
  trigger,
  defaultOpen = false,
}: {
  record?: SleepRecordRow;
  timezone: string;
  today: string;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Editar sueño" : "Registrar sueño"}</DialogTitle>
          <DialogDescription>
            Las horas se interpretan en tu zona horaria. La duración se calcula sola.
          </DialogDescription>
        </DialogHeader>
        <SleepForm record={record} timezone={timezone} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
