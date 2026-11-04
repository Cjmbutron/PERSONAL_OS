import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses } from "./input";

/**
 * Se usa <select> nativo a propósito: es accesible por teclado, funciona sin JavaScript
 * y en móvil abre el selector del sistema (mejor UX que un desplegable personalizado).
 */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(controlClasses, "h-10", className)} {...props}>
      {children}
    </select>
  );
}
