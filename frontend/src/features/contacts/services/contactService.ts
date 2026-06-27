import {
  supabase,
  unwrap,
  unwrapList,
  type ContactRow,
  type Insertable,
  type Updatable,
} from "@/services/supabase";

const TABLE = "contacts";

/**
 * Contact Library data access — CRUD over the `contacts` table (PRD §6), the
 * internal address book whose details fill the contract's "Contact Person" block.
 *
 * The schema enforces at most one default contact (unique partial index), so
 * `setDefault` clears the current default before setting the new one.
 */
export const contactService = {
  async list(): Promise<ContactRow[]> {
    return unwrapList(
      await supabase
        .from(TABLE)
        .select("*")
        .order("is_default", { ascending: false })
        .order("full_name", { ascending: true }),
    );
  },

  async create(input: Insertable<"contacts">): Promise<ContactRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },

  async update(id: string, patch: Updatable<"contacts">): Promise<ContactRow> {
    return unwrap(await supabase.from(TABLE).update(patch).eq("id", id).select("*").single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },

  /** Make `id` the sole default (clears any existing default first). */
  async setDefault(id: string): Promise<void> {
    const { error: clearErr } = await supabase
      .from(TABLE)
      .update({ is_default: false })
      .eq("is_default", true);
    if (clearErr) throw clearErr;
    const { error } = await supabase.from(TABLE).update({ is_default: true }).eq("id", id);
    if (error) throw error;
  },
};
