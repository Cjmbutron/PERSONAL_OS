import { describe, expect, it } from "vitest";
import { parseLink, priorityInputSchema, reviewInputSchema } from "@/lib/validations/personal";

const id = "123e4567-e89b-42d3-a456-426614174000";

describe("esquema de revisión", () => {
  it("acepta borrador y completar, y limpia textos vacíos", () => {
    const r = reviewInputSchema.safeParse({ week: "2026-11-02", wentWell: " ", toImprove: "Dormir", learnings: "", intent: "complete" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ wentWell: null, toImprove: "Dormir", learnings: null, intent: "complete" });
  });
  it("rechaza acción desconocida, fecha inválida y textos largos", () => {
    expect(reviewInputSchema.safeParse({ week: "2026-11-02", intent: "x" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ week: "ayer", intent: "draft" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ week: "2026-11-02", intent: "draft", wentWell: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("esquema de prioridades", () => {
  it("texto libre, vínculo sin texto, o ambos", () => {
    expect(priorityInputSchema.safeParse({ week: "2026-11-09", title: "Cerrar propuesta" }).success).toBe(true);
    expect(priorityInputSchema.safeParse({ week: "2026-11-09", title: "", link: `task:${id}` }).success).toBe(true);
    expect(priorityInputSchema.safeParse({ week: "2026-11-09", title: "Meta", link: `goal:${id}` }).success).toBe(true);
  });
  it("exige texto o vínculo y valida el formato del vínculo", () => {
    const empty = priorityInputSchema.safeParse({ week: "2026-11-09", title: "", link: "" });
    expect(empty.success).toBe(false);
    expect(priorityInputSchema.safeParse({ week: "2026-11-09", title: "x", link: "project:abc" }).success).toBe(false);
    expect(priorityInputSchema.safeParse({ week: "2026-11-09", title: "x".repeat(151) }).success).toBe(false);
  });
  it("parseLink", () => {
    expect(parseLink(`task:${id}`)).toEqual({ kind: "task", id });
    expect(parseLink(`goal:${id}`)).toEqual({ kind: "goal", id });
    expect(parseLink("")).toBeNull();
  });
});
