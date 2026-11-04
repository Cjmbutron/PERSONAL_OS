"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SleepRecordRow } from "@/types/database";
import { SleepForm } from "./sleep-form";

export function SleepFormDialog({
  record,
  timezone,
  today,
  trigger,
}: {
  record?: SleepRecordRow;
  timezone: string;
  today: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
