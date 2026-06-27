import { supabase, type MilestoneStatus, type TradeStatus } from "@/services/supabase";

/**
 * Partner Dashboard read model (PRD §13). Partners see full financials per trade
 * (Frigo buy price, sale, itemized costs, net profit) but NEVER any profit split
 * — the app neither stores nor exposes splits anywhere.
 */
export interface PartnerTrade {
  id: string;
  tradeRef: string;
  client: string;
  entity: string;
  contractDate: string;
  signingDate: string | null;
  bolDate: string | null;
  status: TradeStatus;
  advanceStatus: MilestoneStatus;
  balanceStatus: MilestoneStatus;
  frigoTotal: number;
  saleTotal: number;
  shipping: number;
  insurance: number;
  bankFees: number;
  totalCosts: number;
  netProfit: number;
}

type Join = { name?: string; company_name?: string } | Array<{ name?: string; company_name?: string }> | null;
function one(j: Join) {
  if (!j) return {} as { name?: string; company_name?: string };
  return Array.isArray(j) ? (j[0] ?? {}) : j;
}

export async function fetchPartnerTrades(): Promise<PartnerTrade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, trade_reference, contract_date, signing_date, bol_date, trade_status, advance_status, balance_status, frigo_total, sale_total, shipping_cost, insurance_cost, bank_fees, total_costs, net_profit, clients(company_name), entities(name)",
    )
    .order("contract_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    tradeRef: String(r.trade_reference ?? ""),
    client: one(r.clients as Join).company_name ?? "—",
    entity: one(r.entities as Join).name ?? "—",
    contractDate: String(r.contract_date ?? ""),
    signingDate: (r.signing_date as string) ?? null,
    bolDate: (r.bol_date as string) ?? null,
    status: r.trade_status as TradeStatus,
    advanceStatus: r.advance_status as MilestoneStatus,
    balanceStatus: r.balance_status as MilestoneStatus,
    frigoTotal: Number(r.frigo_total ?? 0),
    saleTotal: Number(r.sale_total ?? 0),
    shipping: Number(r.shipping_cost ?? 0),
    insurance: Number(r.insurance_cost ?? 0),
    bankFees: Number(r.bank_fees ?? 0),
    totalCosts: Number(r.total_costs ?? 0),
    netProfit: Number(r.net_profit ?? 0),
  }));
}

export interface PartnerPortfolio {
  totalTrades: number;
  investedCapital: number;
  totalNetProfit: number;
  activeTrades: number;
  overdueMilestones: number;
}

const ACTIVE: TradeStatus[] = ["active", "advance_received", "shipped"];

export function summarize(trades: PartnerTrade[]): PartnerPortfolio {
  return {
    totalTrades: trades.length,
    investedCapital: trades.reduce((n, t) => n + t.frigoTotal, 0),
    totalNetProfit: trades.reduce((n, t) => n + t.netProfit, 0),
    activeTrades: trades.filter((t) => ACTIVE.includes(t.status)).length,
    overdueMilestones: trades.reduce(
      (n, t) => n + (t.advanceStatus === "overdue" ? 1 : 0) + (t.balanceStatus === "overdue" ? 1 : 0),
      0,
    ),
  };
}
