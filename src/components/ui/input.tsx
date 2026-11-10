import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const controlClasses =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground md:text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

/** En campos numéricos el teclado del celular se ajusta solo: con decimales si el paso lo admite. */
function numericMode(type: string, step: string | number | undefined) {
  if (type !== "number") return undefined;
  const s = step === undefined ? "1" : String(step);
  return s === "1" || s === "any" ? (s === "any" ? "decimal" : "numeric") : "decimal";
}

export function Input({ className, type = "text", step, inputMode, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      step={step}
      inputMode={inputMode ?? numericMode(type, step)}
      className={cn(controlClasses, "h-11 md:h-10", className)}
      {...props}
    />
  );
}
