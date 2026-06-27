import {
  supabase,
  unwrap,
  unwrapList,
  unwrapMaybe,
  type ClientRow,
  type Insertable,
  type Updatable,
} from "@/services/supabase";
import type { ClientRepository } from "@/services/repository/contracts";

const TABLE = "clients";

/**
 * Client (buyer) data access — CRUD over the `clients` table. Search/sort and
 * the form belong to the Client CMS feature; this layer is pure persistence.
 */
export const clientService: ClientRepository = {
  async list(): Promise<ClientRow[]> {
    return unwrapList(
      await supabase.from(TABLE).select("*").order("company_name", { ascending: true }),
    );
  },

  async getById(id: string): Promise<ClientRow | null> {
    return unwrapMaybe(
      await supabase.from(TABLE).select("*").eq("id", id).maybeSingle(),
    );
  },

  async create(input: Insertable<"clients">): Promise<ClientRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },

  async update(id: string, patch: Updatable<"clients">): Promise<ClientRow> {
    return unwrap(
      await supabase.from(TABLE).update(patch).eq("id", id).select("*").single(),
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
