// Supabase Edge Function: accept-invitation  (PUBLIC — verify_jwt = false)
//
// Token-authenticated: the invite token IS the credential. Two actions:
//   action:"verify" → validate the token (not used / not expired) and return the
//                     invitee's email + name so the page can render. Read-only.
//   action:"accept" → create (or recover) the auth account with the chosen
//                     password, write the users profile row with the assigned
//                     role, and mark the invitation accepted. Returns the email
//                     so the browser can sign in immediately.
//
// Credentials/sessions stay in Supabase Auth — we never hash passwords here.
// Idempotent on accept: a re-run resolves the existing auth user and re-applies,
// so a partial failure can be safely retried.

import { preflight, json } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { hashToken } from "../_shared/tokens.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt input limit enforced by GoTrue.

interface Body {
  action?: "verify" | "accept";
  token?: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const admin = getAdminClient();
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action === "accept" ? "accept" : "verify";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "Missing invitation token.", code: "invalid" }, 400);

    // Look up by hash — the raw token is never stored.
    const tokenHash = await hashToken(token);
    const { data: invite, error: lookupErr } = await admin
      .from("invitations")
      .select("id, email, full_name, role, expires_at, accepted_at, created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (lookupErr) return json({ error: lookupErr.message }, 500);

    if (!invite) {
      return json({ error: "This invitation link is invalid.", code: "invalid" }, 404);
    }
    if (invite.accepted_at) {
      return json(
        { error: "This invitation has already been used. Try signing in.", code: "used" },
        409,
      );
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json(
        { error: "This invitation has expired. Ask an admin to send a new one.", code: "expired" },
        410,
      );
    }

    // ── verify ──────────────────────────────────────────────────────────────
    if (action === "verify") {
      return json({
        ok: true,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
      });
    }

    // ── accept ──────────────────────────────────────────────────────────────
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return json(
        { error: `Choose a password between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`, code: "weak_password" },
        400,
      );
    }

    // Resolve the auth user: create if absent, otherwise update (idempotent).
    const { data: existingId } = await admin.rpc("auth_user_id_by_email", {
      p_email: invite.email,
    });

    let userId: string | null = existingId ?? null;
    if (userId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name },
      });
      if (updErr) return json({ error: updErr.message }, 400);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name },
      });
      if (createErr || !created?.user) {
        // Lost a race (user created meanwhile) — recover and update.
        const { data: raceId } = await admin.rpc("auth_user_id_by_email", {
          p_email: invite.email,
        });
        if (!raceId) {
          return json({ error: createErr?.message ?? "Couldn't create the account." }, 400);
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(raceId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: invite.full_name },
        });
        if (updErr) return json({ error: updErr.message }, 400);
        userId = raceId;
      } else {
        userId = created.user.id;
      }
    }

    // Write the profile row with the assigned role (source of truth for the app).
    const nowIso = new Date().toISOString();
    const { error: profErr } = await admin.from("users").upsert(
      {
        id: userId,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        is_active: true,
        invited_at: invite.created_at,
        last_login_at: nowIso,
      },
      { onConflict: "id" },
    );
    if (profErr) return json({ error: profErr.message }, 400);

    // Mark accepted last so any earlier failure leaves the invite retryable.
    const { error: acceptErr } = await admin
      .from("invitations")
      .update({ accepted_at: nowIso })
      .eq("id", invite.id);
    if (acceptErr) return json({ error: acceptErr.message }, 400);

    return json({ ok: true, email: invite.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
