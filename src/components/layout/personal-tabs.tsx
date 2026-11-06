"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/personal", label: "Resumen", exact: true },
  { href: "/personal/calendar", label: "Calendario", exact: false },
  { href: "/personal/goals", label: "Objetivos", exact: false },
];

export function PersonalTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de Vida personal" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
