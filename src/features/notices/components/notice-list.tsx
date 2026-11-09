"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCheck, ClipboardCheck, Wallet, X } from "lucide-react";
import { dismissNotice, markNoticesRead, restoreNotice } from "@/features/notices/actions";
import type { NoticeKind } from "@/lib/notices/compute";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export type NoticeItem = {
  key: string;
  kind: NoticeKind;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  state: "new" | "read";
};

const ICONS = { task: CalendarClock, obligation: Wallet, "weekly-review": ClipboardCheck } as const;
const TONE_TEXT = { danger: "text-destructive", warning: "text-warning", info: "text-primary" } as const;

export function NoticeList({ items }: { items: NoticeItem[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => i.state === "new");

  function markAll() {
    startTransition(async () => {
      const r = await markNoticesRead(unread.map((i) => i.key));
      if (!r.ok) toast(r.message ?? "No se pudo marcar como leído");
    });
  }

  function dismiss(item: NoticeItem) {
    startTransition(async () => {
      const r = await dismissNotice(item.key);
      if (!r.ok) return toast(r.message ?? "No se pudo descartar");
      toast({
        message: "Aviso descartado",
        actionLabel: "Deshacer",
        onAction: () => void restoreNotice(item.key),
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {unread.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={markAll} disabled={pending}>
            <CheckCheck aria-hidden /> Marcar todo como leído
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.tone === "danger" ? AlertTriangle : ICONS[item.kind];
          const isNew = item.state === "new";
          return (
            <li
              key={item.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-card p-3 sm:p-4",
                isNew && "border-l-4 border-l-primary",
              )}
            >
              <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", TONE_TEXT[item.tone])} />
              <Link href={item.href} className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <p className={cn("break-words", isNew ? "font-semibold" : "font-medium")}>
                  {item.title}
                  {isNew ? <span className="sr-only"> (sin leer)</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Descartar aviso: ${item.title}`}
                disabled={pending}
                onClick={() => dismiss(item)}
              >
                <X aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
