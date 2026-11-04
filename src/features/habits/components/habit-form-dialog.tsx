"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { HabitRow, LifeAreaRow } from "@/types/database";
import { HabitForm } from "./habit-form";

export function HabitFormDialog({
  habit,
  areas,
  trigger,
}: {
  habit?: HabitRow;
  areas: LifeAreaRow[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{habit ? "Editar hábito" : "Nuevo hábito"}</DialogTitle>
          <DialogDescription>
            {habit
              ? "Si cambias la frecuencia, se aplica también al historial al calcular la racha."
              : "Elige algo pequeño y realista que puedas sostener."}
          </DialogDescription>
        </DialogHeader>
        <HabitForm habit={habit} areas={areas} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
