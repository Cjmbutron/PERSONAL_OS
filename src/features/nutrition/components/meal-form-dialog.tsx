"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MealLogRow, MealType } from "@/types/database";
import { MealForm } from "./meal-form";

export function MealFormDialog({
  meal,
  timezone,
  defaultEatenAt,
  defaultType,
  trigger,
}: {
  meal?: MealLogRow;
  timezone: string;
  defaultEatenAt: string;
  defaultType: MealType;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
