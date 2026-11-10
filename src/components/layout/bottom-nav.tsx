"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { areaColor } from "@/lib/constants/areas";
import { MODULES } from "@/lib/constants/labels";
import { cn } from "@/lib/utils/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MODULE_ICONS } from "./nav-icons";
import { NavLinks } from "./nav-links";

const MAIN = ["DASHBOARD", "WORK", "HABITS"] as const;

/** Barra inferior del celular: tres accesos frecuentes, el botón de registro (aparte) y "Más" con todos los módulos. */
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = MODULES.filter((m) => (MAIN as readonly string[]).includes(m.code));

  const link = (m: (typeof items)[number]) => {
    const Icon = MODULE_ICONS[m.code];
    const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
    return (
      <Link
        key={m.code}
        href={m.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}
      >
        <Icon className="size-5" style={active ? { color: areaColor(m.code) } : undefined} aria-hidden />
        {m.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {items.slice(0, 2).map(link)}
        {/* Hueco central para el botón de registro. */}
        <div className="w-16 shrink-0" aria-hidden />
        {items.slice(2).map(link)}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" aria-hidden />
          Más
        </button>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent placement="free" className="left-0 top-0 h-dvh max-h-dvh w-72 max-w-72 translate-x-0 translate-y-0 rounded-none rounded-r-2xl">
          <DialogTitle className="font-display mb-1">PERSONAL OS</DialogTitle>
          <DialogDescription className="mb-4">Todos tus módulos.</DialogDescription>
          <NavLinks onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
