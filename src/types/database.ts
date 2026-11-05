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
export const WORKOUT_TYPES = ["strength", "cardio", "mobility", "sport", "other"] as const;
export const HABIT_FREQUENCIES = ["daily", "days_of_week", "times_per_week"] as const;

export type MealType = (typeof MEAL_TYPES)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
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
    Views: { [_ in never]: never };
    Functions: {
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
