/**
 * Coordinate map for the Frigorífico Concepción "Contrato 701-2026" layout.
 *
 * Phase 1 supports this single template. Coordinates were measured directly from
 * `src/data/fixtures/contrato-701-2026.pdf` (A4, 595×842pt, PDF user space with a
 * bottom-left origin — identical to pdf-lib's coordinate system, so the numbers
 * here drop straight into `page.drawText` / `page.drawRectangle`).
 *
 * The overlay strategy is: for every WHITE-BLOCK field, paint a white rectangle
 * over the source text and draw the new value in its place. Every PURE-MIRROR
 * field (quantity, description, incoterm, brand/temp/packing/validity/plant no.,
 * clauses, QR code, Frigo signature) is simply left untouched on the page.
 */

export const PAGE_701 = { width: 595, height: 842 } as const;

export type Align = "left" | "right" | "center";

export interface OverlayOp {
  /** White rectangle painted over the original text (page coordinates). */
  rect: { x: number; y: number; w: number; h: number };
  /** The value to draw in place. */
  value: string;
  /** Text baseline Y (matches the original line). */
  y: number;
  /** Anchor X: left edge (left), right edge (right), or centre (center). */
  x: number;
  size: number;
  bold: boolean;
  align: Align;
}

export interface OverlayParty {
  name: string;
  address: string;
  city: string;
  country: string;
  taxId: string;
}

export interface OverlayBank {
  intermediaryBankName: string;
  intermediaryBankSwift: string;
  bankName: string;
  bankSwift: string;
  accountNumber: string;
  araNumber: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
}

export interface OverlayContact {
  name: string;
  phone: string;
  email: string;
}

/** Everything the overlay needs to mirror a 701-2026 contract. */
export interface OverlayData {
  exporter: OverlayParty; // active entity (was Frigorífico)
  client: OverlayParty; // selected end-buyer (was the active entity)
  contact: OverlayContact;
  /** Latin-formatted ("2.310,000"). */
  unitPriceLatin: string;
  /** Latin-formatted ("62.370,00"). */
  totalLatin: string;
  freightLatin: string;
  insuranceLatin: string;
  prepaymentText: string;
  balanceText: string;
  bank: OverlayBank;
  buyerSignatureName: string; // active entity name
  /**
   * Admin overrides of normally pure-mirror cargo fields. Only present when the
   * operator unlocked and changed a field; each is white-blocked + injected so
   * the PDF reflects the modified value. Fields without a single coordinate on
   * this template (quality, delivery terms) aren't re-injected.
   */
  overrides?: {
    commodity?: string;
    quantityLatin?: string;
    incoterm?: string;
  };
}

// Injected overlay text is rendered ~12% smaller than the source labels so long
// mirrored values fit their white blocks more cleanly. Coordinates and the
// white-block sizing/spacing math are unchanged — only the font size shrinks.
const TEXT_SCALE = 0.88;
const sz = (base: number) => Math.round(base * TEXT_SCALE * 10) / 10;

// ── op builders ─────────────────────────────────────────────────────────────
function L(value: string, x: number, y: number, w: number, base = 8, bold = false): OverlayOp {
  const size = sz(base);
  return { rect: { x, y: y - 2.5, w, h: base + 4 }, value, x, y, size, bold, align: "left" };
}
function R(value: string, rightX: number, y: number, leftX: number, base = 8, bold = false): OverlayOp {
  const size = sz(base);
  return { rect: { x: leftX, y: y - 2.5, w: rightX - leftX, h: base + 4 }, value, x: rightX, y, size, bold, align: "right" };
}
function C(value: string, cx: number, y: number, leftX: number, rightX: number, base = 8, bold = false): OverlayOp {
  const size = sz(base);
  return { rect: { x: leftX, y: y - 2.5, w: rightX - leftX, h: base + 4 }, value, x: cx, y, size, bold, align: "center" };
}

/**
 * Turn mirrored data into the list of white-block + inject operations for the
 * 701-2026 layout. Empty values still get a white block (so stale source text is
 * removed) but draw nothing.
 */
export function buildOverlayOps(d: OverlayData): OverlayOp[] {
  const ops: OverlayOp[] = [
    // ── Exporter block → active entity ──────────────────────────────────────
    L(d.exporter.name, 74, 741.5, 270),
    L(d.exporter.taxId, 74, 732.5, 270),
    L(d.exporter.address, 74, 723.5, 270),
    L(d.exporter.city, 74, 714.5, 270),
    L(d.exporter.country, 74, 703.5, 270),

    // ── Client block → selected buyer ───────────────────────────────────────
    L(d.client.name, 74, 690.5, 270),
    L(d.client.address, 74, 679.5, 270),
    L(d.client.city, 74, 669.5, 270),
    L(d.client.country, 74, 659.5, 270),

    // ── Contact Person block ────────────────────────────────────────────────
    L(d.contact.name, 418, 690.5, 127),
    L(d.contact.phone, 418, 680.5, 127),
    L(d.contact.email, 418, 670.5, 127),

    // ── Payer (mirrors client) ──────────────────────────────────────────────
    L(d.client.name, 74, 636.5, 270),
    L(d.client.country, 165, 627.7, 180),
    L(d.client.country, 165, 618.7, 180),

    // ── Pricing (product row + grand total) ─────────────────────────────────
    R(d.unitPriceLatin, 496, 559.7, 440, 9),
    R(d.totalLatin, 557, 559.7, 516, 9),
    R(d.totalLatin, 557, 547.2, 516, 9, true),

    // ── Freight / Insurance (primary column) ────────────────────────────────
    L(d.freightLatin, 431, 328.1, 42),
    L(d.insuranceLatin, 431, 319.1, 42),

    // ── Prepayment / Balance conditions ─────────────────────────────────────
    L(d.prepaymentText, 104, 272.5, 245),
    L(d.balanceText, 104, 263.5, 245),

    // ── Beneficiary bank block → active banking profile ─────────────────────
    L(d.bank.intermediaryBankName, 104, 226.6, 240),
    L(d.bank.intermediaryBankSwift, 104, 217.5, 240),
    L(d.bank.araNumber, 104, 186.5, 240),
    L(d.bank.bankName, 104, 176.5, 240),
    L(d.bank.bankSwift, 104, 166.5, 240),
    L(d.bank.accountNumber, 104, 155.5, 240),
    L(d.bank.beneficiaryName, 104, 135.5, 240),
    L(d.bank.beneficiaryAddress, 104, 126.3, 240),

    // ── Buyer signature → active entity name ────────────────────────────────
    C(d.buyerSignatureName, 455, 68.5, 355, 560, 10, true),
  ];

  // ── Optional admin overrides of pure-mirror cargo fields ──────────────────
  const o = d.overrides;
  if (o?.commodity) ops.push(L(o.commodity, 119, 559.7, 316, 9));
  if (o?.quantityLatin) {
    ops.push(L(o.quantityLatin, 84.5, 559.7, 30, 9)); // product row
    ops.push(L(o.quantityLatin, 84.5, 547.2, 30, 9)); // total row
  }
  if (o?.incoterm) ops.push(L(o.incoterm, 408, 375.5, 137, 8));

  return ops;
}
