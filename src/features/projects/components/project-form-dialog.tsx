"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { LifeAreaRow, ProjectRow } from "@/types/database";
import { ProjectForm } from "./project-form";

export function ProjectFormDialog({
  project,
  areas,
  trigger,
}: {
  project?: ProjectRow;
  areas: LifeAreaRow[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
          <DialogDescription>
            {project ? "Modifica los datos del proyecto." : "Agrupa tareas bajo un mismo objetivo."}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm project={project} areas={areas} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
