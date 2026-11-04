import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Finanzas" };

export default function Page() {
  return <ComingSoon code="FINANCE" />;
}
