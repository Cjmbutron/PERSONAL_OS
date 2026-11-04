import Link from "next/link";
import { NavLinks } from "./nav-links";

/** Barra lateral fija de escritorio (9.2). En móvil se sustituye por MobileNav. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-card p-4 md:flex">
      <Link href="/dashboard" className="px-3 pt-1 text-base font-semibold tracking-tight">
        PERSONAL OS
      </Link>
      <NavLinks />
    </aside>
  );
}
