/** Monedas habilitadas (D-40). Debe coincidir con la restricción `financial_accounts_currency_enabled`. */
export const CURRENCIES = ["BOB"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = { BOB: "Bolivianos (BOB)" };

/** 1234.5 → "Bs 1.234,50". Nunca mezcla monedas: cada importe se formatea con la suya (D-42). */
export function formatMoney(amount: number, currency: string): string {
  const n = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  const symbol = currency === "BOB" ? "Bs" : currency;
  return `${symbol} ${n}`;
}

/** Redondea a centavos para evitar errores de coma flotante al sumar importes. */
export function roundMoney(n: number): number {
  // Simétrico respecto de cero: -150,555 y 150,555 redondean por igual (a ∓150,56).
  return Math.sign(n) * Number(Math.abs(n).toFixed(2)) || 0;
}

/** Suma importes agrupándolos por moneda; nunca suma monedas distintas (D-42). */
export function sumByCurrency(items: readonly { currency: string; amount: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { currency, amount } of items) totals.set(currency, roundMoney((totals.get(currency) ?? 0) + amount));
  return totals;
}
