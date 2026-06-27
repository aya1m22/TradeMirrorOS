import {
  supabase,
  unwrap,
  unwrapList,
  type EntityRow,
  type Insertable,
  type Updatable,
} from "@/services/supabase";

const TABLE = "entities";

/**
 * Entity profile data access — CRUD over the `entities` table (PRD §4.1).
 * The "Acting Entity" selection itself is per-contract in the editor; this is the
 * management layer for the profiles.
 */
export const entityService = {
  async list(): Promise<EntityRow[]> {
    return unwrapList(
      await supabase.from(TABLE).select("*").order("name", { ascending: true }),
    );
  },
  async create(input: Insertable<"entities">): Promise<EntityRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },
  async update(id: string, patch: Updatable<"entities">): Promise<EntityRow> {
    return unwrap(await supabase.from(TABLE).update(patch).eq("id", id).select("*").single());
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
