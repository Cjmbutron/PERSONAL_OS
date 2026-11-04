"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NavLinks } from "./nav-links";

/** Navegación compacta para móvil: panel lateral accesible (foco atrapado, Esc para cerrar). */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-72 max-w-72 translate-x-0 translate-y-0 rounded-none">
        <DialogTitle className="mb-1">PERSONAL OS</DialogTitle>
        <DialogDescription className="mb-4">Navega entre tus módulos.</DialogDescription>
        <NavLinks onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
