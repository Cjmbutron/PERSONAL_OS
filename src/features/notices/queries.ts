import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/utils/date";
import {
  OBLIGATION_WARN_DAYS,
  TASK_WARN_DAYS,
  obligationNotices,
  sortNotices,
  taskNotices,
  weekToReview,
  weeklyReviewNotice,
  type Notice,
} from "@/lib/notices/compute";

export type NoticeWithState = Notice & { state: "new" | "read" | "dismissed" };

/**
 * Avisos de hoy (D-97): se calculan al abrir la app a partir de los datos actuales y se cruzan
 * con notice_states para saber cuáles ya se leyeron o descartaron.
 */
export async function listNotices(workspaceId: string, today: string): Promise<NoticeWithState[]> {
  const supabase = await createClient();
  const reviewWeek = weekToReview(today);

  const [tasks, obligations, review, states] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .in("status", ["pending", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", addDays(today, TASK_WARN_DAYS))
      .order("due_date")
      .limit(50),
    supabase
      .from("financial_obligations")
      .select("id, name, amount, currency, due_date")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lte("due_date", addDays(today, OBLIGATION_WARN_DAYS))
      .order("due_date")
      .limit(50),
    reviewWeek
      ? supabase
          .from("weekly_reviews")
          .select("week_start")
          .eq("workspace_id", workspaceId)
          .eq("week_start", reviewWeek)
          .eq("status", "completed")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("notice_states").select("notice_key, state").eq("workspace_id", workspaceId).limit(1000),
  ]);

  for (const [name, r] of [["tasks", tasks], ["obligations", obligations], ["review", review], ["states", states]] as const) {
    if (r.error) {
      console.error(`[db] listNotices.${name}`, r.error.code, r.error.message);
      throw new Error("No se pudieron cargar los avisos.");
    }
  }

  const completed = new Set((review.data ?? []).map((r) => r.week_start));
  const weekly = weeklyReviewNotice(today, completed);
  const notices = sortNotices([
    ...taskNotices(tasks.data ?? [], today),
    ...obligationNotices((obligations.data ?? []).map((o) => ({ ...o, amount: Number(o.amount) })), today),
    ...(weekly ? [weekly] : []),
  ]);

  const stateByKey = new Map((states.data ?? []).map((s) => [s.notice_key, s.state]));
  return notices.map((n) => ({ ...n, state: stateByKey.get(n.key) ?? "new" }));
}
