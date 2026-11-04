/**
 * Lectura validada de las variables públicas de Supabase.
 * Falla con un mensaje claro si falta configuración, en vez de un error críptico más adelante.
 * (Solo claves públicas: la clave service_role nunca se usa en esta aplicación.)
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copia .env.example a .env.local y completa los valores de tu proyecto Supabase.",
    );
  }
  return { url, publishableKey };
}
