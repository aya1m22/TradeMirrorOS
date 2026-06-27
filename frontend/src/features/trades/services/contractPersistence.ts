import { storageService } from "@/services/storage/storageService";
import { tradeService } from "./tradeService";
import { documentService } from "./documentService";
import { authService } from "@/features/auth/services/authService";
import { generateTradeReference } from "@/core/domain/tradeReference";
import { toTradeInsert, type MirroredContract } from "@/core/mirroring";

/** Return the current Supabase session (null when signed out). */
async function ensureSession() {
  return authService.getSession();
}

/**
 * Default persistence context — the seeded entity / bank / client / contact
 * (Step 3 seed). A stand-in until the trade-creation pickers (entity, client,
 * contact selection) exist in the trades module; the financial data comes from
 * the mirrored contract. Active entity for Phase 1 is Chipa Tech E.A.S., whose
 * default bank profile is 3333… — they belong together.
 */
const DEFAULT_CONTEXT = {
  entityId: "11111111-1111-1111-1111-111111111111", // Chipa Tech E.A.S. (active entity)
  bankProfileId: "33333333-3333-3333-3333-333333333333", // its default bank profile
  clientId: "44444444-4444-4444-4444-444444444444",
  contactId: "55555555-5555-5555-5555-555555555555",
};

export interface PersistResult {
  tradeId: string;
  documentId: string;
  storagePath: string;
  tradeReference: string;
}

/**
 * Persist a generated company contract: upload the PDF to storage, create the
 * trade row, and record the document metadata. Requires the migrated backend
 * and an authenticated staff session (RLS gates writes to super_admin).
 */
export interface PersistContext {
  entityId: string;
  bankProfileId: string;
  clientId: string;
  contactId: string;
}

export async function persistGeneratedContract(args: {
  bytes: Uint8Array;
  fileName: string;
  mirrored: MirroredContract;
  /** Selected entity / bank / contact (+ client). Falls back to the seed defaults. */
  context?: Partial<PersistContext>;
}): Promise<PersistResult> {
  const session = await ensureSession();
  if (!session) {
    throw new Error(
      "Saving to the Trade Folder needs an authenticated session. Please sign in and try " +
        "again — your PDF still previews and downloads.",
    );
  }

  // Best-effort sequence number for the human reference.
  const existing = await tradeService.list().catch(() => []);
  const year = new Date().getFullYear();
  const reference = generateTradeReference(year, existing.length + 1);
  const contractDate = new Date().toISOString().slice(0, 10);

  // Multi-step write with compensation: trade row → storage object → document
  // row. There is no cross-service transaction, so if a later step fails we undo
  // the earlier ones (reverse order) to avoid orphaned files / dangling trades.
  const tradeInsert = toTradeInsert(args.mirrored, {
    ...DEFAULT_CONTEXT,
    ...args.context,
    tradeReference: reference,
    contractDate,
  });
  const trade = await tradeService.create(tradeInsert);

  let uploaded;
  try {
    uploaded = await storageService.uploadGeneratedContract(args.bytes, args.fileName);
  } catch (e) {
    // Roll back the trade row so a failed upload leaves nothing behind.
    await tradeService.remove(trade.id).catch(() => {});
    throw e;
  }

  try {
    const document = await documentService.create({
      trade_id: trade.id,
      document_type: "sales_contract" as const,
      file_name: args.fileName,
      storage_path: uploaded.path,
      uploaded_by: session.user.id,
    });

    return {
      tradeId: trade.id,
      documentId: document.id,
      storagePath: uploaded.path,
      tradeReference: reference,
    };
  } catch (e) {
    // Roll back the storage object and the trade row (reverse order).
    await storageService.remove(uploaded.path).catch(() => {});
    await tradeService.remove(trade.id).catch(() => {});
    throw e;
  }
}
