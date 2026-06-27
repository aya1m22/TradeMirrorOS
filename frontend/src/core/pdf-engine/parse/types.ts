/**
 * Typed structure produced by extracting a Frigorífico Concepción contract.
 *
 * Every field carries a status so the review screen can highlight what needs
 * a human: `extracted` (confident), `uncertain` (found but ambiguous), or
 * `missing` (no source in this template). Values are kept verbatim from the
 * document — no normalization, no invented data.
 */

export type FieldStatus = "extracted" | "uncertain" | "missing";

export interface ExtractedField {
  /** Verbatim text from the document; "" when missing. */
  value: string;
  status: FieldStatus;
  /** Optional reviewer guidance (e.g. why a field is uncertain or missing). */
  note?: string;
}

/** The fields targeted for this template (PRD §7.2 + Step 4 target list). */
export interface ExtractedContract {
  supplierName: ExtractedField; // Exporter
  supplierTaxId: ExtractedField; // R.U.C.
  buyer: ExtractedField; // Client
  contractNumber: ExtractedField; // Contract No. (the document's reference)
  issueDate: ExtractedField; // Date of Issue
  commodity: ExtractedField; // Product description
  quantity: ExtractedField; // e.g. "27,00"
  quantityUnit: ExtractedField; // e.g. "Ton"
  quality: ExtractedField; // no dedicated field in this template
  unitPrice: ExtractedField; // e.g. "2.100,000"
  totalAmount: ExtractedField; // e.g. "56.700,00"
  incoterm: ExtractedField; // e.g. "CFR - ALEXANDRIA - EGYPT"
  paymentTerms: ExtractedField; // prepayment + balance conditions
  deliveryTerms: ExtractedField; // incoterm + origin/destination/shipment/freight
}

export type ExtractedFieldKey = keyof ExtractedContract;

export interface ExtractionResult {
  contract: ExtractedContract;
  /** The raw text the parser worked from (kept for debugging / manual mode). */
  rawText: string;
  summary: {
    total: number;
    extracted: number;
    uncertain: number;
    missing: number;
  };
}
