import { completedThisWeek, computeStreak, isScheduledOn, lastDays, type HabitSchedule, type StreakResult } from "./streaks";
import type { HabitLogRow, HabitRow } from "@/types/database";

/** Vista de un hábito lista para pintar: todo calculado en el servidor, serializable. */
export type HabitView = {
  habit: HabitRow;
  schedule: HabitSchedule;
  streak: StreakResult;
  /** Toca hoy (los de "N veces por semana" cuentan como "toca" mientras no cumplan la meta semanal). */
  dueToday: boolean;
  doneToday: boolean;
  weekDone: number;
  /** Últimos 7 días, del más antiguo a hoy. */
  recent: { date: string; done: boolean; scheduled: boolean }[];
};

export const RECENT_DAYS = 7;

export function toSchedule(habit: Pick<HabitRow, "frequency_type" | "days_of_week" | "target_per_week">): HabitSchedule {
  switch (habit.frequency_type) {
    case "daily":
      return { type: "daily" };
    case "days_of_week":
      return { type: "days_of_week", days: habit.days_of_week ?? [] };
    case "times_per_week":
      return { type: "times_per_week", target: habit.target_per_week ?? 1 };
  }
}

type LogInput = Pick<HabitLogRow, "habit_id" | "log_date" | "completed">;

export function buildHabitViews(habits: HabitRow[], logs: LogInput[], today: string): HabitView[] {
  const datesByHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.completed) continue;
    const set = datesByHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.log_date);
    datesByHabit.set(log.habit_id, set);
  }

  return habits.map((habit) => {
    const schedule = toSchedule(habit);
    const done = datesByHabit.get(habit.id) ?? new Set<string>();
    const doneToday = done.has(today);
    const weekDone = completedThisWeek(done, today);
    const dueToday =
      schedule.type === "times_per_week"
        ? doneToday || weekDone < schedule.target
        : isScheduledOn(schedule, today);

    return {
      habit,
      schedule,
      streak: computeStreak(schedule, done, today),
      dueToday,
      doneToday,
      weekDone,
      recent: lastDays(today, RECENT_DAYS).map((date) => ({
        date,
        done: done.has(date),
        scheduled: isScheduledOn(schedule, date),
      })),
    };
  });
}
