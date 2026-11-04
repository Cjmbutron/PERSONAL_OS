import Link from "next/link";
import { Suspense } from "react";
import { MobileNav } from "./mobile-nav";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
      <MobileNav />
      <Link href="/dashboard" className="text-sm font-semibold tracking-tight md:hidden">
        PERSONAL OS
      </Link>
      <div className="ml-auto">
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
