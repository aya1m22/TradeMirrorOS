// Supabase Edge Function: request-password-reset  (PUBLIC — verify_jwt = false)
//
// Step 1 of forgot-password. Accepts { email } and ALWAYS responds { ok: true }
// regardless of whether the address exists — this prevents account enumeration.
// When the email maps to an active account and the per-user rate limit hasn't
// been hit, it mints a single-use, 60-minute token (only the hash is stored) and
// emails the reset link via Brevo.
//
// Rate limiting: at most MAX_PER_WINDOW requests per account per WINDOW_MIN
// minutes; extra requests are silently ignored (still a 200) to blunt spam.

import { preflight, json } from "../_shared/cors.ts";
import { getAdminClient, getAppBaseUrl } from "../_shared/supabaseAdmin.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import { isBrevoConfigured, sendBrevoEmail, resetEmailTemplate } from "../_shared/brevo.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRES_MIN = 60;
const WINDOW_MIN = 15;
const MAX_PER_WINDOW = 3;

// A generic success body — identical whether or not anything was sent.
const GENERIC_OK = { ok: true } as const;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const admin = getAdminClient();
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? "";

    // Invalid input → look identical to "no such user".
    if (!email || !EMAIL_RE.test(email)) return json(GENERIC_OK);

    // Resolve the account (exact match on the normalized email; never ilike,
    // whose `_`/`%` wildcards are valid email characters). Inactive/absent →
    // respond ok without sending.
    const { data: user } = await admin
      .from("users")
      .select("id, email, full_name, is_active")
      .eq("email", email)
      .maybeSingle();
    if (!user || !user.is_active) return json(GENERIC_OK);

    // Per-user rate limit.
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { count } = await admin
      .from("password_resets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_WINDOW) return json(GENERIC_OK);

    // Mint + store the token (hash only).
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EXPIRES_MIN * 60_000).toISOString();
    const { error: insErr } = await admin.from("password_resets").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insErr) {
      // Don't leak internals to the client; log for ops and still respond ok.
      console.error("[request-password-reset] insert failed:", insErr.message);
      return json(GENERIC_OK);
    }

    // Email best-effort. Failures are logged, never surfaced (no enumeration).
    if (isBrevoConfigured()) {
      const base = getAppBaseUrl(req);
      const resetUrl = `${base}/reset-password?token=${rawToken}`;
      try {
        await sendBrevoEmail(
          user.email,
          user.full_name,
          resetEmailTemplate({ fullName: user.full_name, resetUrl, expiresMinutes: EXPIRES_MIN }),
        );
      } catch (e) {
        console.error(
          "[request-password-reset] email send failed:",
          e instanceof Error ? e.message : e,
        );
      }
    } else {
      console.warn("[request-password-reset] Brevo not configured — reset email skipped.");
    }

    return json(GENERIC_OK);
  } catch (e) {
    // Even on an unexpected error, avoid leaking; log and respond generically.
    console.error("[request-password-reset] unexpected error:", e);
    return json(GENERIC_OK);
  }
});
