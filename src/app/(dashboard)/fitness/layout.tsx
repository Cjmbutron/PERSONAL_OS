import { FitnessTabs } from "@/components/layout/fitness-tabs";

export default function FitnessLayout({ children }: LayoutProps<"/fitness">) {
  return (
    <>
      <FitnessTabs />
      {children}
    </>
  );
}
