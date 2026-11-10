import Link from "next/link";
import { connection } from "next/server";
import { Bell } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import { listNotices } from "@/features/notices/queries";
import { Skeleton } from "@/components/ui/skeleton";

/** Campana con el número de avisos sin leer. Lee la sesión: va detrás de <Suspense>. */
export async function NoticeBell() {
  // La fecha de hoy cambia en cada petición: se marca como dinámico antes de calcularla (Cache Components).
  await connection();
  const ctx = await getWorkspaceContext();
  let unread = 0;
  try {
    const notices = await listNotices(ctx.workspace.id, todayIn(ctx.profile.timezone));
    unread = notices.filter((n) => n.state === "new").length;
  } catch {
    // Un fallo al calcular avisos nunca debe romper el encabezado.
  }

  return (
    <Link
      href="/notices"
      aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : "Avisos"}
      className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Bell className="size-4" aria-hidden />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function NoticeBellSkeleton() {
  return <Skeleton className="size-8 rounded-md" />;
}
