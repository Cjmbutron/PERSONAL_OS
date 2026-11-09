import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const TONES = {
  neutral: "text-foreground",
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
} as const;

/** Tarjeta de indicador (9.3). Si recibe `href`, es un enlace al detalle correspondiente. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <Card className={cn("flex h-full items-center gap-4 p-4", href && "transition-colors hover:bg-muted")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={cn("font-display text-2xl font-semibold leading-none tabular-nums", TONES[tone])}>{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}
