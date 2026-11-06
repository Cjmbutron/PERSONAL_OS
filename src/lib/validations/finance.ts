import { z } from "zod";
import { ACCOUNT_TYPES, CATEGORY_KINDS, OBLIGATION_RECURRENCES } from "@/types/database";
import { CURRENCIES, roundMoney } from "@/lib/finance/money";
import { emptyToNull, optionalText } from "./common";

/** Los límites replican los CHECK y tipos de la migración 7: la BD es la última defensa (RNF-07). */

const MAX_AMOUNT = 999_999_999_999.99; // NUMERIC(14,2)

/** Campo vacío = 0; admite negativos (una cuenta puede empezar con deuda) y redondea a centavos. */
const openingBalance = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? 0 : v),
  z.coerce
    .number({ error: "Escribe un importe válido" })
    .min(-MAX_AMOUNT, { error: "Importe fuera de rango" })
    .max(MAX_AMOUNT, { error: "Importe fuera de rango" })
    .transform(roundMoney),
);

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre" }).max(100, { error: "Máximo 100 caracteres" }),
  accountType: z.enum(ACCOUNT_TYPES, { error: "Tipo de cuenta no válido" }),
  currency: z.enum(CURRENCIES, { error: "Moneda no habilitada" }),
  openingBalance,
});

/** Al editar, la moneda no se envía: no puede cambiar. */
export const accountEditSchema = accountInputSchema.omit({ currency: true });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre" }).max(60, { error: "Máximo 60 caracteres" }),
  kind: z.enum(CATEGORY_KINDS, { error: "Tipo de categoría no válido" }),
});

export const categoryEditSchema = categoryInputSchema.omit({ kind: true });

// --- Movimientos y transferencias (D-46 a D-51) ----------------------------------

const amount = z.coerce
  .number({ error: "Escribe un importe válido" })
  .min(0.01, { error: "El importe debe ser mayor que cero" })
  .max(MAX_AMOUNT, { error: "Importe fuera de rango" })
  .transform(roundMoney);

const isoDate = z.iso.date({ error: "Fecha no válida" });

export const transactionInputSchema = z.object({
  kind: z.enum(["income", "expense"], { error: "Tipo de movimiento no válido" }),
  accountId: z.uuid({ error: "Elige una cuenta" }),
  categoryId: z.uuid({ error: "Elige una categoría" }),
  amount,
  date: isoDate,
  description: optionalText(300),
});

/** Al editar no cambian ni la cuenta ni el tipo. */
export const transactionEditSchema = transactionInputSchema.omit({ kind: true, accountId: true });

export const transferInputSchema = z
  .object({
    fromAccountId: z.uuid({ error: "Elige la cuenta de origen" }),
    toAccountId: z.uuid({ error: "Elige la cuenta de destino" }),
    amount,
    date: isoDate,
    description: optionalText(300),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    error: "Las cuentas de origen y destino deben ser distintas",
    path: ["toAccountId"],
  });

// --- Presupuestos y obligaciones (D-52, D-54) -----------------------------------------

export const budgetInputSchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Mes no válido" })
    .transform((v) => `${v}-01`),
  /** Vacío = tope del total del mes. */
  categoryId: emptyToNull(z.uuid({ error: "Categoría no válida" })),
  currency: z.enum(CURRENCIES, { error: "Moneda no habilitada" }),
  amount,
});

/** Al editar solo cambia el importe. */
export const budgetEditSchema = budgetInputSchema.pick({ amount: true });

export const obligationInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre" }).max(100, { error: "Máximo 100 caracteres" }),
  amount,
  currency: z.enum(CURRENCIES, { error: "Moneda no habilitada" }),
  dueDate: isoDate,
  recurrence: z.enum(OBLIGATION_RECURRENCES, { error: "Recurrencia no válida" }),
  categoryId: emptyToNull(z.uuid({ error: "Categoría no válida" })),
});

/** Al editar no cambia la moneda. */
export const obligationEditSchema = obligationInputSchema.omit({ currency: true });

export const payObligationSchema = z.object({
  accountId: z.uuid({ error: "Elige una cuenta" }),
  date: isoDate,
  categoryId: emptyToNull(z.uuid({ error: "Categoría no válida" })),
});
