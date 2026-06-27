import { describe, it, expect } from "vitest";
import { toCsv, filterByYear, yearsPresent, INCOME_CLASSIFICATION, type TaxRow } from "./taxReadiness";

const rows: TaxRow[] = [
  { tradeRef: "CF-2026-001", contractDate: "2026-03-01", client: "Al Manara, LLC", clientCountry: "Egypt", entity: "Chipa Tech E.A.S.", frigoTotal: 56700, saleTotal: 60750, shipping: 1200, insurance: 300, bankFees: 0, netProfit: 2550 },
  { tradeRef: "CF-2025-009", contractDate: "2025-11-20", client: "Buyer Co", clientCountry: "USA", entity: "Chipa Farm LLC", frigoTotal: 10000, saleTotal: 12000, shipping: 0, insurance: 0, bankFees: 50, netProfit: 1950 },
];

describe("tax readiness export", () => {
  it("lists distinct years, newest first", () => {
    expect(yearsPresent(rows)).toEqual([2026, 2025]);
  });

  it("filters by contract year", () => {
    expect(filterByYear(rows, 2026).map((r) => r.tradeRef)).toEqual(["CF-2026-001"]);
  });

  it("builds CSV with headers, classification, and quoted commas", () => {
    const csv = toCsv(filterByYear(rows, 2026));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Trade ID");
    expect(lines[0]).toContain("Active Entity");
    expect(lines[1]).toContain('"Al Manara, LLC"'); // comma-containing field quoted
    expect(lines[1]).toContain("56700.00");
    expect(lines[1]).toContain(INCOME_CLASSIFICATION);
  });
});
