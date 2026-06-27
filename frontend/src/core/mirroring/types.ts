import type { ExtractedFieldKey } from "@/core/pdf-engine/parse";

export interface Party {
  name: string;
  address: string;
  city: string;
  country: string;
  taxId: string;
}

/**
 * The company Sales Contract produced by mirroring the supplier contract.
 * Back-to-back cargo fields are preserved verbatim; the company becomes seller,
 * the customer becomes buyer, and pricing is the company's own.
 */
export interface MirroredContract {
  seller: Party; // the company (was the buyer on the supplier contract)
  buyer: Party; // the end customer (new on the sell side)

  // ── Back-to-back (locked) ──────────────────────────────────────────────
  commodity: string;
  quantity: number;
  quantityUnit: string;
  quality: string;
  incoterm: string;
  deliveryTerms: string;

  // ── Financial (editable) ───────────────────────────────────────────────
  currency: string;
  supplierUnitPrice: number; // reference price from the supplier contract
  marginPerUnit: number;
  saleUnitPrice: number; // supplierUnitPrice + marginPerUnit (or overridden)
  shippingCost: number;
  insuranceCost: number;
  bankFees: number;
  paymentTerms: string;

  // ── References ─────────────────────────────────────────────────────────
  frigoContractRef: string;
  issueDate: string;
}

/** Fields preserved back-to-back — read-only/locked in the editor. */
export const LOCKED_FIELDS = [
  "commodity",
  "quantity",
  "quantityUnit",
  "quality",
  "incoterm",
  "deliveryTerms",
] as const satisfies readonly (keyof MirroredContract)[];

export type LockedField = (typeof LOCKED_FIELDS)[number];

/** The reviewed extraction values handed to the mirror (verbatim strings). */
export type ReviewedValues = Record<ExtractedFieldKey, string>;
