import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { areaColor } from "@/lib/constants/areas";

/** `area` marca la tarjeta con el color de su dimensión (borde superior). */
export function Card({ className, area, style, ...props }: React.ComponentProps<"div"> & { area?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card text-foreground", area && "border-t-[3px] border-t-[var(--card-area)]", className)}
      style={area ? ({ ...style, "--card-area": areaColor(area) } as React.CSSProperties) : style}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-base font-semibold leading-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
