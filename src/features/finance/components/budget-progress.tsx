import { cn } from "@/lib/utils/cn";
import { BUDGET_LEVEL_LABELS, budgetLevel, budgetPercent } from "@/lib/finance/stats";
import { Badge } from "@/components/ui/badge";

const TONE = { ok: "success", warning: "warning", exceeded: "danger" } as const;
const BAR = { ok: "bg-success", warning: "bg-warning", exceeded: "bg-destructive" } as const;

/** Barra de avance + estado en texto (el color nunca es el único canal, RNF-09). */
export function BudgetProgress({ spent, limit, label }: { spent: number; limit: number; label: string }) {
  const level = budgetLevel(spent, limit);
  const pct = budgetPercent(spent, limit);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={`${label}: ${pct} % del presupuesto gastado`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", BAR[level])} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="tabular-nums text-muted-foreground">{pct} %</span>
        <Badge tone={TONE[level]}>{BUDGET_LEVEL_LABELS[level]}</Badge>
      </div>
    </div>
  );
}
