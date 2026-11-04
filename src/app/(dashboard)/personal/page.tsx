import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Vida personal" };

export default function Page() {
  return <ComingSoon code="PERSONAL" />;
}
