import {
  supabase,
  unwrap,
  unwrapList,
  type Database,
  type UserRow,
  type UserRole,
} from "@/services/supabase";
import { parseFunctionError, isFunctionNetworkError } from "@/services/supabase/functionError";

/** A row of the Super-Admin-only pending-invitations view. */
export type PendingInvitation = Database["public"]["Views"]["v_pending_invitations"]["Row"];

/** Outcome of sending an invitation. */
export interface InviteResult {
  /** True when the invite email was delivered via Brevo. */
  emailSent: boolean;
  /** Set when the invitation was saved but the email didn't go out. */
  emailWarning: string | null;
  /** The accept-invite link, returned for manual delivery when no email was sent. */
  inviteLink: string | null;
}

/**
 * User management (PRD §2.4) — SuperAdmin only (enforced by RLS on `users`).
 *
 * Reads and role/status updates run client-side under RLS. Inviting creates a
 * secure invitation record and emails the link — privileged work that needs the
 * service-role key, so it lives in the `invite-user` Edge Function. The browser
 * only invokes it; no secrets are shipped to the client. The account itself is
 * created later, when the invitee accepts and sets a password.
 */
export const userService = {
  async list(): Promise<UserRow[]> {
    return unwrapList(
      await supabase.from("users").select("*").order("full_name", { ascending: true }),
    );
  },

  /** Unaccepted invitations awaiting the invitee (most recent first). */
  async pendingInvitations(): Promise<PendingInvitation[]> {
    const res = await supabase
      .from("v_pending_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    // The view ships in migration 20260628130000. Until it's applied to an
    // environment, degrade to an empty list rather than erroring the Users page.
    if (
      res.error &&
      (res.error.code === "PGRST205" || /v_pending_invitations/.test(res.error.message ?? ""))
    ) {
      return [];
    }
    return unwrapList(res);
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
    // Attach the caller's access token explicitly. supabase-js `functions.invoke`
    // can otherwise fall back to the anon key, which invite-user rejects with
    // "Invalid session" (it authorizes the caller as a Super Admin). getSession()
    // returns a fresh token, refreshing it first if it had expired.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Your session has expired. Please sign in again and retry.");
    }
    const { data, error } = await supabase.functions.invoke<{
      emailSent?: boolean;
      emailWarning?: string | null;
      inviteLink?: string | null;
    }>("invite-user", {
      body: input,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      if (isFunctionNetworkError(error)) {
        throw new Error(
          "Couldn't reach the invite-user Edge Function. Confirm it's deployed and reachable.",
        );
      }
      const { message } = await parseFunctionError(error);
      throw new Error(message ?? error.message);
    }
    return {
      emailSent: data?.emailSent ?? false,
      emailWarning: data?.emailWarning ?? null,
      inviteLink: data?.inviteLink ?? null,
    };
  },
};
