import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFrigoContract } from "./parseFrigoContract";
import { extractPdfTextNode } from "./extractText.node";
import type { ExtractionResult } from "./types";

const fixture = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/fixtures/contrato-701-2026.pdf",
);

describe("parseFrigoContract — real Contrato 701-2026 via pdf-parse", () => {
  let result: ExtractionResult;

  beforeAll(async () => {
    const text = await extractPdfTextNode(readFileSync(fixture));
    result = parseFrigoContract(text);
  });

  it("extracts the supplier (Exporter)", () => {
    expect(result.contract.supplierName.value).toMatch(/FRIGORIFICO CONCEPCION/i);
    expect(result.contract.supplierName.status).toBe("extracted");
  });

  it("extracts the supplier tax id (R.U.C.)", () => {
    expect(result.contract.supplierTaxId.value).toBe("80023325-5");
  });

  it("extracts the buyer (Client)", () => {
    expect(result.contract.buyer.value).toBe("CHIPA TECH E.A.S.");
  });

  it("extracts the contract number", () => {
    expect(result.contract.contractNumber.value).toBe("701/2026");
  });

  it("extracts the issue date verbatim", () => {
    expect(result.contract.issueDate.value).toBe("APRIL 20/2026");
  });

  it("isolates the commodity from the fused product row", () => {
    expect(result.contract.commodity.value).toBe(
      "FROZEN OFFALS BOVINE LIVER, CARTONS WITH 10KG FIX WEIGHT IN BAGS",
    );
    expect(result.contract.commodity.status).toBe("extracted");
  });

  it("splits quantity, unit price, and total out of the fused row", () => {
    expect(result.contract.quantity.value).toBe("27,00");
    expect(result.contract.quantityUnit.value).toBe("Ton");
    expect(result.contract.unitPrice.value).toBe("2.100,000");
    expect(result.contract.totalAmount.value).toBe("56.700,00");
  });

  it("extracts the Incoterm", () => {
    expect(result.contract.incoterm.value).toBe("CFR - ALEXANDRIA - EGYPT");
  });

  it("composes payment terms from prepayment + balance", () => {
    expect(result.contract.paymentTerms.value).toMatch(/abr\/27\/2026/);
    expect(result.contract.paymentTerms.value).toMatch(/AGAINST COPY OF BL/i);
  });

  it("composes delivery terms with origin and destination", () => {
    expect(result.contract.deliveryTerms.value).toMatch(/ASUNCION - PARAGUAY/);
    expect(result.contract.deliveryTerms.value).toMatch(/ALEXANDRIA - EGYPT/);
  });

  it("flags quality as missing (no such field in this template)", () => {
    expect(result.contract.quality.value).toBe("");
    expect(result.contract.quality.status).toBe("missing");
  });

  it("summarizes mostly-extracted with at least one review item", () => {
    expect(result.summary.extracted).toBeGreaterThanOrEqual(11);
    expect(result.summary.missing).toBeGreaterThanOrEqual(1);
  });
});

describe("parseFrigoContract — resilience", () => {
  it("returns all-missing without throwing on empty text", () => {
    const r = parseFrigoContract("");
    expect(r.summary.extracted).toBe(0);
    expect(r.summary.missing).toBe(r.summary.total);
  });

  it("returns all-missing on unrelated text", () => {
    const r = parseFrigoContract("a random document with no contract fields at all");
    expect(r.contract.supplierName.value).toBe("");
    expect(r.contract.incoterm.value).toBe("");
  });
});
