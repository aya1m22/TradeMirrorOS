import { documentService } from "@/features/trades/services/documentService";
import { createZip, type ZipEntry } from "./zip";
import type { DocumentRow } from "@/services/supabase";

/**
 * Audit Trail ZIP (PRD §12.1) — one-click bundle of every document in a trade's
 * folder ("chain of title"). Fetches each file via a signed URL and packs them
 * into a single ZIP. Numeric prefixes keep a stable, readable order.
 */
const ORDER_PREFIX: Record<string, string> = {
  frigo_contract: "01-supplier-contract",
  sales_contract: "02-sales-contract",
  signed_contract: "03-signed-contract",
  bol: "04-bill-of-lading",
  other: "05-other",
};

export async function buildAuditZip(docs: DocumentRow[]): Promise<Uint8Array> {
  const entries: ZipEntry[] = [];
  const seen = new Map<string, number>();
  for (const d of docs) {
    const url = await documentService.getSignedUrl(d.storage_path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't fetch "${d.file_name}" (${res.status}).`);
    const data = new Uint8Array(await res.arrayBuffer());
    const prefix = ORDER_PREFIX[d.document_type] ?? "doc";
    // De-duplicate names within the same type.
    const n = (seen.get(prefix) ?? 0) + 1;
    seen.set(prefix, n);
    const suffix = n > 1 ? `-${n}` : "";
    entries.push({ name: `${prefix}${suffix}-${d.file_name}`, data });
  }
  return createZip(entries);
}
