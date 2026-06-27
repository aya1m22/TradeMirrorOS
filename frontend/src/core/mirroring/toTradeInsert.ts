import { computeFinancials } from "@/core/domain/finance";
import type { Insertable } from "@/services/supabase";
import type { MirroredContract } from "./types";

export interface TradePersistContext {
  tradeReference: string;
  entityId: string;
  bankProfileId: string;
  clientId: string;
  contactId: string;
  /** ISO date (yyyy-mm-dd) for the company contract. */
  contractDate: string;
}

/**
 * Map a mirrored contract onto a `trades` insert. total_costs / net_profit are
 * generated columns, so they are intentionally omitted. Pure and testable.
 */
export function toTradeInsert(
  m: MirroredContract,
  ctx: TradePersistContext,
): Insertable<"trades"> {
  const fin = computeFinancials({
    quantity: m.quantity,
    supplierUnitPrice: m.supplierUnitPrice,
    saleUnitPrice: m.saleUnitPrice,
    shippingCost: m.shippingCost,
    insuranceCost: m.insuranceCost,
    bankFees: m.bankFees,
  });

  return {
    trade_reference: ctx.tradeReference,
    entity_id: ctx.entityId,
    bank_profile_id: ctx.bankProfileId,
    client_id: ctx.clientId,
    contact_id: ctx.contactId,
    contract_date: ctx.contractDate,
    frigo_contract_ref: m.frigoContractRef || "—",
    quantity_tons: m.quantity,
    product_description: m.commodity,
    frigo_unit_price: m.supplierUnitPrice,
    frigo_total: fin.frigoTotal,
    sale_unit_price: m.saleUnitPrice,
    sale_total: fin.saleTotal,
    shipping_cost: m.shippingCost,
    insurance_cost: m.insuranceCost,
    bank_fees: m.bankFees,
    advance_status: "pending",
    balance_status: "pending",
    trade_status: "draft",
  };
}
