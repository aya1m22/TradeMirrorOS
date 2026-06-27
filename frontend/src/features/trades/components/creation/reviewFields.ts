import type { ExtractedFieldKey } from "@/core/pdf-engine/parse";

export interface ReviewFieldConfig {
  key: ExtractedFieldKey;
  label: string;
  required: boolean;
  multiline?: boolean;
  /** Render in the mono/data face (codes, money, quantities). */
  mono?: boolean;
  /**
   * Pure-mirror field (PRD §3 field map): copied verbatim from the source and
   * never edited. Shown read-only when extraction succeeded; still editable in
   * manual-entry mode (when nothing could be extracted).
   */
  pureMirror?: boolean;
}

/**
 * The review surface — the Step 4 target fields, in document reading order.
 * Required fields must be present before the contract can move forward.
 * Pure-mirror fields are displayed read-only (they stay untouched on the page).
 */
export const REVIEW_FIELDS: ReviewFieldConfig[] = [
  { key: "supplierName", label: "Supplier", required: true },
  { key: "supplierTaxId", label: "Supplier tax ID (R.U.C.)", required: false, mono: true },
  { key: "buyer", label: "Buyer", required: true },
  { key: "contractNumber", label: "Contract number", required: true, mono: true },
  { key: "issueDate", label: "Issue date", required: false },
  { key: "commodity", label: "Commodity", required: true, multiline: true, pureMirror: true },
  { key: "quantity", label: "Quantity", required: true, mono: true, pureMirror: true },
  { key: "quantityUnit", label: "Unit", required: false, pureMirror: true },
  { key: "quality", label: "Quality", required: false, pureMirror: true },
  { key: "unitPrice", label: "Supplier unit price", required: true, mono: true },
  { key: "totalAmount", label: "Supplier total", required: true, mono: true },
  { key: "incoterm", label: "Incoterm", required: true, mono: true, pureMirror: true },
  { key: "paymentTerms", label: "Payment terms", required: false, multiline: true, pureMirror: true },
  { key: "deliveryTerms", label: "Delivery terms", required: false, multiline: true, pureMirror: true },
];
