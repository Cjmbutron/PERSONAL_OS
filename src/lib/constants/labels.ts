import type { GoalStatus, ObligationRecurrence, ObligationStatus, AccountType, TransactionKind, CategoryKind, HabitFrequency, LifeAreaCode, MealType, Priority, ProjectStatus, TaskStatus, WorkoutType } from "@/types/database";

export const RECURRENCE_LABELS = {
  daily: "Cada día",
  weekly: "Cada semana",
  monthly: "Cada mes",
} as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Activo",
  on_hold: "En pausa",
  completed: "Completado",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const HABIT_FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: "Todos los días",
  days_of_week: "Días específicos",
  times_per_week: "Veces por semana",
};

/** Índice = día ISO (1 = lunes). */
export const WEEKDAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: "L", long: "Lunes" },
  2: { short: "M", long: "Martes" },
  3: { short: "X", long: "Miércoles" },
  4: { short: "J", long: "Jueves" },
  5: { short: "V", long: "Viernes" },
  6: { short: "S", long: "Sábado" },
  7: { short: "D", long: "Domingo" },
};

/** Escala de calidad percibida del sueño (D-25). */
export const SLEEP_QUALITY_LABELS: Record<number, string> = {
  1: "Muy mala",
  2: "Mala",
  3: "Regular",
  4: "Buena",
  5: "Excelente",
};

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  mobility: "Movilidad",
  sport: "Deporte",
  other: "Otro",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Colación",
};

/** Orden de ordenación de prioridades (mayor primero). */
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export type ModuleDefinition = {
  /** HABITS es un módulo transversal: no es una de las seis dimensiones (DEC-002). */
  code: LifeAreaCode | "DASHBOARD" | "HABITS" | "REVIEW";
  href: string;
  label: string;
  available: boolean;
};

/** Navegación principal. `available` indica si el módulo ya está construido (Sprint 1: solo WORK). */
export const MODULES: ModuleDefinition[] = [
  { code: "DASHBOARD", href: "/dashboard", label: "Dashboard", available: true },
  { code: "WORK", href: "/work", label: "Trabajo", available: true },
  { code: "HABITS", href: "/habits", label: "Hábitos", available: true },
  { code: "FITNESS", href: "/fitness", label: "Entrenamiento", available: true },
  { code: "NUTRITION", href: "/nutrition", label: "Alimentación", available: true },
  { code: "SLEEP", href: "/sleep", label: "Sueño", available: true },
  { code: "FINANCE", href: "/finance", label: "Finanzas", available: true },
  { code: "PERSONAL", href: "/personal", label: "Vida personal", available: true },
  { code: "REVIEW", href: "/review", label: "Revisión semanal", available: true },
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Efectivo",
  bank: "Banco",
  savings: "Ahorro",
  other: "Otra",
};

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Ingresos",
  expense: "Gastos",
};

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer_in: "Transferencia recibida",
  transfer_out: "Transferencia enviada",
};

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Cancelada",
};

export const OBLIGATION_RECURRENCE_LABELS: Record<ObligationRecurrence, string> = {
  none: "Una sola vez",
  monthly: "Cada mes",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "En curso",
  paused: "En pausa",
  completed: "Completado",
  cancelled: "Cancelado",
};
