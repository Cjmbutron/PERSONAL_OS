"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/constants/labels";
import { areaColor } from "@/lib/constants/areas";
import { cn } from "@/lib/utils/cn";
import { MODULE_ICONS } from "./nav-icons";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {MODULES.map((m) => {
        const Icon = MODULE_ICONS[m.code];
        const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            style={active ? { backgroundColor: `color-mix(in oklab, ${areaColor(m.code)} 12%, transparent)` } : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" style={{ color: areaColor(m.code) }} aria-hidden />
            <span className="flex-1">{m.label}</span>
            {!m.available ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Pronto
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
