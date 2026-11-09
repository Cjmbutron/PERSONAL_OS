"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState } from "react";
import { createProject, updateProject } from "@/features/projects/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { PROJECT_STATUS_LABELS } from "@/lib/constants/labels";
import { PROJECT_STATUSES, type LifeAreaRow, type ProjectRow } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export function ProjectForm({
  project,
  areas,
  onDone,
}: {
  project?: ProjectRow;
  areas: LifeAreaRow[];
  onDone: () => void;
}) {
  const editing = Boolean(project);

  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await (editing ? updateProject : createProject)(prev, formData);
      if (result.ok) {
        toast("Proyecto guardado");
        onDone();
      }
      return result;
    },
    initialActionState,
  );

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const workArea = areas.find((a) => a.code === "WORK");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={project!.id} /> : null}
      <FormMessage message={state.message} />

      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={120}
        autoFocus
        defaultValue={v("name", project?.name ?? "")}
        error={state.fieldErrors?.name}
      />
      <TextareaField
        name="description"
        label="Descripción"
        maxLength={2000}
        defaultValue={v("description", project?.description ?? "")}
        error={state.fieldErrors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="status"
          label="Estado"
          defaultValue={v("status", project?.status ?? "active")}
          options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
          error={state.fieldErrors?.status}
        />
        <TextField
          name="dueDate"
          label="Fecha límite"
          type="date"
          defaultValue={v("dueDate", project?.due_date ?? "")}
          error={state.fieldErrors?.dueDate}
        />
      </div>
      <SelectField
        name="lifeAreaId"
        label="Dimensión"
        placeholder="Sin dimensión"
        defaultValue={v("lifeAreaId", project ? (project.life_area_id ?? "") : (workArea?.id ?? ""))}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
        error={state.fieldErrors?.lifeAreaId}
      />
      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Crear proyecto"}</SubmitButton>
    </form>
  );
}
