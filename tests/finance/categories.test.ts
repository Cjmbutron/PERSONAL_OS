import { describe, expect, it } from "vitest";
import { rollupTotals, spentIncludingChildren, withPaths } from "@/lib/finance/categories";

const cats = [
  { id: "ian", name: "IAN", kind: "expense", parent_id: null },
  { id: "tenis", name: "Tenis", kind: "expense", parent_id: "ian" },
  { id: "piano", name: "Piano", kind: "expense", parent_id: "ian" },
  { id: "viv", name: "Vivienda", kind: "expense", parent_id: null },
  { id: "sueldo", name: "Sueldo", kind: "income", parent_id: null },
];
const totals = [
  { currency: "BOB", category_id: "tenis", total: 300 },
  { currency: "BOB", category_id: "piano", total: 200 },
  { currency: "BOB", category_id: "ian", total: 1000 },
  { currency: "BOB", category_id: "viv", total: 450 },
  { currency: "USD", category_id: "ian", total: 50 },
];

describe("withPaths", () => {
  it("ordena cada principal seguida de sus hijos y pone la ruta en el nombre", () => {
    expect(withPaths(cats).map((c) => c.name)).toEqual(["IAN", "IAN › Piano", "IAN › Tenis", "Vivienda", "Sueldo"]);
  });
  it("una subcategoría huérfana se trata como principal", () => {
    expect(withPaths([{ id: "x", name: "Suelta", kind: "expense", parent_id: "no-existe" }]).map((c) => c.name)).toEqual(["Suelta"]);
  });
});

describe("rollupTotals", () => {
  it("suma las subcategorías al padre y conserva el desglose, sin mezclar monedas", () => {
    const bob = rollupTotals(totals, cats, "BOB");
    expect(bob.map((r) => [r.name, r.total, r.own])).toEqual([["IAN", 1500, 1000], ["Vivienda", 450, 450]]);
    expect(bob[0].children.map((c) => [c.name, c.total])).toEqual([["Tenis", 300], ["Piano", 200]]);
    expect(rollupTotals(totals, cats, "USD").map((r) => r.total)).toEqual([50]);
  });
});

describe("spentIncludingChildren", () => {
  it("el padre incluye a los hijos y el hijo solo lo suyo", () => {
    const m = spentIncludingChildren(totals, cats);
    expect(m.get("BOB:ian")).toBe(1500);
    expect(m.get("BOB:tenis")).toBe(300);
    expect(m.get("USD:ian")).toBe(50);
  });
});
