import { supabase } from "@/services/supabase";
import { listTrades, type TradeListItem } from "@/features/trades/services/tradeListService";

/**
 * Admin dashboard read model — all live, from existing tables. No mock data.
 * Counts respect RLS: documents/trades are readable by staff; the users count is
 * only fetched for super_admin (RLS lets others read only their own row).
 */
export interface DashboardStats {
  tradeCount: number;
  documentCount: number;
  /** null when the signed-in role isn't allowed to enumerate users. */
  userCount: number | null;
  recentTrades: TradeListItem[];
}

export async function fetchDashboardStats(isSuperAdmin: boolean): Promise<DashboardStats> {
  // Trades: reuse the list service — already view/fallback-aware and ordered
  // newest-first, so it doubles as the count and the recent-activity source.
  const trades = await listTrades();

  const docs = await supabase.from("documents").select("id", { count: "exact", head: true });
  if (docs.error) throw docs.error;

  let userCount: number | null = null;
  if (isSuperAdmin) {
    const users = await supabase.from("users").select("id", { count: "exact", head: true });
    if (users.error) throw users.error;
    userCount = users.count ?? 0;
  }

  return {
    tradeCount: trades.length,
    documentCount: docs.count ?? 0,
    userCount,
    recentTrades: trades.slice(0, 5),
  };
}
