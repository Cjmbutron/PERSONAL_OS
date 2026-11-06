import { FinanceTabs } from "@/components/layout/finance-tabs";

export default function FinanceLayout({ children }: LayoutProps<"/finance">) {
  return (
    <>
      <FinanceTabs />
      {children}
    </>
  );
}
