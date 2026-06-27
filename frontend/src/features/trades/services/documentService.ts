import {
  supabase,
  unwrap,
  unwrapList,
  type DocumentRow,
  type Insertable,
} from "@/services/supabase";
import type { DocumentRepository } from "@/services/repository/contracts";

const TABLE = "documents";

/** Supabase Storage bucket that holds every Trade Folder document. */
export const TRADE_DOCUMENTS_BUCKET = "trade-documents";

/**
 * Document data access — metadata rows in `documents` plus signed-URL access
 * to the stored files. The bucket itself is provisioned in the Supabase setup
 * step; these methods are ready for it.
 */
export const documentService: DocumentRepository = {
  async listByTrade(tradeId: string): Promise<DocumentRow[]> {
    return unwrapList(
      await supabase
        .from(TABLE)
        .select("*")
        .eq("trade_id", tradeId)
        .order("uploaded_at", { ascending: false }),
    );
  },

  async create(input: Insertable<"documents">): Promise<DocumentRow> {
    return unwrap(await supabase.from(TABLE).insert(input).select("*").single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },

  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(TRADE_DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },
};
