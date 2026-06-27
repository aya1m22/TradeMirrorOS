import { supabase } from "@/services/supabase";
import { TRADE_DOCUMENTS_BUCKET } from "@/features/trades/services/documentService";

/**
 * Storage access for Trade Folder files. The original supplier PDF is uploaded
 * here at the start of the flow; signed-download URLs come from documentService.
 *
 * Requires an authenticated staff session and the migrated bucket (RLS gates
 * uploads to super_admin / internal). Callers handle failure gracefully so the
 * extraction workflow can still proceed if storage isn't reachable.
 */
export interface UploadedFile {
  path: string;
  fileName: string;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export const storageService = {
  /** Upload an original supplier contract; returns its storage path. */
  async uploadOriginalContract(file: File): Promise<UploadedFile> {
    const path = `originals/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from(TRADE_DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return { path, fileName: file.name };
  },

  /** Upload a generated company contract (raw PDF bytes); returns its path. */
  async uploadGeneratedContract(bytes: Uint8Array, fileName: string): Promise<UploadedFile> {
    const path = `generated/${crypto.randomUUID()}-${safeName(fileName)}`;
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const { error } = await supabase.storage
      .from(TRADE_DOCUMENTS_BUCKET)
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return { path, fileName };
  },

  /** Upload an arbitrary Trade Folder document (signed contract, BOL, etc.). */
  async uploadDocument(file: File): Promise<UploadedFile> {
    const path = `documents/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from(TRADE_DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) throw error;
    return { path, fileName: file.name };
  },

  /**
   * Remove an uploaded object. Used to compensate (roll back) a partially-failed
   * multi-step save so no orphaned file is left behind.
   */
  async remove(path: string): Promise<void> {
    const { error } = await supabase.storage.from(TRADE_DOCUMENTS_BUCKET).remove([path]);
    if (error) throw error;
  },
};
