import { z } from "zod";

/** Resultado estándar de las Server Actions de formularios. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * Valores enviados, devueltos solo cuando hay error para repoblar el formulario
   * (React 19 reinicia los campos no controlados tras ejecutar una acción).
   * Nunca incluye contraseñas.
   */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

export const GENERIC_ERROR = "No se pudo completar la operación. Inténtalo de nuevo.";

/** Extrae los valores de texto de un FormData, omitiendo campos sensibles. */
export function echoValues(formData: FormData, exclude: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION") || exclude.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export function fail(
  message: string,
  extra?: Pick<ActionState, "fieldErrors" | "values">,
): ActionState {
  return { ok: false, message, ...extra };
}

export function failFromZod(error: z.ZodError, values?: Record<string, string>): ActionState {
  return fail("Revisa los campos marcados.", {
    fieldErrors: z.flattenError(error).fieldErrors,
    values,
  });
}

/** Traduce un error de PostgREST/PostgreSQL a un mensaje seguro para el usuario (sin filtrar detalles internos). */
export function dbErrorToState(
  error: { code?: string; message: string },
  context: string,
  values?: Record<string, string>,
): ActionState {
  console.error(`[db] ${context}`, error.code, error.message);
  switch (error.code) {
    case "23503": // foreign_key_violation (p. ej. proyecto de otro workspace, D-03)
      return fail("El proyecto o la dimensión seleccionados no son válidos.", { values });
    case "23514": // check_violation
      return fail("Algún valor no cumple las reglas permitidas. Revisa el formulario.", { values });
    case "42501": // insufficient_privilege / RLS
      return fail("No tienes permiso para realizar esta acción.", { values });
    default:
      return fail(GENERIC_ERROR, { values });
  }
}
