"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/features/auth/actions";
import { initialActionState } from "@/lib/actions";
import { FormMessage } from "@/components/shared/form-message";
import { TextField } from "@/components/shared/fields";
import { SubmitButton } from "@/components/shared/submit-button";

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialActionState);
  const params = useSearchParams();
  const callbackError = params.get("error") === "callback";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {callbackError && !state.message ? (
        <FormMessage message="El enlace de confirmación no es válido o expiró. Inicia sesión o regístrate de nuevo." />
      ) : null}
      <FormMessage message={state.message} />
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
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
