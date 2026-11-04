import { WorkTabs } from "@/components/layout/work-tabs";

export default function WorkLayout({ children }: LayoutProps<"/work">) {
  return (
    <>
      <WorkTabs />
      {children}
    </>
  );
}
