"use client";

import { useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MealLogRow, MealType } from "@/types/database";
import { MealForm } from "./meal-form";

export function MealFormDialog({
  meal,
  timezone,
  defaultEatenAt,
  defaultType,
  trigger,
  defaultOpen = false,
}: {
  meal?: MealLogRow;
  timezone: string;
  defaultEatenAt: string;
  defaultType: MealType;
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
          <DialogTitle>{meal ? "Editar comida" : "Registrar comida"}</DialogTitle>
          <DialogDescription>La hora se interpreta en tu zona horaria.</DialogDescription>
        </DialogHeader>
        <MealForm
          meal={meal}
          timezone={timezone}
          defaultEatenAt={defaultEatenAt}
          defaultType={defaultType}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
