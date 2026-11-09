"use client";

import { useState } from "react";
import { clearQuickParam } from "@/lib/utils/quick-param";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { LifeAreaRow, TaskRow } from "@/types/database";
import { TaskForm, type ProjectOption } from "./task-form";

/**
 * El formulario vive dentro del contenido del diálogo: al cerrarse se desmonta,
 * así cada apertura empieza con estado limpio.
 */
export function TaskFormDialog({
  task,
  projects,
  areas,
  defaultProjectId,
  trigger,
  defaultOpen = false,
}: {
  task?: TaskRow;
  projects: ProjectOption[];
  areas: LifeAreaRow[];
  defaultProjectId?: string;
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
          <DialogTitle>{task ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            {task ? "Modifica los datos de la tarea." : "Describe lo que necesitas hacer."}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          projects={projects}
          areas={areas}
          defaultProjectId={defaultProjectId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
