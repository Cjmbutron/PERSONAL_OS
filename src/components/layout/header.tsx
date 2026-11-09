import Link from "next/link";
import { Suspense } from "react";
import { NoticeBell, NoticeBellSkeleton } from "./notice-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
      <Link href="/dashboard" className="font-display text-base font-semibold tracking-tight md:hidden">
        PERSONAL OS
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <Suspense fallback={<NoticeBellSkeleton />}>
          <NoticeBell />
        </Suspense>
        <ThemeToggle />
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
