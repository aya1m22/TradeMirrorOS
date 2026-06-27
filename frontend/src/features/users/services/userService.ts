import { supabase, unwrap, unwrapList, type UserRow, type UserRole } from "@/services/supabase";

/** Outcome of an invite. The account may be created even when the email warns. */
export interface InviteResult {
  /** True once the account exists (the source of truth for success). */
  userCreated: boolean;
  /** Non-null when the account was created but the invite email didn't go out. */
  emailWarning: string | null;
  /** The invite link, returned for manual delivery when no email was sent. */
  inviteLink: string | null;
}

/**
 * supabase-js wraps a non-2xx Edge Function response in a FunctionsHttpError
 * whose `context` is the raw Response — the default `error.message` is just the
 * opaque "Edge Function returned a non-2xx status code". The function returns its
 * real reason as JSON `{ error }`, so read that and surface it instead.
 */
async function readEdgeFunctionError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const data = await ctx.clone().json();
      if (data && typeof data.error === "string") return data.error;
    } catch {
      // Response wasn't JSON — fall back to the generic message.
    }
  }
  return null;
}

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
  async invite(input: { full_name: string; email: string; role: UserRole }): Promise<InviteResult> {
    const { data, error } = await supabase.functions.invoke<{
      userCreated?: boolean;
      emailWarning?: string | null;
      inviteLink?: string | null;
    }>("invite-user", { body: input });
    if (error) {
      const detail = await readEdgeFunctionError(error);
      throw new Error(detail ?? error.message);
    }
    return {
      userCreated: data?.userCreated ?? true,
      emailWarning: data?.emailWarning ?? null,
      inviteLink: data?.inviteLink ?? null,
    };
  },
};
