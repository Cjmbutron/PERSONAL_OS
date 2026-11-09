import type { Metadata } from "next";
import { Suspense } from "react";
import { BellOff } from "lucide-react";
import { getWorkspaceContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/utils/date";
import { listNotices } from "@/features/notices/queries";
import { NoticeList } from "@/features/notices/components/notice-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton, PageTitleSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Avisos" };

export default function NoticesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageTitleSkeleton />
          <GridSkeleton />
        </>
      }
    >
      <NoticesContent />
    </Suspense>
  );
}

async function NoticesContent() {
  const ctx = await getWorkspaceContext();
  const today = todayIn(ctx.profile.timezone);
  const notices = (await listNotices(ctx.workspace.id, today)).filter((n) => n.state !== "dismissed");

  return (
    <>
      <PageHeader title="Avisos" description="Tareas por vencer, pagos próximos y tu revisión semanal." />
      {notices.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nada pendiente por ahora"
          description="Te avisaremos aquí cuando una tarea o un pago esté por vencer."
        />
      ) : (
        <NoticeList items={notices.map((n) => ({ ...n, state: n.state === "new" ? "new" : "read" }))} />
      )}
    </>
  );
}
