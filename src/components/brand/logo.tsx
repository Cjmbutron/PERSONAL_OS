import { cn } from "@/lib/utils/cn";

/**
 * Marca (D-115): una "P" en movimiento, hecha de hojas inclinadas que suben hacia la derecha.
 * El degradado va del verde azulado de la app al azul; el bloque ámbar es "hoy".
 * El fondo siempre es oscuro, así que la marca se ve igual en tema claro y oscuro.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="pos-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10262b" />
          <stop offset="1" stopColor="#0a1416" />
        </linearGradient>
        <linearGradient id="pos-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd6d2" />
          <stop offset="1" stopColor="#2b8fd6" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="url(#pos-bg)" stroke="#ffffff" strokeOpacity=".14" />
      <g transform="translate(-3.5 -2)">
        <path d="M17 52 L30 16 H37 L24 52 Z" fill="url(#pos-g)" />
        <path d="M33 16 H46 Q54 16 54 24 Q54 32 46 32 H28 L31 25 H44 Q47 25 47 23 Q47 22 44 22 H31 Z" fill="url(#pos-g)" />
        <path d="M30 40 H40 L35 52 H25 Z" fill="#f2b84b" />
      </g>
    </svg>
  );
}

/** Marca + nombre. `tone="onPrimary"` para fondos del color primario (el nombre va en blanco). */
export function Logo({
  className,
  markClassName = "size-8",
  tone = "default",
}: {
  className?: string;
  markClassName?: string;
  tone?: "default" | "onPrimary";
}) {
  const onPrimary = tone === "onPrimary";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display font-semibold tracking-tight">
        Personal <span className={onPrimary ? "opacity-85" : "text-primary"}>OS</span>
      </span>
    </span>
  );
}
