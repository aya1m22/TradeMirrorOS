import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractPdfTextNode } from "@/core/pdf-engine/parse/extractText.node";
import { parseFrigoContract } from "@/core/pdf-engine/parse";
import { buildMirroredContract } from "./buildMirroredContract";
import { toTradeInsert } from "./toTradeInsert";
import { computeFinancials, parseLatinNumber } from "@/core/domain/finance";
import { generateTradeReference } from "@/core/domain/tradeReference";
import type { ReviewedValues } from "./types";

const fixture = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/fixtures/contrato-701-2026.pdf",
);

describe("mirror — from the real reviewed contract", () => {
  let reviewed: ReviewedValues;

  beforeAll(async () => {
    const text = await extractPdfTextNode(readFileSync(fixture));
    const result = parseFrigoContract(text);
    reviewed = Object.fromEntries(
      Object.entries(result.contract).map(([k, f]) => [k, f.value]),
    ) as ReviewedValues;
  });

  it("makes the company the seller and leaves the buyer for the operator", () => {
    const m = buildMirroredContract({ reviewed });
    expect(m.seller.name).toBe("Chipa Tech E.A.S."); // Phase-1 active entity
    expect(m.buyer.name).toBe("");
  });

  it("preserves back-to-back cargo fields verbatim", () => {
    const m = buildMirroredContract({ reviewed });
    expect(m.commodity).toMatch(/FROZEN OFFALS BOVINE LIVER/);
    expect(m.quantity).toBe(27);
    expect(m.quantityUnit).toBe("Ton");
    expect(m.incoterm).toBe("CFR - ALEXANDRIA - EGYPT");
    expect(m.deliveryTerms).toMatch(/ALEXANDRIA - EGYPT/);
  });

  it("parses the supplier price and applies the margin", () => {
    const m = buildMirroredContract({ reviewed, marginPerUnit: 150 });
    expect(m.supplierUnitPrice).toBe(2100);
    expect(m.saleUnitPrice).toBe(2250);
  });

  it("computes financials from the mirrored figures", () => {
    const m = buildMirroredContract({ reviewed, marginPerUnit: 150 });
    const fin = computeFinancials({
      quantity: m.quantity,
      supplierUnitPrice: m.supplierUnitPrice,
      saleUnitPrice: m.saleUnitPrice,
      shippingCost: m.shippingCost,
      insuranceCost: m.insuranceCost,
      bankFees: m.bankFees,
    });
    expect(fin.frigoTotal).toBe(56700);
    expect(fin.saleTotal).toBe(60750);
    expect(fin.marginTotal).toBe(4050);
    expect(fin.netProfit).toBe(4050);
  });

  it("maps to a trades insert without the generated columns", () => {
    const m = buildMirroredContract({ reviewed, marginPerUnit: 150 });
    const insert = toTradeInsert(m, {
      tradeReference: "CF-2026-001",
      entityId: "e",
      bankProfileId: "b",
      clientId: "c",
      contactId: "k",
      contractDate: "2026-06-26",
    });
    expect(insert.sale_total).toBe(60750);
    expect(insert.frigo_total).toBe(56700);
    expect(insert.trade_status).toBe("draft");
    expect("total_costs" in insert).toBe(false);
    expect("net_profit" in insert).toBe(false);
  });
});

describe("finance + reference helpers", () => {
  it("parses Latin-formatted numbers", () => {
    expect(parseLatinNumber("2.100,000")).toBe(2100);
    expect(parseLatinNumber("56.700,00")).toBe(56700);
    expect(parseLatinNumber("27,00")).toBe(27);
    expect(parseLatinNumber("0,00")).toBe(0);
    expect(parseLatinNumber("")).toBe(0);
  });

  it("formats trade references", () => {
    expect(generateTradeReference(2026, 1)).toBe("CF-2026-001");
    expect(generateTradeReference(2026, 42)).toBe("CF-2026-042");
  });
});
