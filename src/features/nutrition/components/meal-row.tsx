"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { setMealArchived } from "@/features/nutrition/actions";
import { MEAL_TYPE_LABELS } from "@/lib/constants/labels";
import { formatGrams, formatKcal } from "@/lib/nutrition/stats";
import { formatClock, formatDate } from "@/lib/utils/date";
import type { MealLogRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealFormDialog } from "./meal-form-dialog";

export function MealRow({
  meal,
  timezone,
  showDate = false,
}: {
  meal: MealLogRow;
  timezone: string;
  /** En la vista de archivadas conviene ver también el día. */
  showDate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const archived = meal.archived_at !== null;
  const label = `${MEAL_TYPE_LABELS[meal.meal_type]} de las ${formatClock(meal.eaten_at, timezone)}`;

  function toggleArchive() {
    setError(undefined);
    startTransition(async () => {
      const result = await setMealArchived(meal.id, !archived);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">{MEAL_TYPE_LABELS[meal.meal_type]}</Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {showDate ? `${formatDate(meal.eaten_date)} · ` : ""}
              {formatClock(meal.eaten_at, timezone)}
            </span>
            {archived ? <Badge>Archivada</Badge> : null}
          </div>
          <p className="mt-1.5 break-words font-medium">{meal.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meal.calories !== null ? <Badge>{formatKcal(meal.calories)}</Badge> : null}
            {meal.protein_g !== null ? <Badge>Proteínas {formatGrams(meal.protein_g)}</Badge> : null}
            {meal.carbs_g !== null ? <Badge>Carbohidratos {formatGrams(meal.carbs_g)}</Badge> : null}
            {meal.fat_g !== null ? <Badge>Grasas {formatGrams(meal.fat_g)}</Badge> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!archived ? (
            <MealFormDialog
              meal={meal}
              timezone={timezone}
              defaultEatenAt=""
              defaultType={meal.meal_type}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label}`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleArchive}
            disabled={pending}
            aria-label={`${archived ? "Restaurar" : "Archivar"} ${label}`}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
