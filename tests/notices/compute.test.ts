import { describe, expect, it } from "vitest";
import { obligationNotices, sortNotices, taskNotices, weekToReview, weeklyReviewNotice } from "@/lib/notices/compute";

const TODAY = "2026-11-09"; // lunes

describe("taskNotices", () => {
  const t = (id: string, due: string | null) => ({ id, title: `T${id}`, due_date: due });
  it("avisa vencidas, hoy y los próximos 2 días; ignora el resto y las sin fecha", () => {
    const n = taskNotices([t("1", "2026-11-08"), t("2", TODAY), t("3", "2026-11-11"), t("4", "2026-11-12"), t("5", null)], TODAY);
    expect(n.map((x) => [x.title, x.tone])).toEqual([["T1", "danger"], ["T2", "warning"], ["T3", "info"]]);
  });
  it("la clave cambia cuando la tarea pasa de 'hoy' a 'vencida', así el aviso reaparece", () => {
    const a = taskNotices([t("1", TODAY)], TODAY)[0].key;
    const b = taskNotices([t("1", TODAY)], "2026-11-10")[0].key;
    expect(a).not.toBe(b);
  });
});

describe("obligationNotices", () => {
  const o = (id: string, due: string) => ({ id, name: `O${id}`, amount: 1500, currency: "BOB", due_date: due });
  it("avisa vencidas y las de los próximos 7 días", () => {
    const n = obligationNotices([o("1", "2026-11-01"), o("2", "2026-11-16"), o("3", "2026-11-17")], TODAY);
    expect(n.map((x) => x.title)).toEqual(["O1", "O2"]);
    expect(n[0].detail).toContain("BOB");
  });
});

describe("resumen semanal", () => {
  it("sábado/domingo → semana en curso; lunes/martes → semana pasada; miércoles a viernes → ninguna", () => {
    expect(weekToReview("2026-11-14")).toBe("2026-11-09"); // sábado
    expect(weekToReview("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(weekToReview("2026-11-09")).toBe("2026-11-02"); // lunes
    expect(weekToReview("2026-11-10")).toBe("2026-11-02"); // martes
    expect(weekToReview("2026-11-11")).toBeNull();
    expect(weekToReview("2026-11-13")).toBeNull();
  });
  it("no avisa si la revisión de esa semana ya está completada", () => {
    expect(weeklyReviewNotice(TODAY, new Set())?.key).toBe("weekly-review:2026-11-02");
    expect(weeklyReviewNotice(TODAY, new Set(["2026-11-02"]))).toBeNull();
    expect(weeklyReviewNotice("2026-11-11", new Set())).toBeNull();
  });
});

describe("sortNotices", () => {
  it("ordena por urgencia", () => {
    const base = { kind: "task" as const, detail: "", href: "/" };
    const s = sortNotices([
      { ...base, key: "a", tone: "info", title: "a" },
      { ...base, key: "b", tone: "danger", title: "b" },
      { ...base, key: "c", tone: "warning", title: "c" },
    ]);
    expect(s.map((x) => x.key)).toEqual(["b", "c", "a"]);
  });
});
