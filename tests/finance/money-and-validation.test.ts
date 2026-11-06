import { describe, expect, it } from "vitest";
import { formatMoney, roundMoney, sumByCurrency } from "@/lib/finance/money";
import { accountEditSchema, accountInputSchema, categoryEditSchema, categoryInputSchema } from "@/lib/validations/finance";

describe("dinero (D-42)", () => {
  it("formatea con símbolo de la moneda y dos decimales", () => {
    expect(formatMoney(1234.5, "BOB")).toMatch(/^Bs 1\D?234,50$/);
    expect(formatMoney(-20, "BOB")).toMatch(/-20,00/);
    expect(formatMoney(5, "USD")).toMatch(/^USD 5,00$/);
  });
  it("evita errores de coma flotante", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(sumByCurrency([{ currency: "BOB", amount: 0.1 }, { currency: "BOB", amount: 0.2 }]).get("BOB")).toBe(0.3);
  });
  it("nunca suma monedas distintas", () => {
    const t = sumByCurrency([
      { currency: "BOB", amount: 100 },
      { currency: "USD", amount: 50 },
      { currency: "BOB", amount: -30 },
    ]);
    expect([...t]).toEqual([["BOB", 70], ["USD", 50]]);
  });
});

describe("accountInputSchema", () => {
  const base = { name: "  Cuenta BNB ", accountType: "bank", currency: "BOB", openingBalance: "" };
  it("normaliza: nombre recortado y saldo vacío = 0", () => {
    expect(accountInputSchema.parse(base)).toMatchObject({ name: "Cuenta BNB", openingBalance: 0 });
  });
  it("admite saldo negativo y redondea a centavos", () => {
    expect(accountInputSchema.parse({ ...base, openingBalance: "-150.555" }).openingBalance).toBe(-150.56);
  });
  it("rechaza moneda no habilitada, tipo, nombre y rangos", () => {
    const bad = (o: object) => expect(accountInputSchema.safeParse({ ...base, ...o }).success).toBe(false);
    bad({ currency: "USD" });
    bad({ currency: "bob" });
    bad({ accountType: "crypto" });
    bad({ name: "   " });
    bad({ name: "x".repeat(101) });
    bad({ openingBalance: "abc" });
    bad({ openingBalance: "1000000000000" });
  });
  it("al editar no se acepta ni se usa la moneda", () => {
    const r = accountEditSchema.parse({ ...base, currency: "USD" });
    expect("currency" in r).toBe(false);
  });
});

describe("categoryInputSchema", () => {
  it("valida nombre y tipo", () => {
    expect(categoryInputSchema.parse({ name: " Mascotas ", kind: "expense" })).toEqual({ name: "Mascotas", kind: "expense" });
    expect(categoryInputSchema.safeParse({ name: "X", kind: "transfer" }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "", kind: "income" }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "x".repeat(61), kind: "income" }).success).toBe(false);
  });
  it("al editar el tipo no se usa", () => {
    expect("kind" in categoryEditSchema.parse({ name: "A", kind: "income" })).toBe(false);
  });
});

import { transactionEditSchema, transactionInputSchema, transferInputSchema } from "@/lib/validations/finance";
import { addMonths, monthLabel, monthStart } from "@/lib/utils/month";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("transactionInputSchema (D-46 a D-48)", () => {
  const base = { kind: "expense", accountId: U1, categoryId: U2, amount: "25.5", date: "2026-11-05", description: "" };
  it("normaliza importe y descripción vacía", () => {
    expect(transactionInputSchema.parse(base)).toMatchObject({ amount: 25.5, description: null });
    expect(transactionInputSchema.parse({ ...base, amount: "10.005" }).amount).toBe(10.01);
  });
  it("rechaza importes no positivos o enormes, tipos, fechas y ids", () => {
    const bad = (o: object) => expect(transactionInputSchema.safeParse({ ...base, ...o }).success).toBe(false);
    bad({ amount: "" });
    bad({ amount: "0" });
    bad({ amount: "-5" });
    bad({ amount: "abc" });
    bad({ amount: "1000000000000" });
    bad({ kind: "transfer_out" });
    bad({ kind: "transfer_in" });
    bad({ date: "05/11/2026" });
    bad({ accountId: "x" });
    bad({ categoryId: "" });
    bad({ description: "x".repeat(301) });
  });
  it("al editar no se aceptan cuenta ni tipo", () => {
    const r = transactionEditSchema.parse(base);
    expect("kind" in r || "accountId" in r).toBe(false);
  });
});

describe("transferInputSchema (D-50)", () => {
  const base = { fromAccountId: U1, toAccountId: U2, amount: "100", date: "2026-11-05", description: "ahorro" };
  it("acepta una transferencia válida", () => {
    expect(transferInputSchema.parse(base)).toMatchObject({ amount: 100, description: "ahorro" });
  });
  it("rechaza mismas cuentas e importes no positivos", () => {
    const r = transferInputSchema.safeParse({ ...base, toAccountId: U1 });
    expect(r.success).toBe(false);
    expect(transferInputSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });
});

describe("helpers de mes compartidos", () => {
  it("siguen funcionando desde utils/month", () => {
    expect(monthStart("2026-11-17")).toBe("2026-11-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(monthLabel("2026-11-01")).toBe("noviembre de 2026");
  });
});
