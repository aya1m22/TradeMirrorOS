import { supabase, type MilestoneStatus, type TradeStatus } from "@/services/supabase";

/**
 * Partner Dashboard read model (PRD §13). Reads go through the `v_trades` view,
 * which scopes rows to trades assigned to the signed-in partner and exposes
 * net_profit only — the supplier buy price, sale price, and itemized cost
 * breakdown are masked to NULL at the database. No profit split exists anywhere.
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
  netProfit: number;
}

export async function fetchPartnerTrades(): Promise<PartnerTrade[]> {
  const { data, error } = await supabase
    .from("v_trades")
    .select(
      "id, trade_reference, contract_date, signing_date, bol_date, trade_status, advance_status, balance_status, net_profit, client_company_name, entity_name",
    )
    .order("contract_date", { ascending: false });
  // The partner view + scoping ship in migration 20260628120000. If it isn't
  // applied yet, fail safe with an empty portfolio rather than reading the base
  // table (which has no partner scoping) — never leak other partners' trades.
  if (error) {
    if (error.code === "PGRST205" || /v_trades/.test(error.message ?? "")) return [];
    throw error;
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    tradeRef: r.trade_reference,
    client: r.client_company_name ?? "—",
    entity: r.entity_name ?? "—",
    contractDate: r.contract_date,
    signingDate: r.signing_date,
    bolDate: r.bol_date,
    status: r.trade_status,
    advanceStatus: r.advance_status,
    balanceStatus: r.balance_status,
    netProfit: Number(r.net_profit ?? 0),
  }));
}

export interface PartnerPortfolio {
  totalTrades: number;
  totalNetProfit: number;
  activeTrades: number;
  overdueMilestones: number;
}

const ACTIVE: TradeStatus[] = ["active", "advance_received", "shipped"];

export function summarize(trades: PartnerTrade[]): PartnerPortfolio {
  return {
    totalTrades: trades.length,
    totalNetProfit: trades.reduce((n, t) => n + t.netProfit, 0),
    activeTrades: trades.filter((t) => ACTIVE.includes(t.status)).length,
    overdueMilestones: trades.reduce(
      (n, t) => n + (t.advanceStatus === "overdue" ? 1 : 0) + (t.balanceStatus === "overdue" ? 1 : 0),
      0,
    ),
  };
}
