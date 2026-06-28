import { supabase, type UserRole } from "@/services/supabase";
import { parseFunctionError, isFunctionNetworkError } from "@/services/supabase/functionError";

/**
 * Account setup over the public Edge Functions: accepting an invitation and the
 * forgot-password flow. These run while the user is signed out, so they call
 * token-authenticated functions (accept-invitation, request-password-reset,
 * reset-password) rather than touching the database directly.
 *
 * Errors are normalized to AccountActionError with a machine `code` so pages can
 * branch on "expired" / "used" / "invalid" without string-matching.
 */

export type AccountErrorCode =
  | "invalid"
  | "expired"
  | "used"
  | "weak_password"
  | "network"
  | "error";

export class AccountActionError extends Error {
  readonly code: AccountErrorCode;
  constructor(message: string, code: AccountErrorCode) {
    super(message);
    this.name = "AccountActionError";
    this.code = code;
  }
}

export interface InvitationDetails {
  email: string;
  full_name: string;
  role: UserRole;
}

/** Invoke a public function, normalizing failures to AccountActionError. */
async function invokeOrThrow<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (isFunctionNetworkError(error)) {
      throw new AccountActionError(
        "Couldn't reach the server. Check your connection and try again.",
        "network",
      );
    }
    const { message, code } = await parseFunctionError(error);
    throw new AccountActionError(
      message ?? "Something went wrong. Please try again.",
      (code as AccountErrorCode) ?? "error",
    );
  }
  return data as T;
}

export const accountService = {
  /** Validate an invitation token and fetch who it's for (read-only). */
  async verifyInvitation(token: string): Promise<InvitationDetails> {
    return invokeOrThrow<InvitationDetails>("accept-invitation", {
      action: "verify",
      token,
    });
  },

  /** Accept an invitation: set the password + activate the account. */
  async acceptInvitation(token: string, password: string): Promise<{ email: string }> {
    return invokeOrThrow<{ email: string }>("accept-invitation", {
      action: "accept",
      token,
      password,
    });
  },

  /**
   * Request a password-reset email. Resolves on success regardless of whether
   * the address exists (the function never reveals that) — only a network/server
   * failure rejects.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await invokeOrThrow<{ ok: boolean }>("request-password-reset", { email });
  },

  /** Validate a reset token and fetch the account email (read-only). */
  async verifyResetToken(token: string): Promise<{ email: string }> {
    return invokeOrThrow<{ email: string }>("reset-password", {
      action: "verify",
      token,
    });
  },

  /** Set a new password using a valid reset token. */
  async confirmPasswordReset(token: string, password: string): Promise<{ email: string }> {
    return invokeOrThrow<{ email: string }>("reset-password", {
      action: "reset",
      token,
      password,
    });
  },
};
