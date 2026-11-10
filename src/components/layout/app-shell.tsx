import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import { QuickAdd } from "./quick-add";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#contenido"
        className="sr-only z-[70] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="contenido" tabIndex={-1} className="outline-none mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <QuickAdd variant="fab" />
    </div>
  );
}
