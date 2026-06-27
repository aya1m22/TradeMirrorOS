/**
 * Parse the raw text of a Frigorífico Concepción contract into a typed,
 * review-ready structure. Anchored to the Contrato 701-2026 layout (PRD §7.1).
 *
 * Strategy is conservative: extract only what the document actually contains,
 * keep values verbatim, and flag anything ambiguous or absent for the reviewer
 * rather than guessing.
 */
import type {
  ExtractedContract,
  ExtractedField,
  ExtractionResult,
  FieldStatus,
} from "./types";
import { firstMatch, lineContaining, toLines, valuesAfterLabelRun } from "./textAnchors";

const field = (value: string | null, status: FieldStatus, note?: string): ExtractedField => ({
  value: value ?? "",
  status: value ? status : "missing",
  note,
});

const missing = (note?: string): ExtractedField => ({ value: "", status: "missing", note });

// A Latin-formatted number: 1.234.567 thousands, comma decimals (e.g. 2.100,000).
const LATIN_NUM = String.raw`\d{1,3}(?:\.\d{3})*,\d+`;
// Fused product row: "27,00  <desc><unitPrice ,3dp><total ,2dp>".
const PRODUCT_RE =
  /^(\d+,\d{2})\s+(.+?)(\d{1,3}(?:\.\d{3})*,\d{3})(\d{1,3}(?:\.\d{3})*,\d{2})$/;

export function parseFrigoContract(rawText: string): ExtractionResult {
  const lines = toLines(rawText);

  // ── Header parties (label-run blocks) ─────────────────────────────────
  const exporterBlock = valuesAfterLabelRun(lines, ["Exporter", "R.U.C.", "Address", "Country"], 2);
  const supplierName = field(exporterBlock[0] ?? null, "extracted");
  const taxId = exporterBlock[1] ?? null;
  const supplierTaxId = field(
    taxId && /\d{6,}-?\d?/.test(taxId) ? taxId : null,
    "extracted",
  );

  const clientBlock = valuesAfterLabelRun(lines, ["Client", "Country", "Address", "City"], 1);
  const buyer = field(clientBlock[0] ?? null, "extracted");

  // ── Document reference + issue date ───────────────────────────────────
  const contractNumber = field(
    firstMatch(rawText, /Contract No\.?\s*:?\s*([0-9]+\/[0-9]+)/i),
    "extracted",
  );
  const issueDateBlock = valuesAfterLabelRun(lines, ["Date of Issue", "Sales Person"], 1);
  const issueRaw = issueDateBlock[0] ?? null;
  const issueDate = field(
    issueRaw && /\d{4}|\d{1,2}\/\d{1,2}/.test(issueRaw) ? issueRaw : null,
    "extracted",
  );

  // ── Product line: "27,00  <desc><unitPrice><total>" all concatenated ──
  // Unit price carries 3 decimals, total 2 — that distinguishes them.
  let commodity = missing("Could not isolate the product description.");
  let quantity = missing();
  let unitPrice = missing("Unit price sits in a fused number block; confirm the value.");
  let totalAmount = missing();

  for (const line of lines) {
    const m = line.match(PRODUCT_RE);
    if (m) {
      quantity = field(m[1], "extracted");
      commodity = field(m[2].trim(), "extracted");
      unitPrice = field(m[3], "extracted");
      totalAmount = field(m[4], "extracted");
      break;
    }
  }
  // Fallbacks if the fused row didn't split cleanly.
  if (quantity.status === "missing") {
    const qLine = lines.find((l) => /^\d+,\d{2}\s+\D/.test(l));
    if (qLine) {
      quantity = field(qLine.match(/^(\d+,\d{2})/)?.[1] ?? null, "uncertain");
      commodity = field(
        qLine.replace(/^\d+,\d{2}\s+/, "").replace(new RegExp(`(${LATIN_NUM})+$`), "").trim() || null,
        "uncertain",
        "Recovered from a row that did not split cleanly — verify.",
      );
    }
  }
  const quantityUnit = field(/^Ton$/m.test(lines.join("\n")) ? "Ton" : null, "extracted");

  // ── Incoterm: "CFR - ALEXANDRIA - EGYPT" ──────────────────────────────
  const incoterm = field(
    firstMatch(
      rawText,
      /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b\s*[-–]\s*[A-Z][A-Za-z ]+?\s*[-–]\s*[A-Z][A-Za-z ]+/,
      0,
    ),
    "extracted",
  );

  // ── Payment terms: prepayment + balance conditions ────────────────────
  const prepayment = firstMatch(rawText, /Prepayment Condition\s*(.+)/i);
  const balance = lineContaining(lines, "50% TT");
  const paymentParts = [prepayment, balance].filter(Boolean) as string[];
  const paymentTerms: ExtractedField = paymentParts.length
    ? { value: paymentParts.join("  |  "), status: prepayment && balance ? "extracted" : "uncertain" }
    : missing("No payment conditions found.");

  // ── Delivery terms: incoterm + origin/destination/shipment/freight ────
  const origin = lineContaining(lines, "ASUNCION - PARAGUAY");
  const destination = lineContaining(lines, "ALEXANDRIA - EGYPT");
  const shipment = lineContaining(lines, "LOADING FROM PLANT");
  const freight = lineContaining(lines, "PREPAID");
  const deliveryParts = [
    incoterm.value && `Incoterm: ${incoterm.value}`,
    origin && `Origin: ${origin}`,
    destination && `Destination: ${destination}`,
    shipment && `Shipment: ${shipment}`,
    freight && `Freight: ${freight}`,
  ].filter(Boolean) as string[];
  const deliveryTerms: ExtractedField = deliveryParts.length
    ? { value: deliveryParts.join("\n"), status: origin && destination ? "extracted" : "uncertain" }
    : missing("No delivery terms found.");

  // ── Quality: this template has no dedicated quality field ─────────────
  const quality = missing(
    "No explicit quality field on this contract — enter manually if required.",
  );

  const contract: ExtractedContract = {
    supplierName,
    supplierTaxId,
    buyer,
    contractNumber,
    issueDate,
    commodity,
    quantity,
    quantityUnit,
    quality,
    unitPrice,
    totalAmount,
    incoterm,
    paymentTerms,
    deliveryTerms,
  };

  return { contract, rawText, summary: summarize(contract) };
}

function summarize(contract: ExtractedContract) {
  const values = Object.values(contract);
  return {
    total: values.length,
    extracted: values.filter((f) => f.status === "extracted").length,
    uncertain: values.filter((f) => f.status === "uncertain").length,
    missing: values.filter((f) => f.status === "missing").length,
  };
}
