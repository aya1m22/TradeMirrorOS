import {
  supabase,
  unwrap,
  unwrapList,
  unwrapMaybe,
  type TradeRow,
  type Insertable,
  type Updatable,
} from "@/services/supabase";
import type { TradeRepository } from "@/services/repository/contracts";

const TABLE = "trades";

/**
 * Trade data access — CRUD over the `trades` table plus a reference lookup.
 * Financial calculation, milestone derivation, and the trade_status machine
 * are business logic and live in `core/domain` (a later step), not here.
 */
export const tradeService: TradeRepository = {
  async list(): Promise<TradeRow[]> {
    return unwrapList(
      await supabase.from(TABLE).select("*").order("created_at", { ascending: false }),
    );
  },

  async getById(id: string): Promise<TradeRow | null> {
    return unwrapMaybe(
      await supabase.from(TABLE).select("*").eq("id", id).maybeSingle(),
    );
  },

  async getByReference(reference: string): Promise<TradeRow | null> {
    return unwrapMaybe(
      await supabase
        .from(TABLE)
        .select("*")
        .eq("trade_reference", reference)
        .maybeSingle(),
    );
  },

  async create(input: Insertable<"trades">): Promise<TradeRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },

  async update(id: string, patch: Updatable<"trades">): Promise<TradeRow> {
    return unwrap(
      await supabase.from(TABLE).update(patch).eq("id", id).select("*").single(),
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
