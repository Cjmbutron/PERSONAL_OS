"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { formDataToObject } from "@/lib/validations/common";
import {
  GENERIC_ERROR,
  echoValues,
  fail,
  failFromZod,
  type ActionState,
} from "@/lib/actions";

const SENSITIVE = ["password", "confirmPassword"];

async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = echoValues(formData, SENSITIVE);
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.", { values });
    }
    // Mensaje único: no revela si el correo existe.
    if (error.status === 400 || error.code === "invalid_credentials") {
      return fail("Correo o contraseña incorrectos.", { values });
    }
    console.error("[auth] signIn", error.code, error.message);
    return fail(GENERIC_ERROR, { values });
  }

  redirect("/dashboard");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = echoValues(formData, SENSITIVE);
  const parsed = registerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return failFromZod(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await getOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return fail("La contraseña es demasiado débil. Usa una más larga o más variada.", {
        fieldErrors: { password: ["Contraseña demasiado débil"] },
        values,
      });
    }
    console.error("[auth] signUp", error.code, error.message);
    // Mensaje deliberadamente genérico para no permitir enumerar cuentas existentes.
    return fail("No se pudo crear la cuenta. Si ya tienes una, inicia sesión.", { values });
  }

  // Con la confirmación de correo desactivada Supabase devuelve sesión inmediata.
  if (data.session) redirect("/dashboard");

  return {
    ok: true,
    message: "Te enviamos un correo para confirmar tu cuenta. Ábrelo y sigue el enlace para continuar.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
