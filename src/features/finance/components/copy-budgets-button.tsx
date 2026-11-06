"use client";

import { useState, useTransition } from "react";
import { CopyPlus } from "lucide-react";
import { copyBudgets } from "@/features/finance/actions";
import { monthLabel } from "@/lib/utils/month";
import { Button } from "@/components/ui/button";

/** D-52: copia los presupuestos del mes mostrado al siguiente, sin pisar los existentes. */
export function CopyBudgetsButton({ from, to }: { from: string; to: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(undefined);
          startTransition(async () => {
            const r = await copyBudgets(from, to);
            if (!r.ok) setMessage({ text: r.message ?? "No se pudo copiar.", ok: false });
            else
              setMessage({
                ok: true,
                text:
                  (r.copied ?? 0) === 0
                    ? `${monthLabel(to)} ya tenía esos presupuestos.`
                    : `${r.copied} ${r.copied === 1 ? "presupuesto copiado" : "presupuestos copiados"} a ${monthLabel(to)}.`,
              });
          });
        }}
      >
        <CopyPlus aria-hidden />
        Copiar a {monthLabel(to).split(" ")[0]}
      </Button>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
