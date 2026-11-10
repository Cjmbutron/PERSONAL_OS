import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "./nav-links";
import { QuickAdd } from "./quick-add";

/** Barra lateral fija de escritorio (9.2). En móvil se sustituye por BottomNav. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-card p-4 md:flex">
      <Link href="/dashboard" aria-label="Personal OS, ir al panel" className="rounded-md px-3 pt-1 text-lg">
        <Logo markClassName="size-8" />
      </Link>
      <QuickAdd variant="sidebar" />
      <NavLinks />
    </aside>
  );
}
