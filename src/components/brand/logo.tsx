import { cn } from "@/lib/utils/cn";

/**
 * Marca (D-115): tres escalones, como los andenes de cultivo del Altiplano y la chakana andina.
 * Cada peldaño es un paso; el de arriba, ámbar, es "hoy". Va sobre un cuadrado redondeado en el color primario.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="15" className="fill-primary" />
      <rect x="10" y="39" width="44" height="10" rx="2.5" className="fill-primary-foreground" fillOpacity=".6" />
      <rect x="18" y="27" width="28" height="10" rx="2.5" className="fill-primary-foreground" fillOpacity=".85" />
      <rect x="25" y="15" width="14" height="10" rx="2.5" fill="#f2b84b" />
    </svg>
  );
}

/** Marca + nombre. `tone="onPrimary"` para fondos del color primario. */
export function Logo({ className, markClassName = "size-8", tone = "default" }: { className?: string; markClassName?: string; tone?: "default" | "onPrimary" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn(markClassName, tone === "onPrimary" && "[&>rect:first-child]:fill-primary-foreground [&>rect:nth-child(2)]:fill-primary [&>rect:nth-child(3)]:fill-primary")} />
      <span className="font-display font-semibold tracking-tight">
        Personal <span className="text-primary" style={tone === "onPrimary" ? { color: "inherit", opacity: 0.85 } : undefined}>OS</span>
      </span>
    </span>
  );
}
