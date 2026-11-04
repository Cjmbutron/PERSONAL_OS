import type { LifeAreaCode } from "@/types/database";
import { MODULE_ICONS } from "@/components/layout/nav-icons";
import { PageHeader } from "./page-header";

const ROADMAP: Record<Exclude<LifeAreaCode, "WORK">, { title: string; description: string; sprint: string }> = {
  FITNESS: {
    title: "Entrenamiento",
    description: "Sesiones de ejercicio, rutinas y seguimiento físico.",
    sprint: "Sprint 2",
  },
  NUTRITION: {
    title: "Alimentación",
    description: "Registro de comidas y seguimiento nutricional.",
    sprint: "Sprint 2",
  },
  SLEEP: {
    title: "Sueño y recuperación",
    description: "Registro de descanso y análisis de patrones.",
    sprint: "Sprint 2",
  },
  FINANCE: {
    title: "Finanzas personales",
    description: "Cuentas, ingresos, gastos, presupuestos y obligaciones.",
    sprint: "Sprint 3",
  },
  PERSONAL: {
    title: "Vida personal",
    description: "Actividades, objetivos y organización del tiempo libre.",
    sprint: "Sprint 4",
  },
};

/**
 * Pantalla de módulo aún no construido. Mantiene visible la estructura de las seis dimensiones
 * sin simular datos ni funciones (D-14).
 */
export function ComingSoon({ code }: { code: Exclude<LifeAreaCode, "WORK"> }) {
  const info = ROADMAP[code];
  const Icon = MODULE_ICONS[code];
  return (
    <>
      <PageHeader title={info.title} description={info.description} />
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="font-medium">Este módulo estará disponible pronto</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Está planificado para el {info.sprint} del roadmap. Mientras tanto puedes organizar tu trabajo desde el
          módulo Trabajo.
        </p>
      </div>
    </>
  );
}
