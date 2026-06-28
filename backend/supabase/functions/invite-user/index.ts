// Supabase Edge Function: invite-user
//
// Creates (or refreshes) an invitation record and emails a secure, single-use
// invite link via Brevo. The account itself is NOT created here — it's created
// when the invitee accepts and sets a password (see the accept-invitation
// function). This keeps account creation decoupled from email delivery: a mailer
// problem can never leave a half-created account.
//
// Flow: authorize caller (active super_admin) → validate input → reject if the
// email already belongs to a member → generate a 256-bit token, store only its
// SHA-256 hash with a 72h expiry → email the link via Brevo. Email is
// best-effort; when it's disabled or fails, the response returns the invite link
// so an admin can deliver it manually.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//          BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, APP_URL.
// Deploy:  supabase functions deploy invite-user

import { preflight, json } from "../_shared/cors.ts";
import { getAdminClient, getAppBaseUrl } from "../_shared/supabaseAdmin.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import {
  isBrevoConfigured,
  sendBrevoEmail,
  inviteEmailTemplate,
} from "../_shared/brevo.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const ROLES = ["super_admin", "internal", "partner"] as const;
type Role = (typeof ROLES)[number];
const EXPIRES_HOURS = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteBody {
  full_name?: string;
  email?: string;
  role?: string;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const admin = getAdminClient();

    // 1. Authorize: the caller must be an active super_admin.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing authorization." }, 401);
    const { data: caller } = await admin.auth.getUser(jwt);
    if (!caller?.user) return json({ error: "Invalid session." }, 401);
    const { data: profile } = await admin
      .from("users")
      .select("role, is_active")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (!profile || profile.role !== "super_admin" || !profile.is_active) {
      return json({ error: "Only an active Super Admin can invite users." }, 403);
    }

    // 2. Validate input.
    const body = (await req.json().catch(() => ({}))) as InviteBody;
    const fullName = body.full_name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const role = body.role as Role;
    if (!fullName) return json({ error: "A full name is required." }, 400);
    if (!email || !EMAIL_RE.test(email)) {
      return json({ error: "A valid email address is required." }, 400);
    }
    if (!ROLES.includes(role)) {
      return json({ error: "Pick a valid role." }, 400);
    }

    // 3. Reject if this email already belongs to a platform member. Manage
    //    existing accounts from the Users page instead of re-inviting them.
    // Exact match on the normalized (lowercased) email — never ilike, whose
    // `_`/`%` wildcards are valid email characters and would mis-match.
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingUser) {
      return json(
        { error: "A user with this email already exists. Manage them from the Users list." },
        409,
      );
    }

    // 4. Generate the token and upsert the invitation. Re-inviting the same email
    //    refreshes the pending row (new token + expiry) rather than stacking
    //    duplicates — this is how "resend" works.
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 3_600_000).toISOString();

    const { data: pending } = await admin
      .from("invitations")
      .select("id")
      .eq("email", email)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = {
      email,
      full_name: fullName,
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      accepted_at: null,
      invited_by: caller.user.id,
    };

    if (pending) {
      const { error: updErr } = await admin
        .from("invitations")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", pending.id);
      if (updErr) return json({ error: updErr.message }, 400);
    } else {
      const { error: insErr } = await admin.from("invitations").insert(row);
      if (insErr) return json({ error: insErr.message }, 400);
    }

    // 5. Email the invite link (best-effort). The invitation already exists, so
    //    a mail failure never fails the request — return the link for manual
    //    delivery instead.
    const base = getAppBaseUrl(req);
    const acceptUrl = `${base}/accept-invite?token=${rawToken}`;
    let emailWarning: string | null = null;

    if (!isBrevoConfigured()) {
      emailWarning =
        "Invitation saved, but email delivery isn't configured. Set BREVO_API_KEY " +
        "and BREVO_SENDER_EMAIL to send it automatically, or share the link below.";
    } else {
      try {
        await sendBrevoEmail(
          email,
          fullName,
          inviteEmailTemplate({ fullName, acceptUrl, expiresHours: EXPIRES_HOURS }),
        );
      } catch (e) {
        emailWarning = `Invitation saved, but the email couldn't be sent: ${
          e instanceof Error ? e.message : "unknown error"
        }. Share the link below instead.`;
      }
    }

    const emailSent = emailWarning === null;
    return json(
      {
        ok: true,
        emailSent,
        emailWarning,
        inviteLink: emailSent ? null : acceptUrl,
        expiresAt,
      },
      200,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
