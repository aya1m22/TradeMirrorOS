import { supabase } from "@/services/supabase";

/**
 * Tax Readiness Export (PRD §12.2) — annual per-trade data for the CPA.
 * SuperAdmin only. Trades are flagged by the entity active at the time of the
 * trade (EAS vs LLC period) to simplify IRS 5472/1065 prep. This is a data
 * export only — not a tax filing.
 */
export const INCOME_CLASSIFICATION = "Foreign Sourced Income (Non-US)";

export interface TaxRow {
  tradeRef: string;
  contractDate: string;
  client: string;
  clientCountry: string;
  entity: string;
  frigoTotal: number;
  saleTotal: number;
  shipping: number;
  insurance: number;
  bankFees: number;
  netProfit: number;
}

type Join = { name?: string; company_name?: string; country?: string } | Array<{ name?: string; company_name?: string; country?: string }> | null;
function one(j: Join): { name?: string; company_name?: string; country?: string } {
  if (!j) return {};
  return Array.isArray(j) ? (j[0] ?? {}) : j;
}

export async function fetchTaxRows(): Promise<TaxRow[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "trade_reference, contract_date, frigo_total, sale_total, shipping_cost, insurance_cost, bank_fees, net_profit, clients(company_name, country), entities(name)",
    )
    .order("contract_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r: Record<string, unknown>) => {
    const client = one(r.clients as Join);
    const entity = one(r.entities as Join);
    return {
      tradeRef: String(r.trade_reference ?? ""),
      contractDate: String(r.contract_date ?? ""),
      client: client.company_name ?? "—",
      clientCountry: client.country ?? "—",
      entity: entity.name ?? "—",
      frigoTotal: Number(r.frigo_total ?? 0),
      saleTotal: Number(r.sale_total ?? 0),
      shipping: Number(r.shipping_cost ?? 0),
      insurance: Number(r.insurance_cost ?? 0),
      bankFees: Number(r.bank_fees ?? 0),
      netProfit: Number(r.net_profit ?? 0),
    };
  });
}

export function filterByYear(rows: TaxRow[], year: number): TaxRow[] {
  return rows.filter((r) => new Date(r.contractDate).getFullYear() === year);
}

export function yearsPresent(rows: TaxRow[]): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    const y = new Date(r.contractDate).getFullYear();
    if (!Number.isNaN(y)) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "Trade ID",
  "Date of Contract",
  "Client Name",
  "Client Country",
  "Active Entity",
  "Frigo Purchase Price",
  "Sale Total",
  "Shipping",
  "Insurance",
  "Bank Fees",
  "Net Profit",
  "Income Classification",
];

export function toCsv(rows: TaxRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.tradeRef,
        r.contractDate,
        r.client,
        r.clientCountry,
        r.entity,
        r.frigoTotal.toFixed(2),
        r.saleTotal.toFixed(2),
        r.shipping.toFixed(2),
        r.insurance.toFixed(2),
        r.bankFees.toFixed(2),
        r.netProfit.toFixed(2),
        INCOME_CLASSIFICATION,
      ]
        .map(csvField)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Render the export as a simple landscape PDF table (pdf-lib). */
export async function toPdf(rows: TaxRow[], year: number): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PAGE = { w: 841.89, h: 595.28 }; // A4 landscape
  const M = 28;
  const INK = rgb(0.1, 0.12, 0.11);
  const MUTED = rgb(0.42, 0.45, 0.43);

  // Column layout (x, width, label, right-aligned?)
  const cols: { x: number; w: number; label: string; right?: boolean }[] = [
    { x: M, w: 70, label: "Trade ID" },
    { x: M + 70, w: 58, label: "Date" },
    { x: M + 128, w: 120, label: "Client" },
    { x: M + 248, w: 55, label: "Country" },
    { x: M + 303, w: 95, label: "Entity" },
    { x: M + 398, w: 62, label: "Frigo", right: true },
    { x: M + 460, w: 62, label: "Sale", right: true },
    { x: M + 522, w: 50, label: "Ship", right: true },
    { x: M + 572, w: 50, label: "Insur.", right: true },
    { x: M + 622, w: 50, label: "Bank", right: true },
    { x: M + 672, w: 62, label: "Net", right: true },
  ];

  let page = doc.addPage([PAGE.w, PAGE.h]);
  const draw = (s: string, x: number, y: number, size: number, f = font, color = INK, rightEdge?: number) => {
    const t = (s || "").replace(/[^\x00-\xFF]/g, "?");
    const xx = rightEdge !== undefined ? rightEdge - f.widthOfTextAtSize(t, size) : x;
    page.drawText(t, { x: xx, y, size, font: f, color });
  };

  const title = () => {
    draw(`Tax Readiness Export — ${year}`, M, PAGE.h - M, 13, bold);
    draw(INCOME_CLASSIFICATION, M, PAGE.h - M - 15, 8, font, MUTED);
  };
  const headerRow = (y: number) => {
    for (const c of cols) draw(c.label, c.x, y, 7, bold, MUTED, c.right ? c.x + c.w : undefined);
  };

  title();
  let y = PAGE.h - M - 36;
  headerRow(y);
  y -= 12;
  page.drawLine({ start: { x: M, y: y + 4 }, end: { x: PAGE.w - M, y: y + 4 }, color: rgb(0.85, 0.86, 0.84) });

  const money = (n: number) => n.toFixed(2);
  for (const r of rows) {
    if (y < M + 20) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - M;
      headerRow(y);
      y -= 14;
    }
    draw(r.tradeRef, cols[0].x, y, 7);
    draw(r.contractDate, cols[1].x, y, 7);
    draw(r.client.slice(0, 26), cols[2].x, y, 7);
    draw(r.clientCountry.slice(0, 12), cols[3].x, y, 7);
    draw(r.entity.slice(0, 20), cols[4].x, y, 7);
    draw(money(r.frigoTotal), 0, y, 7, font, INK, cols[5].x + cols[5].w);
    draw(money(r.saleTotal), 0, y, 7, font, INK, cols[6].x + cols[6].w);
    draw(money(r.shipping), 0, y, 7, font, INK, cols[7].x + cols[7].w);
    draw(money(r.insurance), 0, y, 7, font, INK, cols[8].x + cols[8].w);
    draw(money(r.bankFees), 0, y, 7, font, INK, cols[9].x + cols[9].w);
    draw(money(r.netProfit), 0, y, 7, bold, INK, cols[10].x + cols[10].w);
    y -= 12;
  }

  if (rows.length === 0) draw("No trades for this year.", M, y, 9, font, MUTED);
  return doc.save();
}
