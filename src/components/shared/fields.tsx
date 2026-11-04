import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldBase = {
  name: string;
  label: string;
  /** Mensajes de error del servidor para este campo. */
  error?: string[];
  hint?: string;
};

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint && !error?.length ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error?.length ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string[], hint?: string) {
  if (error?.length) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function TextField({
  name,
  label,
  error,
  hint,
  id,
  required,
  ...props
}: FieldBase & Omit<React.ComponentProps<typeof Input>, "name" | "id"> & { id?: string }) {
  const fieldId = id ?? `field-${name}`;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <Input
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextareaField({
  name,
  label,
  error,
  hint,
  id,
  required,
  ...props
}: FieldBase & Omit<React.ComponentProps<typeof Textarea>, "name" | "id"> & { id?: string }) {
  const fieldId = id ?? `field-${name}`;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <Textarea
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  name,
  label,
  error,
  hint,
  id,
  required,
  options,
  placeholder,
  ...props
}: FieldBase &
  Omit<React.ComponentProps<typeof Select>, "name" | "id" | "children"> & {
    id?: string;
    options: SelectOption[];
    /** Si se indica, añade una primera opción vacía con este texto. */
    placeholder?: string;
  }) {
  const fieldId = id ?? `field-${name}`;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <Select
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}
