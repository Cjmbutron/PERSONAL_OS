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

export const HABIT_FREQUENCIES = ["daily", "days_of_week", "times_per_week"] as const;

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
    };
    Views: { [_ in never]: never };
    Functions: {
      owns_workspace: {
        Args: { target_workspace: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
