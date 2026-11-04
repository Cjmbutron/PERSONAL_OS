import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Iniciar sesión</h1>
      <p className="mb-5 text-sm text-muted-foreground">Ingresa para continuar con tu espacio personal.</p>
      {/* useSearchParams exige un límite de Suspense para poder prerenderizar la página. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
