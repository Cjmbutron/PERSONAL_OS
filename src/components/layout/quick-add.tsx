"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BedDouble, CalendarPlus, CheckSquare, Flame, Plus, TrendingDown, TrendingUp, Dumbbell, Utensils, type LucideIcon } from "lucide-react";
import { areaColor } from "@/lib/constants/areas";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Tile = { label: string; hint: string; href: string; icon: LucideIcon; area: string };

const TILES: Tile[] = [
  { label: "Gasto", hint: "Lo que pagaste", href: "/finance/transactions?nuevo=gasto", icon: TrendingDown, area: "finance" },
  { label: "Ingreso", hint: "Lo que recibiste", href: "/finance/transactions?nuevo=ingreso", icon: TrendingUp, area: "finance" },
  { label: "Comida", hint: "Qué comiste", href: "/nutrition?nuevo=comida", icon: Utensils, area: "nutrition" },
  { label: "Sueño", hint: "Cómo dormiste", href: "/sleep?nuevo=sueno", icon: BedDouble, area: "sleep" },
  { label: "Entrenamiento", hint: "Sesión y series", href: "/fitness?nuevo=entrenamiento", icon: Dumbbell, area: "fitness" },
  { label: "Tarea", hint: "Algo por hacer", href: "/work/tasks?nuevo=tarea", icon: CheckSquare, area: "work" },
  { label: "Evento", hint: "Un compromiso", href: "/personal/calendar?nuevo=evento", icon: CalendarPlus, area: "personal" },
  { label: "Hábitos de hoy", hint: "Marca lo cumplido", href: "/habits", icon: Flame, area: "habits" },
];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Registro rápido: un solo lugar para anotar lo del día. En escritorio es un botón de la barra lateral
 * (atajo: tecla N); en el celular, un botón flotante al alcance del pulgar.
 */
export function QuickAdd({ variant }: { variant: "sidebar" | "fab" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (variant !== "sidebar") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 items-center justify-between gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <span className="flex items-center gap-2">
            <Plus className="size-4" aria-hidden />
            Registrar
          </span>
          <kbd className="rounded bg-primary-foreground/20 px-1.5 text-xs font-medium" aria-hidden>
            N
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Registrar"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background hover:opacity-90 md:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-md">
          <DialogTitle className="font-display">¿Qué quieres registrar?</DialogTitle>
          <DialogDescription className="mb-4">Elige y se abre el formulario listo para llenar.</DialogDescription>
          <ul className="grid grid-cols-2 gap-2">
            {TILES.map((t) => (
              <li key={t.label} className={t.label === "Hábitos de hoy" ? "col-span-2" : undefined}>
                <Link
                  href={t.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:bg-muted"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: areaColor(t.area), backgroundColor: `color-mix(in oklab, ${areaColor(t.area)} 14%, transparent)` }}
                  >
                    <t.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
