// Supabase Edge Function: reset-password  (PUBLIC — verify_jwt = false)
//
// Step 2 of forgot-password. Token-authenticated. Two actions:
//   action:"verify" → validate the token (not used / not expired); returns the
//                     account email so the page can render. Read-only.
//   action:"reset"  → set the new password via the Admin API, mark the token
//                     used, and invalidate any other outstanding reset tokens for
//                     the user. Returns the email so the browser can sign in.
//
// Single-use is enforced by used_at; replay is impossible once consumed.

import { preflight, json } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { hashToken } from "../_shared/tokens.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

interface Body {
  action?: "verify" | "reset";
  token?: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const admin = getAdminClient();
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action === "reset" ? "reset" : "verify";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "Missing reset token.", code: "invalid" }, 400);

    const tokenHash = await hashToken(token);
    const { data: reset, error: lookupErr } = await admin
      .from("password_resets")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (lookupErr) return json({ error: lookupErr.message }, 500);

    if (!reset) {
      return json({ error: "This reset link is invalid.", code: "invalid" }, 404);
    }
    if (reset.used_at) {
      return json(
        { error: "This reset link has already been used. Request a new one.", code: "used" },
        409,
      );
    }
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return json(
        { error: "This reset link has expired. Request a new one.", code: "expired" },
        410,
      );
    }

    // Resolve the account email (for the page / subsequent sign-in).
    const { data: user } = await admin
      .from("users")
      .select("email")
      .eq("id", reset.user_id)
      .maybeSingle();
    if (!user) {
      return json({ error: "The account for this link no longer exists.", code: "invalid" }, 404);
    }

    // ── verify ──────────────────────────────────────────────────────────────
    if (action === "verify") {
      return json({ ok: true, email: user.email });
    }

    // ── reset ───────────────────────────────────────────────────────────────
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return json(
        { error: `Choose a password between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`, code: "weak_password" },
        400,
      );
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(reset.user_id, {
      password,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    // Consume this token and invalidate every other outstanding token for the
    // user — only the just-used reset should ever have been valid.
    const nowIso = new Date().toISOString();
    const { error: usedErr } = await admin
      .from("password_resets")
      .update({ used_at: nowIso })
      .eq("user_id", reset.user_id)
      .is("used_at", null);
    if (usedErr) {
      // Password already changed; log but don't fail the user's reset.
      console.error("[reset-password] failed to mark token used:", usedErr.message);
    }

    return json({ ok: true, email: user.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
