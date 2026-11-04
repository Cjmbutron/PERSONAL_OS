"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/features/auth/actions";
import { initialActionState } from "@/lib/actions";
import { FormMessage } from "@/components/shared/form-message";
import { TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, initialActionState);

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success" message={state.message} />
        <Link href="/login" className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} />
      <TextField
        name="fullName"
        label="Nombre"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName ?? ""}
        error={state.fieldErrors?.fullName}
      />
      <TextField
        name="email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email ?? ""}
        error={state.fieldErrors?.email}
      />
      <TextField
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 8 caracteres."
        error={state.fieldErrors?.password}
      />
      <TextField
        name="confirmPassword"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
