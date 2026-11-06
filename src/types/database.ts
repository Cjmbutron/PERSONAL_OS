/**
 * Tipos del esquema `public` (migraciones 1 y 2).
 * Escritos a mano para el Sprint 1; una vez conectado el proyecto Supabase se pueden
 * regenerar con `supabase gen types typescript --linked > src/types/database.ts`.
 *
 * Los tipos Insert/Update reflejan los privilegios de columna concedidos a `authenticated`
 * (id, created_at, updated_at y completed_at no son escribibles desde el cliente).
 */

export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const LIFE_AREA_CODES = ["WORK", "FITNESS", "NUTRITION", "SLEEP", "FINANCE", "PERSONAL"] as const;

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export const ACCOUNT_TYPES = ["cash", "bank", "savings", "other"] as const;
export const CATEGORY_KINDS = ["income", "expense"] as const;
export const TRANSACTION_KINDS = ["income", "expense", "transfer_in", "transfer_out"] as const;
export const OBLIGATION_STATUSES = ["pending", "paid", "cancelled"] as const;
export const OBLIGATION_RECURRENCES = ["none", "monthly"] as const;
export const WORKOUT_TYPES = ["strength", "cardio", "mobility", "sport", "other"] as const;
export const GOAL_STATUSES = ["active", "paused", "completed", "cancelled"] as const;
export const HABIT_FREQUENCIES = ["daily", "days_of_week", "times_per_week"] as const;

export type MealType = (typeof MEAL_TYPES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];
export type ObligationRecurrence = (typeof OBLIGATION_RECURRENCES)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type LifeAreaCode = (typeof LIFE_AREA_CODES)[number];

