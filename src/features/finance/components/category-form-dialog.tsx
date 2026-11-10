"use client";

import { useToast } from "@/components/ui/toast";
import { useActionState, useState } from "react";
import { saveCategory } from "@/features/finance/actions";
import { initialActionState, type ActionState } from "@/lib/actions";
import { CATEGORY_KIND_LABELS } from "@/lib/constants/labels";
import { CATEGORY_KINDS, type CategoryKind, type TransactionCategoryRow } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import { SelectField, TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

function CategoryForm({
  category,
  defaultKind,
  parent,
  onDone,
}: {
  category?: TransactionCategoryRow;
  defaultKind: CategoryKind;
  parent?: TransactionCategoryRow;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveCategory(prev, formData);
      if (result.ok) {
        toast("Categoría guardada");
        onDone();
      }
      return result;
    },
    initialActionState,
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <FormMessage message={state.message} />
      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={60}
        autoFocus
        defaultValue={v("name", category?.name ?? "")}
        error={state.fieldErrors?.name}
      />
      {parent ? <input type="hidden" name="parentId" value={parent.id} /> : null}
      {parent ? (
        <p className="text-sm text-muted-foreground">
          Dentro de <span className="font-medium text-foreground">{parent.name}</span> ({CATEGORY_KIND_LABELS[parent.kind]}).
        </p>
      ) : category ? (
        <p className="text-sm text-muted-foreground">
          Tipo: <span className="font-medium text-foreground">{CATEGORY_KIND_LABELS[category.kind]}</span> (no se puede cambiar).
        </p>
      ) : (
        <SelectField
          name="kind"
          label="Tipo"
          required
          defaultValue={v("kind", defaultKind)}
          options={CATEGORY_KINDS.map((k) => ({ value: k, label: CATEGORY_KIND_LABELS[k] }))}
          error={state.fieldErrors?.kind}
        />
      )}
      <SubmitButton pendingText="Guardando…">{category ? "Guardar cambios" : parent ? "Crear subcategoría" : "Crear categoría"}</SubmitButton>
    </form>
  );
}

export function CategoryFormDialog({
  category,
  defaultKind = "expense",
  parent,
  trigger,
}: {
  category?: TransactionCategoryRow;
  defaultKind?: CategoryKind;
  /** Crea una subcategoría dentro de esta categoría principal. */
  parent?: TransactionCategoryRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : parent ? "Nueva subcategoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>Un gasto solo admite categorías de gasto y un ingreso, de ingreso.</DialogDescription>
        </DialogHeader>
        <CategoryForm category={category} defaultKind={defaultKind} parent={parent} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
