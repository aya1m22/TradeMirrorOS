import { supabase, unwrap, unwrapList, type UserRow, type UserRole } from "@/services/supabase";

/**
 * User management (PRD §2.4) — SuperAdmin only (enforced by RLS on `users`).
 *
 * Reads and role/status updates run client-side under RLS. Inviting a new user
 * creates a Supabase Auth account + sends an invite email, which requires the
 * service-role key and Resend — that privileged work lives in the `invite-user`
 * Edge Function (see backend/supabase/functions/invite-user). The browser only
 * invokes it; no secrets are shipped to the client.
 */
export const userService = {
  async list(): Promise<UserRow[]> {
    return unwrapList(
      await supabase.from("users").select("*").order("full_name", { ascending: true }),
    );
  },

  async updateRole(id: string, role: UserRole): Promise<UserRow> {
    return unwrap(await supabase.from("users").update({ role }).eq("id", id).select("*").single());
  },

  async setActive(id: string, is_active: boolean): Promise<UserRow> {
    return unwrap(
      await supabase.from("users").update({ is_active }).eq("id", id).select("*").single(),
    );
  },

  /** Invite a new user (delegates to the privileged Edge Function). */
  async invite(input: { full_name: string; email: string; role: UserRole }): Promise<void> {
    const { error } = await supabase.functions.invoke("invite-user", { body: input });
    if (error) throw error;
  },
};
