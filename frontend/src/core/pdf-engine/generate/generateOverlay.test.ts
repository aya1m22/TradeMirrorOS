import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { extractPdfTextNode } from "@/core/pdf-engine/parse/extractText.node";
import { buildOverlayOps, type OverlayData } from "@/core/pdf-engine/coordinate-map/contract701-2026";
import { generateOverlayContractPdf } from "./generateOverlayContractPdf";

const fixture = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/fixtures/contrato-701-2026.pdf",
);

const data: OverlayData = {
  exporter: {
    name: "Chipa Tech E.A.S.",
    taxId: "RUC-PENDING",
    address: "Calle Dr. Eusebio Lilio #2880",
    city: "Asuncion",
    country: "Paraguay",
  },
  client: {
    name: "Al Manara Trading LLC",
    taxId: "EG-000",
    address: "14 Corniche Road",
    city: "Alexandria",
    country: "Egypt",
  },
  contact: { name: "Mohamed Said", phone: "+20 100 000 0000", email: "buyer@almanara.example" },
  unitPriceLatin: "2.250,000",
  totalLatin: "60.750,00",
  freightLatin: "1.200,00",
  insuranceLatin: "300,00",
  prepaymentText: "50% until may/01/2026 - Advanced value: 30.375,00",
  balanceText: "50% TT AGAINST COPY OF BL BY EMAIL",
  bank: {
    intermediaryBankName: "CITIBANK NA",
    intermediaryBankSwift: "CITIUS33",
    bankName: "BANCO NACIONAL DE FOMENTO",
    bankSwift: "BNFAPYPAXXX",
    accountNumber: "000000000000",
    araNumber: "",
    beneficiaryName: "Chipa Tech E.A.S.",
    beneficiaryAddress: "Asuncion, Paraguay",
  },
  buyerSignatureName: "Chipa Tech E.A.S.",
};

describe("buildOverlayOps", () => {
  it("produces a white block over every mapped field, even empty ones", () => {
    const ops = buildOverlayOps(data);
    expect(ops.length).toBeGreaterThan(25);
    for (const op of ops) {
      expect(op.rect.w).toBeGreaterThan(0);
      expect(op.rect.h).toBeGreaterThan(0);
    }
  });
});

describe("generateOverlayContractPdf", () => {
  let bytes: Uint8Array;

  beforeAll(async () => {
    bytes = await generateOverlayContractPdf(readFileSync(fixture), data);
  });

  it("produces a valid, single-page PDF", async () => {
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("injects the mirrored values onto the page", async () => {
    const text = await extractPdfTextNode(Buffer.from(bytes));
    expect(text).toMatch(/Al Manara Trading LLC/);
    expect(text).toMatch(/Mohamed Said/);
    expect(text).toMatch(/60\.750,00/); // recalculated total
    expect(text).toMatch(/2\.250,000/); // new unit price
    expect(text).toMatch(/Advanced value: 30\.375,00/);
  });

  it("preserves pure-mirror content from the source", async () => {
    const text = await extractPdfTextNode(Buffer.from(bytes));
    expect(text).toMatch(/FROZEN OFFALS BOVINE LIVER/);
    expect(text).toMatch(/CFR - ALEXANDRIA - EGYPT/);
    expect(text).toMatch(/Plant No\.:\s*38/);
    expect(text).toMatch(/HALAL CERTIFICATE/);
  });
});

describe("generateOverlayContractPdf — cargo overrides", () => {
  it("injects overridden commodity / quantity / incoterm", async () => {
    const overridden = {
      ...data,
      overrides: {
        commodity: "FROZEN BEEF TRIMMINGS 90CL",
        quantityLatin: "30,00",
        incoterm: "FOB - ASUNCION - PARAGUAY",
      },
    };
    const bytes = await generateOverlayContractPdf(readFileSync(fixture), overridden);
    const text = await extractPdfTextNode(Buffer.from(bytes));
    expect(text).toMatch(/FROZEN BEEF TRIMMINGS 90CL/);
    expect(text).toMatch(/FOB - ASUNCION - PARAGUAY/);
    expect(text).toMatch(/30,00/);
  });

  it("adds extra white-block ops only when overrides are present", () => {
    const base = buildOverlayOps(data).length;
    const withOverrides = buildOverlayOps({
      ...data,
      overrides: { commodity: "X", quantityLatin: "30,00", incoterm: "Y" },
    }).length;
    expect(withOverrides).toBe(base + 4); // commodity + 2 quantity rows + incoterm
  });
});
