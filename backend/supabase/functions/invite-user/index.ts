// Supabase Edge Function: invite-user (PRD §2.2, §2.4)
//
// Creates a platform user account and (best-effort) emails an invitation to set a
// password. Runs server-side because it needs the service-role key (privileged
// auth admin) — it must NEVER run in the browser.
//
// Design: account creation is DECOUPLED from email. The user is created with
// generateLink (no mail-transport dependency) and the profile row is always
// upserted, so a missing/failing mailer can never fail the request or leave a
// half-created account. Email is best-effort and OPT-IN; when it's off or fails,
// the response returns the invite link so an admin can deliver it manually. The
// request returns 200 with { ok, userCreated, emailSent, emailWarning, inviteLink }.
//
// ── Secrets (set via `supabase secrets set ...`) ────────────────────────────
//   SUPABASE_URL                 - project URL (auto-provided in the Edge runtime)
//   SUPABASE_SERVICE_ROLE_KEY    - service role key (auto-provided in the Edge runtime)
//   RESEND_API_KEY               - Resend API key. Custom invite email is sent only
//                                  when BOTH this and INVITE_FROM_EMAIL are set.
//   INVITE_FROM_EMAIL            - verified Resend sender, e.g.
//                                  "TradeMirror OS <no-reply@yourdomain.com>". No
//                                  default — leave unset in dev to skip email and
//                                  return the invite link instead.
//   APP_URL                      - optional invite redirect (set-password landing).
//
// Deploy:  supabase functions deploy invite-user
// Secrets: supabase secrets set RESEND_API_KEY=...   (SUPABASE_* are auto-injected)
//
// NOTE: This file targets the Deno Edge runtime; it is intentionally outside the
// frontend TypeScript project (not type-checked by the app build).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "super_admin" | "internal" | "partner";
interface InviteBody {
  full_name: string;
  email: string;
  role: Role;
}

// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      // TODO(secret): SUPABASE_SERVICE_ROLE_KEY missing — set it before use.
      return json({ error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY." }, 500);
    }

    const resendKeyRaw = Deno.env.get("RESEND_API_KEY");
    const resendKey = resendKeyRaw && resendKeyRaw !== "your_resend_api_key_here" ? resendKeyRaw : null;
    // No hardcoded default From address. Custom email is sent ONLY when BOTH a
    // Resend key AND an explicit (verified) From address are configured. This
    // removes any hard dependency on a domain nobody owns in dev (e.g.
    // chipafarm.com): with no INVITE_FROM_EMAIL set, email is simply skipped and
    // the invite link is returned for manual delivery. Configure both in
    // production to turn real delivery on.
    const inviteFrom = Deno.env.get("INVITE_FROM_EMAIL")?.trim() || null;
    const emailEnabled = Boolean(resendKey && inviteFrom);
    const redirectTo = Deno.env.get("APP_URL") ?? undefined;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing authorization." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Authorize: the caller must be an active super_admin.
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
    console.log("step1 auth passed", { callerId: caller.user.id });

    // 2. Validate input.
    const body = (await req.json()) as InviteBody;
    const email = body?.email?.trim();
    const fullName = body?.full_name?.trim();
    if (!fullName || !email || !body?.role) {
      return json({ error: "full_name, email and role are required." }, 400);
    }
    console.log("step2 validation passed", { email, role: body.role });

    // 3. Create the auth user. We use generateLink (not inviteUserByEmail) to
    //    DECOUPLE account creation from email delivery: generateLink creates the
    //    user and returns an invite link without depending on the mail transport,
    //    so a mailer problem can never leave the account half-created nor fail the
    //    whole request after the user already exists. That coupling is exactly
    //    what produced the "false failure" — the user was created but the response
    //    came back non-2xx because the email step failed.
    const { data: link, error: inviteErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName }, ...(redirectTo ? { redirectTo } : {}) },
    });
    console.log("step3 invite result", inviteErr);
    if (inviteErr || !link?.user) {
      return json({ error: inviteErr?.message ?? "Couldn't create the user." }, 400);
    }
    const userId = link.user.id;
    const actionLink = link.properties?.action_link;

    // 4. Upsert the matching profile row with the assigned role. This always runs
    //    once the account exists, so the new user shows up in the list with the
    //    correct role regardless of whether the email is delivered.
    const { error: profErr } = await admin.from("users").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: body.role,
        is_active: true,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    console.log("step4 profile result", profErr);
    if (profErr) return json({ error: profErr.message }, 400);

    // 5. Best-effort email of the branded invitation via Resend. Email delivery is
    //    NEVER allowed to fail the request — the account already exists (step 4).
    //    When custom email is disabled (dev) or fails, the response carries the
    //    invite link so an admin can deliver it manually.
    let emailWarning: string | null = null;
    if (!emailEnabled) {
      emailWarning =
        "Invite email was not sent: custom email delivery is disabled in this environment. " +
        "Set RESEND_API_KEY and a verified INVITE_FROM_EMAIL to enable it. " +
        "Share the invite link with the user instead.";
    } else if (!actionLink) {
      emailWarning = "The account was created, but no invite link was generated, so no email was sent.";
    } else {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: inviteFrom,
            to: email,
            subject: "You're invited to TradeMirror OS",
            html:
              `<p>Hi ${escapeHtml(fullName)},</p>` +
              `<p>You've been invited to TradeMirror OS. Set your password and sign in:</p>` +
              `<p><a href="${actionLink}">Accept your invitation</a></p>`,
          }),
        });
        if (!res.ok) {
          emailWarning = `Invite email could not be sent (Resend ${res.status}): ${await res.text()}`;
        }
      } catch (e) {
        emailWarning = `Invite email could not be sent: ${e instanceof Error ? e.message : "network error"}`;
      }
    }
    console.log("step5 email result", emailWarning);

    // The account is the source of truth for success. Email is best-effort; when it
    // didn't go out we return the invite link so it can be delivered manually.
    const emailSent = emailWarning === null;
    console.log("success", { userId, userCreated: true, emailSent });
    return json(
      {
        ok: true,
        userCreated: true,
        userId,
        emailSent,
        emailWarning,
        inviteLink: emailSent ? null : actionLink ?? null,
      },
      200,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Escape user-supplied text before interpolating it into the invite email HTML. */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
