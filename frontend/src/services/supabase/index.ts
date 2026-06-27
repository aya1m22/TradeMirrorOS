import type { Database } from "./types.generated";

export { supabase } from "./client";
export { SupabaseError, unwrap, unwrapMaybe, unwrapList } from "./result";
export type {
  Database,
  Json,
  UserRole,
  TradeStatus,
  MilestoneStatus,
  DocumentType,
} from "./types.generated";

// ── Convenience aliases over the generated schema ────────────────────────
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type Insertable<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type Updatable<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

// Row aliases used across the service + feature layers.
export type UserRow = Tables<"users">;
export type EntityRow = Tables<"entities">;
export type BankProfileRow = Tables<"bank_profiles">;
export type ClientRow = Tables<"clients">;
export type ContactRow = Tables<"contacts">;
export type TradeRow = Tables<"trades">;
export type DocumentRow = Tables<"documents">;
