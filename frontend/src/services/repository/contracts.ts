/**
 * Repository interfaces — the abstraction every data service implements.
 *
 * Services depend on these contracts, not on Supabase directly, so a mock
 * implementation (driven by VITE_USE_MOCKS) can be swapped in for offline
 * development of the editor and PDF engine without touching callers.
 */
import type { Session } from "@supabase/supabase-js";
import type {
  ClientRow,
  DocumentRow,
  TradeRow,
  UserRow,
  Insertable,
  Updatable,
} from "@/services/supabase";

/** Read side of a table-backed repository. */
export interface ReadRepository<Row> {
  list(): Promise<Row[]>;
  getById(id: string): Promise<Row | null>;
}

/** Write side of a table-backed repository. */
export interface WriteRepository<Row, Insert, Update> {
  create(input: Insert): Promise<Row>;
  update(id: string, patch: Update): Promise<Row>;
  remove(id: string): Promise<void>;
}

/** Standard create/read/update/delete repository. */
export interface CrudRepository<Row, Insert, Update>
  extends ReadRepository<Row>,
    WriteRepository<Row, Insert, Update> {}

// ── Domain-specific repositories ─────────────────────────────────────────

export interface ClientRepository
  extends CrudRepository<ClientRow, Insertable<"clients">, Updatable<"clients">> {}

export interface TradeRepository
  extends CrudRepository<TradeRow, Insertable<"trades">, Updatable<"trades">> {
  /** Trades carry a human reference (e.g. "CF-2026-001"); look one up by it. */
  getByReference(reference: string): Promise<TradeRow | null>;
}

export interface DocumentRepository {
  listByTrade(tradeId: string): Promise<DocumentRow[]>;
  create(input: Insertable<"documents">): Promise<DocumentRow>;
  remove(id: string): Promise<void>;
  /** Time-limited signed URL for downloading a stored document. */
  getSignedUrl(storagePath: string, expiresInSeconds?: number): Promise<string>;
}

export interface AuthRepository {
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  /** The authenticated user's profile row (carries the role). */
  getProfile(userId: string): Promise<UserRow | null>;
  resetPassword(email: string): Promise<void>;
  /** Subscribe to auth changes; returns an unsubscribe function. */
  onAuthStateChange(callback: (session: Session | null) => void): () => void;
}
