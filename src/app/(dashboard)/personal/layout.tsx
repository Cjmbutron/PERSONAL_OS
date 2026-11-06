import { PersonalTabs } from "@/components/layout/personal-tabs";

export default function PersonalLayout({ children }: LayoutProps<"/personal">) {
  return (
    <>
      <PersonalTabs />
      {children}
    </>
  );
}
