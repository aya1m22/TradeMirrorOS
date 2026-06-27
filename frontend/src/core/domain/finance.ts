/**
 * Financial helpers for the mirror + editor. Pure functions only — the PRD §9.1
 * formulas live here so the UI and the trades row agree on every number.
 */

/** Round to 2 decimals, avoiding binary float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Parse a Latin-formatted number ("2.100,000" → 2100, "56.700,00" → 56700).
 * '.' is the thousands separator, ',' the decimal. Tolerates plain numbers and
 * stray currency symbols; returns 0 for empty/unparseable input.
 */
export function parseLatinNumber(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const s = raw.replace(/[^0-9.,]/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let norm: string;
  if (hasComma && hasDot) norm = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) norm = s.replace(",", ".");
  else if (hasDot) norm = s.replace(/\.(?=\d{3}(\D|$))/g, ""); // dots as thousands
  else norm = s;
  const n = parseFloat(norm);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Format a number in the Latin convention used on the Frigorífico contract:
 * '.' thousands, ',' decimals. Inverse of {@link parseLatinNumber}.
 *   formatLatinNumber(2310, 3)  → "2.310,000"
 *   formatLatinNumber(62370, 2) → "62.370,00"
 */
export function formatLatinNumber(n: number, decimals: number): string {
  const fixed = (n || 0).toFixed(decimals);
  const [intPart, dec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals > 0 ? `${grouped},${dec}` : grouped;
}

/** Format an amount for the company document, e.g. "USD 56,700.00". */
export function formatMoney(amount: number, currency = "USD"): string {
  const value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${currency} ${value}`;
}

/** Format a quantity, trimming needless decimals (27 → "27", 27.5 → "27.5"). */
export function formatQuantity(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n || 0);
}

export interface ContractFinancials {
  saleUnitPrice: number;
  saleTotal: number;
  frigoTotal: number;
  marginTotal: number;
  totalCosts: number;
  netProfit: number;
}

/**
 * Derive every dependent figure from the editable inputs (PRD §9.1):
 *   saleUnitPrice = supplierUnitPrice + margin
 *   saleTotal     = quantity × saleUnitPrice
 *   totalCosts    = frigoTotal + shipping + insurance + bankFees
 *   netProfit     = saleTotal − totalCosts
 */
export function computeFinancials(input: {
  quantity: number;
  supplierUnitPrice: number;
  saleUnitPrice: number;
  shippingCost: number;
  insuranceCost: number;
  bankFees: number;
}): ContractFinancials {
  const frigoTotal = round2(input.quantity * input.supplierUnitPrice);
  const saleTotal = round2(input.quantity * input.saleUnitPrice);
  const marginTotal = round2(saleTotal - frigoTotal);
  const totalCosts = round2(
    frigoTotal + input.shippingCost + input.insuranceCost + input.bankFees,
  );
  const netProfit = round2(saleTotal - totalCosts);
  return {
    saleUnitPrice: input.saleUnitPrice,
    saleTotal,
    frigoTotal,
    marginTotal,
    totalCosts,
    netProfit,
  };
}
