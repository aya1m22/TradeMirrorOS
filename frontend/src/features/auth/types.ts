import type { Session } from "@supabase/supabase-js";
import type { UserRow, UserRole } from "@/services/supabase";

/** The signed-in user: their auth session plus their `users` profile row. */
export type AppUser = UserRow;

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** Profile row for the signed-in user, or null when signed out / unloaded. */
  user: AppUser | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
