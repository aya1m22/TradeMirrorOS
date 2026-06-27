// Supabase Edge Function: invite-user (PRD §2.2, §2.4)
//
// Creates a platform user account and emails an invitation to set a password.
// Runs server-side because it needs the service-role key (privileged auth admin)
// — it must NEVER run in the browser.
//
// Email delivery:
//   - If RESEND_API_KEY is set, a branded invite is sent directly via Resend from
//     the @chipafarm.com domain (uses an admin-generated invite link).
//   - Otherwise it falls back to Supabase Auth's built-in invite mailer
//     (configure Supabase Auth SMTP → Resend in the dashboard for delivery).
//
// ── Secrets (set via `supabase secrets set ...` or backend/.env for local) ──
//   SUPABASE_URL                 - project URL (auto-provided in the Edge runtime)
//   SUPABASE_SERVICE_ROLE_KEY    - service role key (auto-provided in the Edge runtime)
//   RESEND_API_KEY               - Resend API key (https://resend.com)
//   INVITE_FROM_EMAIL            - optional; defaults to no-reply@chipafarm.com
//   APP_URL                      - optional; invite redirect (set-password landing)
//
// Deploy:  supabase functions deploy invite-user
// Secrets: supabase secrets set RESEND_API_KEY=...   (SUPABASE_* are auto-injected)
//
// NOTE: Targets the Deno Edge runtime; intentionally outside the frontend TS project.

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

const PLACEHOLDER = "your_resend_api_key_here";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return json({ error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY." }, 500);
    }

    const resendKeyRaw = Deno.env.get("RESEND_API_KEY");
    const resendKey = resendKeyRaw && resendKeyRaw !== PLACEHOLDER ? resendKeyRaw : null;
    const inviteFrom = Deno.env.get("INVITE_FROM_EMAIL") ?? "TradeMirror OS <no-reply@chipafarm.com>";
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

    // 2. Validate input.
    const body = (await req.json()) as InviteBody;
    const email = body?.email?.trim();
    const fullName = body?.full_name?.trim();
    if (!fullName || !email || !body?.role) {
      return json({ error: "full_name, email and role are required." }, 400);
    }

    // 3. Create the auth user. With Resend, generate the invite link (no Supabase
    //    email); otherwise let Supabase send the invite via its configured SMTP.
    let userId: string;
    let actionLink: string | undefined;
    if (resendKey) {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: { full_name: fullName }, ...(redirectTo ? { redirectTo } : {}) },
      });
      if (linkErr || !link?.user) return json({ error: linkErr?.message ?? "Couldn't create the user." }, 400);
      userId = link.user.id;
      actionLink = link.properties?.action_link;
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });
      if (inviteErr || !invited?.user) return json({ error: inviteErr?.message ?? "Couldn't create the user." }, 400);
      userId = invited.user.id;
    }

    // 4. Upsert the matching profile row with the assigned role.
    const { error: profErr } = await admin.from("users").upsert(
      { id: userId, email, full_name: fullName, role: body.role, is_active: true, invited_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (profErr) return json({ error: profErr.message }, 400);

    // 5. Send the branded invite via Resend when configured.
    if (resendKey && actionLink) {
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
          return json({ error: `User created, but the invite email failed to send: ${await res.text()}` }, 502);
        }
      } catch (e) {
        return json({ error: `User created, but the invite email failed: ${e instanceof Error ? e.message : "network error"}` }, 502);
      }
    }

    return json({ ok: true, userId, emailVia: resendKey ? "resend" : "supabase" }, 200);
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
