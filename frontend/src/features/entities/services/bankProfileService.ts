import {
  supabase,
  unwrap,
  unwrapList,
  type BankProfileRow,
  type Insertable,
  type Updatable,
} from "@/services/supabase";

const TABLE = "bank_profiles";

/**
 * Banking profile data access — CRUD over `bank_profiles` (PRD §4.2). The schema
 * enforces at most one default per entity (unique partial index), so `setDefault`
 * clears the entity's current default before setting the new one.
 */
export const bankProfileService = {
  async list(): Promise<BankProfileRow[]> {
    return unwrapList(
      await supabase.from(TABLE).select("*").order("profile_name", { ascending: true }),
    );
  },
  async create(input: Insertable<"bank_profiles">): Promise<BankProfileRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },
  async update(id: string, patch: Updatable<"bank_profiles">): Promise<BankProfileRow> {
    return unwrap(await supabase.from(TABLE).update(patch).eq("id", id).select("*").single());
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
  /** Make `id` the sole default for its entity (clears the entity's prior default first). */
  async setDefault(id: string, entityId: string): Promise<void> {
    const { error: clearErr } = await supabase
      .from(TABLE)
      .update({ is_default: false })
      .eq("entity_id", entityId)
      .eq("is_default", true);
    if (clearErr) throw clearErr;
    const { error } = await supabase.from(TABLE).update({ is_default: true }).eq("id", id);
    if (error) throw error;
  },
};
