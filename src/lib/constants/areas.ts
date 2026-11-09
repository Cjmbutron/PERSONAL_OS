import type { ModuleDefinition } from "./labels";

/** Variable CSS con el color de cada módulo (definidas en globals.css, con modo claro y oscuro). */
export function areaColor(code: ModuleDefinition["code"] | string): string {
  return `var(--area-${code.toLowerCase()})`;
}
