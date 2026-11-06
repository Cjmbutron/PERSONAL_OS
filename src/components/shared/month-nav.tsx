import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Navegación mes anterior / siguiente. Las rutas las arma la página (conservan sus filtros). */
export function MonthNav({
  label,
  prevHref,
  nextHref,
  currentHref,
}: {
  label: string;
  prevHref: string;
  nextHref: string;
  /** Si se indica, muestra el enlace "Ir al mes actual" (se omite cuando ya se está en él). */
  currentHref?: string;
}) {
  return (
    <nav aria-label="Mes" className="mb-4 flex items-center justify-between gap-2">
      <Link
        href={prevHref}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Anterior
      </Link>
      <div className="text-center">
        <p className="font-medium capitalize">{label}</p>
        {currentHref ? (
          <Link href={currentHref} className="text-xs font-medium text-primary hover:underline">
            Ir al mes actual
          </Link>
        ) : null}
      </div>
      <Link
        href={nextHref}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        aria-label="Mes siguiente"
      >
        Siguiente
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}
