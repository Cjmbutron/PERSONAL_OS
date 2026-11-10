import { areaColor } from "@/lib/constants/areas";
import { Logo } from "@/components/brand/logo";

const DIMENSIONS = [
  { code: "work", label: "Trabajo" },
  { code: "habits", label: "Hábitos" },
  { code: "fitness", label: "Entrenamiento" },
  { code: "nutrition", label: "Alimentación" },
  { code: "sleep", label: "Sueño" },
  { code: "finance", label: "Finanzas" },
  { code: "personal", label: "Vida personal" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-dvh flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
        <Logo tone="onPrimary" markClassName="size-10" className="text-xl" />
        <div>
          <h2 className="font-display max-w-xs text-4xl font-semibold leading-tight">Tu vida entera, en un solo lugar.</h2>
          <ul className="mt-8 grid max-w-xs grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {DIMENSIONS.map((d) => (
              <li key={d.code} className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full ring-2 ring-primary-foreground/40" style={{ backgroundColor: areaColor(d.code) }} aria-hidden />
                {d.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-80">Trabajo, hábitos, salud, finanzas y vida personal, sin saltar entre aplicaciones.</p>
      </aside>

      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center md:hidden">
            <Logo markClassName="size-9" className="text-xl" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
