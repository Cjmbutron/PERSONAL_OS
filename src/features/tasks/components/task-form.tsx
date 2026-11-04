"use client";

import { useActionState } from "react";
import { createTask, updateTask } from "@/features/tasks/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants/labels";
import { PRIORITIES, TASK_STATUSES, type LifeAreaRow, type ProjectRow, type TaskRow } from "@/types/database";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField, TextareaField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export type ProjectOption = Pick<ProjectRow, "id" | "name" | "archived_at">;

export function TaskForm({
  task,
  projects,
  areas,
  defaultProjectId,
  onDone,
}: {
  task?: TaskRow;
  projects: ProjectOption[];
  areas: LifeAreaRow[];
  defaultProjectId?: string;
  onDone: () => void;
}) {
  const editing = Boolean(task);

  // El cierre del diálogo se dispara desde la propia acción, sin efectos secundarios en render.
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await (editing ? updateTask : createTask)(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    initialActionState,
  );

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  // Un proyecto archivado solo se ofrece si la tarea ya pertenece a él.
  const projectOptions = projects
    .filter((p) => !p.archived_at || p.id === task?.project_id)
    .map((p) => ({ value: p.id, label: p.archived_at ? `${p.name} (archivado)` : p.name }));

  const workArea = areas.find((a) => a.code === "WORK");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {editing ? <input type="hidden" name="id" value={task!.id} /> : null}
      <FormMessage message={state.message} />

      <TextField
        name="title"
        label="Título"
        required
        maxLength={200}
        autoFocus
        defaultValue={v("title", task?.title ?? "")}
        error={state.fieldErrors?.title}
      />
      <TextareaField
        name="description"
        label="Descripción"
        maxLength={4000}
        defaultValue={v("description", task?.description ?? "")}
        error={state.fieldErrors?.description}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="priority"
          label="Prioridad"
          defaultValue={v("priority", task?.priority ?? "medium")}
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          error={state.fieldErrors?.priority}
        />
        <SelectField
          name="status"
          label="Estado"
          defaultValue={v("status", task?.status ?? "pending")}
          options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
          error={state.fieldErrors?.status}
        />
        <TextField
          name="dueDate"
          label="Fecha de vencimiento"
          type="date"
          defaultValue={v("dueDate", task?.due_date ?? "")}
          error={state.fieldErrors?.dueDate}
        />
        <SelectField
          name="projectId"
          label="Proyecto"
          placeholder="Sin proyecto"
          defaultValue={v("projectId", task?.project_id ?? defaultProjectId ?? "")}
          options={projectOptions}
          error={state.fieldErrors?.projectId}
        />
      </div>

      <SelectField
        name="lifeAreaId"
        label="Dimensión"
        placeholder="Sin dimensión"
        defaultValue={v("lifeAreaId", task ? (task.life_area_id ?? "") : (workArea?.id ?? ""))}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
        error={state.fieldErrors?.lifeAreaId}
      />

      <SubmitButton pendingText="Guardando…">{editing ? "Guardar cambios" : "Crear tarea"}</SubmitButton>
    </form>
  );
}