export type ProfileRow = {
  id: string;
  full_name: string | null;
  timezone: string;
  sleep_goal_hours: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type LifeAreaRow = {
  id: string;
  code: LifeAreaCode;
  name: string;
  description: string;
  sort_order: number;
};

export type ProjectRow = {
  id: string;
  workspace_id: string;
  life_area_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TaskRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  life_area_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type HabitRow = {
  id: string;
  workspace_id: string;
  life_area_id: string | null;
  name: string;
  description: string | null;
  frequency_type: HabitFrequency;
  days_of_week: number[] | null;
  target_per_week: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type HabitLogRow = {
  id: string;
  workspace_id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type SleepRecordRow = {
  id: string;
  workspace_id: string;
  bedtime: string;
  wake_time: string;
  /** Día local de despertar; lo fija un trigger (D-26). */
  sleep_date: string;
  /** Calculada por la base de datos (D-25). */
  duration_minutes: number;
  quality: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type FinancialAccountRow = {
  id: string;
  workspace_id: string;
  name: string;
  account_type: AccountType;
  /** ISO 4217; no cambia tras crear la cuenta (D-40). */
  currency: string;
  /** El saldo se calcula a partir de este valor y de los movimientos (D-44). */
  opening_balance: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TransactionCategoryRow = {
  id: string;
  workspace_id: string;
  name: string;
  kind: CategoryKind;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TransactionRow = {
  id: string;
  workspace_id: string;
  account_id: string;
  currency: string;
  kind: TransactionKind;
  /** Siempre positivo; el tipo da el signo (D-46). */
  amount: number;
  /** Día de calendario (D-47). */
  transaction_date: string;
  category_id: string | null;
  description: string | null;
  /** Las dos patas de una transferencia comparten este id (D-50). */
  transfer_group_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AccountBalanceRow = {
  account_id: string;
  workspace_id: string;
  currency: string;
  balance: number;
};

export type BudgetRow = {
  id: string;
  workspace_id: string;
  /** Primer día del mes calendario (D-52). */
  period_month: string;
  /** null = tope del total del mes. */
  category_id: string | null;
  currency: string;
  amount: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ObligationRow = {
  id: string;
  workspace_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string;
  anchor_day: number;
  status: ObligationStatus;
  recurrence: ObligationRecurrence;
  category_id: string | null;
  paid_at: string | null;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEventRow = {
  id: string;
  workspace_id: string;
  life_area_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  first_day: string;
  last_day: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type GoalRow = {
  id: string;
  workspace_id: string;
  life_area_id: string | null;
  title: string;
  description: string | null;
  target_date: string | null;
  status: GoalStatus;
  manual_progress: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type GoalMilestoneRow = {
  id: string;
  workspace_id: string;
  goal_id: string;
  position: number;
  title: string;
  done: boolean;
  done_at: string | null;
  created_at: string;
};

export type GoalProgressRow = {
  goal_id: string;
  workspace_id: string;
  milestones_total: number;
  milestones_done: number;
};

export type MonthlyTotalRow = {
  workspace_id: string;
  currency: string;
  month: string;
  kind: "income" | "expense";
  total: number;
  movements: number;
};

export type MonthlyCategoryTotalRow = MonthlyTotalRow & { category_id: string };

/** Forma del JSON que reciben las RPC transaccionales. */
export type WorkoutExercisePayload = {
  name: string;
  notes: string | null;
  distance_km: number | null;
  duration_min: number | null;
  sets: { reps: number; weight_kg: number | null }[];
};

export type RoutineExercisePayload = {
  day_of_week: number;
  name: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  notes: string | null;
};

export type WorkoutRoutineRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  /** Primer día del mes calendario al que pertenece la rutina (D-34). */
  period_month: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type RoutineExerciseRow = {
  id: string;
  workspace_id: string;
  routine_id: string;
  /** Día ISO de la semana, 1 = lunes … 7 = domingo (D-35). */
  day_of_week: number;
  position: number;
  name: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSessionRow = {
  id: string;
  workspace_id: string;
  routine_id: string | null;
  routine_day: number | null;
  started_at: string;
  /** Día local de started_at; lo fija un trigger. */
  started_date: string;
  type: WorkoutType;
  duration_minutes: number | null;
  rpe: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type WorkoutExerciseRow = {
  id: string;
  workspace_id: string;
  session_id: string;
  position: number;
  name: string;
  notes: string | null;
  distance_km: number | null;
  duration_min: number | null;
  created_at: string;
};

export type WorkoutSetRow = {
  id: string;
  workspace_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  /** null = peso corporal / sin carga. */
  weight_kg: number | null;
  created_at: string;
};

export type MealLogRow = {
  id: string;
  workspace_id: string;
  meal_type: MealType;
  eaten_at: string;
  /** Día local de eaten_at; lo fija un trigger (D-31). */
  eaten_date: string;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: Partial<Pick<ProfileRow, "full_name" | "timezone" | "sleep_goal_hours">>;
        Relationships: [];
      };
      workspaces: {
        Row: WorkspaceRow;
        Insert: never;
        Update: Partial<Pick<WorkspaceRow, "name">>;
        Relationships: [];
      };
      life_areas: {
        Row: LifeAreaRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: {
          workspace_id: string;
          name: string;
          life_area_id?: string | null;
          description?: string | null;
          status?: ProjectStatus;
          due_date?: string | null;
        };
        Update: Partial<
          Pick<ProjectRow, "life_area_id" | "name" | "description" | "status" | "due_date" | "archived_at">
        >;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: {
          workspace_id: string;
          title: string;
          project_id?: string | null;
          life_area_id?: string | null;
          description?: string | null;
          status?: TaskStatus;
          priority?: Priority;
          due_date?: string | null;
        };
        Update: Partial<
          Pick<
            TaskRow,
            "project_id" | "life_area_id" | "title" | "description" | "status" | "priority" | "due_date" | "archived_at"
          >
        >;
        Relationships: [];
      };
      habits: {
        Row: HabitRow;
        Insert: {
          workspace_id: string;
          name: string;
          frequency_type: HabitFrequency;
          life_area_id?: string | null;
          description?: string | null;
          days_of_week?: number[] | null;
          target_per_week?: number | null;
        };
        Update: Partial<
          Pick<
            HabitRow,
            | "life_area_id"
            | "name"
            | "description"
            | "frequency_type"
            | "days_of_week"
            | "target_per_week"
            | "archived_at"
          >
        >;
        Relationships: [];
      };
      habit_logs: {
        Row: HabitLogRow;
        Insert: {
          workspace_id: string;
          habit_id: string;
          log_date: string;
          completed?: boolean;
        };
        Update: Partial<Pick<HabitLogRow, "completed">>;
        Relationships: [];
      };
      sleep_records: {
        Row: SleepRecordRow;
        Insert: {
          workspace_id: string;
          bedtime: string;
          wake_time: string;
          quality?: number | null;
          notes?: string | null;
        };
        Update: Partial<Pick<SleepRecordRow, "bedtime" | "wake_time" | "quality" | "notes" | "archived_at">>;
        Relationships: [];
      };
      meal_logs: {
        Row: MealLogRow;
        Insert: {
          workspace_id: string;
          meal_type: MealType;
          eaten_at: string;
          description: string;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
        };
        Update: Partial<
          Pick<
            MealLogRow,
            "meal_type" | "eaten_at" | "description" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "archived_at"
          >
        >;
        Relationships: [];
      };
      financial_accounts: {
        Row: FinancialAccountRow;
        Insert: {
          workspace_id: string;
          name: string;
          account_type: AccountType;
          currency: string;
          opening_balance?: number;
        };
        Update: Partial<Pick<FinancialAccountRow, "name" | "account_type" | "opening_balance" | "archived_at">>;
        Relationships: [];
      };
      transaction_categories: {
        Row: TransactionCategoryRow;
        Insert: { workspace_id: string; name: string; kind: CategoryKind };
        Update: Partial<Pick<TransactionCategoryRow, "name" | "archived_at">>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: {
          workspace_id: string;
          account_id: string;
          currency: string;
          kind: "income" | "expense";
          amount: number;
          transaction_date: string;
          category_id: string;
          description?: string | null;
        };
        Update: Partial<Pick<TransactionRow, "amount" | "transaction_date" | "category_id" | "description" | "archived_at">>;
        Relationships: [];
      };
      budgets: {
        Row: BudgetRow;
        Insert: { workspace_id: string; period_month: string; category_id: string | null; currency: string; amount: number };
        Update: Partial<Pick<BudgetRow, "amount" | "archived_at">>;
        Relationships: [];
      };
      financial_obligations: {
        Row: ObligationRow;
        Insert: {
          workspace_id: string;
          name: string;
          amount: number;
          currency: string;
          due_date: string;
          recurrence?: ObligationRecurrence;
          category_id?: string | null;
        };
        Update: Partial<Pick<ObligationRow, "name" | "amount" | "due_date" | "recurrence" | "category_id">> & {
          status?: "pending" | "cancelled";
        };
        Relationships: [];
      };
      calendar_events: {
        Row: CalendarEventRow;
        Insert: {
          workspace_id: string;
          title: string;
          all_day: boolean;
          life_area_id?: string | null;
          description?: string | null;
          location?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          start_date?: string | null;
          end_date?: string | null;
        };
        Update: Partial<
          Pick<
            CalendarEventRow,
            "life_area_id" | "title" | "description" | "location" | "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date" | "archived_at"
          >
        >;
        Relationships: [];
      };
      goals: {
        Row: GoalRow;
        Insert: {
          workspace_id: string;
          title: string;
          life_area_id?: string | null;
          description?: string | null;
          target_date?: string | null;
          status?: GoalStatus;
          manual_progress?: number;
        };
        Update: Partial<
          Pick<GoalRow, "life_area_id" | "title" | "description" | "target_date" | "status" | "manual_progress" | "archived_at">
        >;
        Relationships: [];
      };
      goal_milestones: {
        Row: GoalMilestoneRow;
        Insert: { workspace_id: string; goal_id: string; position: number; title: string; done?: boolean };
        Update: Partial<Pick<GoalMilestoneRow, "position" | "title" | "done">>;
        Relationships: [];
      };
      workout_routines: {
        Row: WorkoutRoutineRow;
        Insert: { workspace_id: string; name: string; description?: string | null; period_month: string };
        Update: Partial<Pick<WorkoutRoutineRow, "name" | "description" | "period_month" | "archived_at">>;
        Relationships: [];
      };
      routine_exercises: {
        Row: RoutineExerciseRow;
        Insert: Omit<RoutineExerciseRow, "id" | "created_at" | "target_weight_kg" | "notes"> & {
          target_weight_kg?: number | null;
          notes?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      workout_sessions: {
        Row: WorkoutSessionRow;
        Insert: {
          workspace_id: string;
          started_at: string;
          type: WorkoutType;
          routine_id?: string | null;
          routine_day?: number | null;
          duration_minutes?: number | null;
          rpe?: number | null;
          notes?: string | null;
        };
        Update: Partial<
          Pick<
            WorkoutSessionRow,
            "routine_id" | "routine_day" | "started_at" | "type" | "duration_minutes" | "rpe" | "notes" | "archived_at"
          >
        >;
        Relationships: [];
      };
      workout_exercises: {
        Row: WorkoutExerciseRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      workout_sets: {
        Row: WorkoutSetRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      account_balances: { Row: AccountBalanceRow; Relationships: [] };
      goal_progress: { Row: GoalProgressRow; Relationships: [] };
      monthly_totals: { Row: MonthlyTotalRow; Relationships: [] };
      monthly_category_totals: { Row: MonthlyCategoryTotalRow; Relationships: [] };
    };
    Functions: {
      copy_budgets: {
        Args: { p_workspace_id: string; p_from_month: string; p_to_month: string };
        Returns: number;
      };
      pay_obligation: {
        Args: { p_obligation_id: string; p_account_id: string; p_paid_date: string; p_category_id: string | null };
        Returns: string;
      };
      create_transfer: {
        Args: {
          p_workspace_id: string;
          p_from_account: string;
          p_to_account: string;
          p_amount: number;
          p_date: string;
          p_description: string | null;
        };
        Returns: string;
      };
      archive_transfer: {
        Args: { p_group_id: string; p_archived: boolean };
        Returns: undefined;
      };
      save_workout_session: {
        Args: {
          p_workspace_id: string;
          p_id: string | null;
          p_routine_id: string | null;
          p_routine_day: number | null;
          p_started_at: string;
          p_type: WorkoutType;
          p_duration_minutes: number | null;
          p_rpe: number | null;
          p_notes: string | null;
          p_exercises: WorkoutExercisePayload[];
        };
        Returns: string;
      };
      save_workout_routine: {
        Args: {
          p_workspace_id: string;
          p_id: string | null;
          p_name: string;
          p_description: string | null;
          p_period_month: string;
          p_exercises: RoutineExercisePayload[];
        };
        Returns: string;
      };
      duplicate_workout_routine: {
        Args: { p_routine_id: string; p_target_month: string };
        Returns: string;
      };
      owns_workspace: {
        Args: { target_workspace: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
