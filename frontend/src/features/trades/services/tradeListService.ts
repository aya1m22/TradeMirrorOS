import { supabase, type TradeRow, type TradeStatus } from "@/services/supabase";

/**
 * Read model for the Trade Dashboard. Reads go through the `v_trades` view,
 * which enforces the financial-visibility matrix and partner row-scoping at the
 * database (see migration 20260628120000). Internal users get NULL financials;
 * the raw `trades` table is super_admin-only — never queried for reads here.
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

const LIST_COLUMNS =
  "id, trade_reference, frigo_contract_ref, product_description, quantity_tons, contract_date, trade_status, client_company_name";

// Same fields, read from the base table when the view isn't present yet.
const LIST_COLUMNS_BASE =
  "id, trade_reference, frigo_contract_ref, product_description, quantity_tons, contract_date, trade_status, clients(company_name)";

/** Coerce a view's (possibly masked → NULL) numeric column to a number. */
const num = (v: number | null | undefined): number => Number(v ?? 0);

// The masking view ships in migration 20260628120000. Until it's applied to a
// given environment, fall back to the base `trades` table so the app keeps
// working. Financials remain UI-gated to super_admin in that fallback; full
// server-side masking + partner scoping activate once the migration is applied.
function isViewMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || /v_trades/.test(error.message ?? "");
}

type ClientJoin = { company_name: string } | { company_name: string }[] | null;
function clientName(c: ClientJoin): string | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.company_name ?? null) : c.company_name;
}

export async function listTrades(): Promise<TradeListItem[]> {
  const viaView = await supabase
    .from("v_trades")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false });

  if (!viaView.error) {
    return (viaView.data ?? []).map((r) => ({
      id: r.id,
      tradeReference: r.trade_reference,
      contractNumber: r.frigo_contract_ref,
      client: r.client_company_name,
      commodity: r.product_description,
      quantityTons: Number(r.quantity_tons),
      contractDate: r.contract_date,
      status: r.trade_status,
    }));
  }
  if (!isViewMissing(viaView.error)) throw viaView.error;

  // Fallback: base table (pre-migration).
  const viaBase = await supabase
    .from("trades")
    .select(LIST_COLUMNS_BASE)
    .order("created_at", { ascending: false });
  if (viaBase.error) throw viaBase.error;
  return ((viaBase.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    tradeReference: String(r.trade_reference),
    contractNumber: String(r.frigo_contract_ref),
    client: clientName(r.clients as ClientJoin),
    commodity: String(r.product_description),
    quantityTons: Number(r.quantity_tons),
    contractDate: String(r.contract_date),
    status: r.trade_status as TradeStatus,
  }));
}

export async function getTrade(id: string): Promise<TradeDetail | null> {
  const viaView = await supabase.from("v_trades").select("*").eq("id", id).maybeSingle();

  if (!viaView.error) {
    if (!viaView.data) return null;
    const { client_company_name, entity_name, ...v } = viaView.data;
    void entity_name;
    // The view masks financial columns to NULL for non-super-admins; coerce to
    // numbers so the shape matches TradeRow. Those values are never displayed to
    // roles that receive NULLs (the Financials card is super_admin-only).
    const row: TradeRow = {
      ...v,
      frigo_unit_price: num(v.frigo_unit_price),
      frigo_total: num(v.frigo_total),
      sale_unit_price: num(v.sale_unit_price),
      sale_total: num(v.sale_total),
      shipping_cost: num(v.shipping_cost),
      insurance_cost: num(v.insurance_cost),
      bank_fees: num(v.bank_fees),
      total_costs: num(v.total_costs),
      net_profit: num(v.net_profit),
    };
    return { ...row, client: client_company_name };
  }
  if (!isViewMissing(viaView.error)) throw viaView.error;

  // Fallback: base table (pre-migration). `partner_id` may not exist yet, so it
  // is defaulted; the Financials card is still UI-gated to super_admin.
  const viaBase = await supabase
    .from("trades")
    .select("*, clients(company_name)")
    .eq("id", id)
    .maybeSingle();
  if (viaBase.error) throw viaBase.error;
  if (!viaBase.data) return null;
  const { clients, ...row } = viaBase.data as unknown as TradeRow & { clients: ClientJoin };
  return {
    ...(row as TradeRow),
    partner_id: (row as Partial<TradeRow>).partner_id ?? null,
    client: clientName(clients),
  };
}
