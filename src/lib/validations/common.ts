import { z } from "zod";

/** "" / null / undefined → null; el resto pasa al esquema interno. Útil para campos opcionales de formularios. */
export function emptyToNull<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());
}

export const optionalUuid = emptyToNull(z.uuid({ error: "Identificador no válido" }));

export const optionalDate = emptyToNull(z.iso.date({ error: "Fecha no válida" }));

/** Texto opcional: tras recortar espacios, vacío se guarda como null (no como cadena vacía). */
export const optionalText = (max: number) =>
  emptyToNull(
    z
      .string()
      .trim()
      .max(max, { error: `Máximo ${max} caracteres` })
      .transform((v) => (v === "" ? null : v)),
  );

/** Convierte FormData en objeto plano (ignorando los campos internos de React/Next). */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    out[key] = value;
  }
  return out;
}
