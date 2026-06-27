import { supabase, type TradeRow, type TradeStatus } from "@/services/supabase";

/**
 * Read model for the Trade Dashboard — trades joined with their client's name.
 * Pure read access; does not touch the Phase-1 write services (tradeService).
 */
export interface TradeListItem {
  id: string;
  tradeReference: string;
  contractNumber: string;
  client: string | null;
  commodity: string;
  quantityTons: number;
  contractDate: string;
  status: TradeStatus;
}

export interface TradeDetail extends TradeRow {
  client: string | null;
}

// The clients relation may arrive as an object (single FK) or, depending on
// inference, a one-element array — normalize both.
type ClientJoin = { company_name: string } | { company_name: string }[] | null;
function clientName(c: ClientJoin): string | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.company_name ?? null) : c.company_name;
}

const LIST_COLUMNS =
  "id, trade_reference, frigo_contract_ref, product_description, quantity_tons, contract_date, trade_status, clients(company_name)";

export async function listTrades(): Promise<TradeListItem[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    trade_reference: string;
    frigo_contract_ref: string;
    product_description: string;
    quantity_tons: number | string;
    contract_date: string;
    trade_status: TradeStatus;
    clients: ClientJoin;
  }>;

  return rows.map((r) => ({
    id: r.id,
    tradeReference: r.trade_reference,
    contractNumber: r.frigo_contract_ref,
    client: clientName(r.clients),
    commodity: r.product_description,
    quantityTons: Number(r.quantity_tons),
    contractDate: r.contract_date,
    status: r.trade_status,
  }));
}

export async function getTrade(id: string): Promise<TradeDetail | null> {
  const { data, error } = await supabase
    .from("trades")
    .select("*, clients(company_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { clients, ...row } = data as unknown as TradeRow & { clients: ClientJoin };
  return { ...(row as TradeRow), client: clientName(clients) };
}
