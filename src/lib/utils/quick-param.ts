/** Parámetro `?nuevo=` con el que el registro rápido abre un formulario al llegar a una página. */
export const QUICK_PARAM = "nuevo";

export function quickParam(raw: Record<string, string | string[] | undefined>): string | undefined {
  const v = raw[QUICK_PARAM];
  return Array.isArray(v) ? v[0] : v;
}

/** Quita `?nuevo=` de la barra de direcciones al cerrar el formulario, para que un refresco no lo reabra. */
export function clearQuickParam() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(QUICK_PARAM)) return;
  url.searchParams.delete(QUICK_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
