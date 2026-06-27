import type { Session } from "@supabase/supabase-js";
import { supabase, unwrapMaybe, type UserRow } from "@/services/supabase";
import type { AuthRepository } from "@/services/repository/contracts";

/**
 * Authentication data access. Wraps Supabase Auth and the `users` profile
 * table. No business rules here — role enforcement is RLS + route guards.
 */
export const authService: AuthRepository = {
  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(userId: string): Promise<UserRow | null> {
    return unwrapMaybe(
      await supabase.from("users").select("*").eq("id", userId).maybeSingle(),
    );
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => subscription.unsubscribe();
  },
};
