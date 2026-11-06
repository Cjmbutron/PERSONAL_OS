/** Helpers de mes calendario sobre fechas ISO (YYYY-MM-DD). Compartidos por Entrenamiento y Finanzas. */

/** "2026-11-17" → "2026-11-01". */
export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function addMonths(monthIso: string, n: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}
