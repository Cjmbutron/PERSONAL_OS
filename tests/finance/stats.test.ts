import { describe, expect, it } from "vitest";
import {
  budgetLevel,
  budgetPercent,
  budgetRemaining,
  daysUntil,
  dueLabel,
  dueState,
  monthlyTrend,
  nextDueDate,
} from "@/lib/finance/stats";
import {
  budgetEditSchema,
  budgetInputSchema,
  obligationEditSchema,
  obligationInputSchema,
  payObligationSchema,
} from "@/lib/validations/finance";

const U1 = "11111111-1111-4111-8111-111111111111";

describe("semáforo de presupuesto (D-53)", () => {
  it("menos de 80 % normal; 80–100 % aviso; más de 100 % excedido", () => {
    expect(budgetLevel(0, 100)).toBe("ok");
    expect(budgetLevel(79.99, 100)).toBe("ok");
    expect(budgetLevel(80, 100)).toBe("warning");
    expect(budgetLevel(100, 100)).toBe("warning");
    expect(budgetLevel(100.01, 100)).toBe("exceeded");
  });
  it("porcentaje y restante", () => {
    expect(budgetPercent(130, 100)).toBe(130);
    expect(budgetPercent(5, 0)).toBe(0);
    expect(budgetRemaining(0.1 + 0.2, 1)).toBe(0.7);
    expect(budgetRemaining(150, 100)).toBe(-50);
  });
});

describe("vencimientos (D-54)", () => {
  const today = "2026-11-06";
  it("vencida, próxima (7 días) y futura", () => {
    expect(dueState("2026-11-05", today)).toBe("overdue");
    expect(dueState("2026-11-06", today)).toBe("due_soon");
    expect(dueState("2026-11-13", today)).toBe("due_soon");
    expect(dueState("2026-11-14", today)).toBe("upcoming");
  });
  it("días y etiquetas", () => {
    expect(daysUntil("2026-11-09", today)).toBe(3);
    expect(dueLabel("2026-11-04", today)).toBe("Venció hace 2 días");
    expect(dueLabel("2026-11-05", today)).toBe("Venció ayer");
    expect(dueLabel("2026-11-06", today)).toBe("Vence hoy");
    expect(dueLabel("2026-11-07", today)).toBe("Vence mañana");
    expect(dueLabel("2026-11-20", today)).toBe("Vence en 14 días");
  });
  it("siguiente vencimiento conserva el día original (replica pay_obligation)", () => {
    expect(nextDueDate("2027-01-31", 31)).toBe("2027-02-28");
    expect(nextDueDate("2027-02-28", 31)).toBe("2027-03-31");
    expect(nextDueDate("2028-01-31", 31)).toBe("2028-02-29"); // bisiesto
    expect(nextDueDate("2026-12-15", 15)).toBe("2027-01-15");
    expect(nextDueDate("2026-04-30", 30)).toBe("2026-05-30");
  });
});

describe("tendencia mensual (D-55)", () => {
  it("rellena con ceros, suma y calcula el balance", () => {
    const t = monthlyTrend(
      [
        { month: "2026-11-01", kind: "income", total: 1000 },
        { month: "2026-11-01", kind: "expense", total: 250.5 },
        { month: "2026-09-01", kind: "expense", total: 0.1 },
        { month: "2026-09-01", kind: "expense", total: 0.2 },
        { month: "2025-01-01", kind: "expense", total: 999 }, // fuera de la ventana
      ],
      "2026-11-01",
      3,
    );
    expect(t.map((p) => p.month)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(t[0]).toMatchObject({ income: 0, expense: 0.3, balance: -0.3 });
    expect(t[1]).toMatchObject({ income: 0, expense: 0, balance: 0 });
    expect(t[2]).toMatchObject({ income: 1000, expense: 250.5, balance: 749.5 });
  });
  it("cruza el cambio de año", () => {
    expect(monthlyTrend([], "2027-02-01", 3).map((p) => p.month)).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
  });
});

describe("validaciones de presupuestos y obligaciones", () => {
  it("presupuesto: mes YYYY-MM → primer día, categoría vacía = total", () => {
    const r = budgetInputSchema.parse({ periodMonth: "2026-11", categoryId: "", currency: "BOB", amount: "800" });
    expect(r).toEqual({ periodMonth: "2026-11-01", categoryId: null, currency: "BOB", amount: 800 });
    expect(budgetInputSchema.parse({ periodMonth: "2026-11", categoryId: U1, currency: "BOB", amount: "1" }).categoryId).toBe(U1);
  });
  it("presupuesto: rechaza importe, mes, moneda y categoría inválidos", () => {
    const base = { periodMonth: "2026-11", categoryId: "", currency: "BOB", amount: "10" };
    const bad = (o: object) => expect(budgetInputSchema.safeParse({ ...base, ...o }).success).toBe(false);
    bad({ amount: "0" });
    bad({ amount: "" });
    bad({ amount: "-1" });
    bad({ periodMonth: "2026-13" });
    bad({ periodMonth: "2026-11-01" });
    bad({ currency: "USD" });
    bad({ categoryId: "x" });
    expect(budgetEditSchema.parse({ ...base, amount: "5.556" })).toEqual({ amount: 5.56 });
  });
  it("obligación: normaliza y valida", () => {
    const base = { name: " Alquiler ", amount: "1500", currency: "BOB", dueDate: "2026-12-01", recurrence: "monthly", categoryId: "" };
    expect(obligationInputSchema.parse(base)).toMatchObject({ name: "Alquiler", amount: 1500, categoryId: null, recurrence: "monthly" });
    const bad = (o: object) => expect(obligationInputSchema.safeParse({ ...base, ...o }).success).toBe(false);
    bad({ name: " " });
    bad({ name: "x".repeat(101) });
    bad({ amount: "0" });
    bad({ dueDate: "01/12/2026" });
    bad({ recurrence: "weekly" });
    bad({ currency: "USD" });
    expect("currency" in obligationEditSchema.parse(base)).toBe(false);
  });
  it("pago: cuenta y fecha obligatorias; categoría opcional", () => {
    expect(payObligationSchema.parse({ accountId: U1, date: "2026-11-06", categoryId: "" })).toEqual({ accountId: U1, date: "2026-11-06", categoryId: null });
    expect(payObligationSchema.safeParse({ accountId: "", date: "2026-11-06", categoryId: "" }).success).toBe(false);
    expect(payObligationSchema.safeParse({ accountId: U1, date: "hoy", categoryId: "" }).success).toBe(false);
  });
});
