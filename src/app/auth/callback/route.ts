import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace de confirmación de correo (S1-07).
 * Soporta el flujo PKCE (?code=) y el de token_hash (plantillas de correo personalizadas).
 * El destino final es siempre fijo (/dashboard): no se acepta una URL de retorno del cliente,
 * lo que evita redirecciones abiertas.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
    console.error("[auth] callback exchangeCodeForSession", error.code);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
    console.error("[auth] callback verifyOtp", error.code);
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
