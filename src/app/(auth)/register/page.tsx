import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="mb-5 text-sm text-muted-foreground">Tu espacio personal se crea automáticamente al registrarte.</p>
      <RegisterForm />
    </>
  );
}
