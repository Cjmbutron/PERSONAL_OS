import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <>
      <PageHeader title="Dashboard" description="Tu situación de hoy, de un vistazo." />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardWithPeriod searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DashboardWithPeriod({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const raw = await searchParams;
  const value = Array.isArray(raw.period) ? raw.period[0] : raw.period;
  return <DashboardContent period={value === "30" ? 30 : 7} />;
}
