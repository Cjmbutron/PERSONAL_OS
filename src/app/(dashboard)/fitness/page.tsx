import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Entrenamiento" };

export default function Page() {
  return <ComingSoon code="FITNESS" />;
}
