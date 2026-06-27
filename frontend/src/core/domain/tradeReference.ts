/**
 * Trade reference generator (PRD §14: "CF-2026-001"). Pure: the caller supplies
 * the year and the next sequence number (e.g. existing trade count + 1).
 */
export function generateTradeReference(year: number, sequence: number): string {
  return `CF-${year}-${String(sequence).padStart(3, "0")}`;
}
