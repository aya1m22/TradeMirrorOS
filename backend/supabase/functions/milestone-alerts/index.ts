// Supabase Edge Function: milestone-alerts (PRD §11)
//
// Scheduled (daily) check for overdue payment milestones:
//   - Advance overdue: advance_status != 'received' and signing_date + 7d < today
//   - Balance overdue: balance_status != 'received' and bol_date + 7d < today
// Flips the milestone (+ trade) to 'overdue', and emails the SuperAdmin via
// Resend. Fires once at T+7 then daily until marked received.
//
// ── Secrets (set via `supabase secrets set ...`) ────────────────────────────
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   - auto-injected in the Edge runtime
//   RESEND_API_KEY                            - TODO(secret): Resend API key
//   ALERT_FROM_EMAIL                          - e.g. alerts@chipafarm.com (verified domain)
//   ALERT_TO_EMAIL                            - TODO(secret): SuperAdmin recipient
//
// ── Scheduling ──────────────────────────────────────────────────────────────
//   Deploy:   supabase functions deploy milestone-alerts
//   Schedule: create a daily cron (Supabase Dashboard → Edge Functions → Schedules,
//             or pg_cron calling the function URL). Example cron: "0 8 * * *".
//
// NOTE: Deno Edge runtime; intentionally outside the frontend TS project.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const DAYS = 7;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKeyRaw = Deno.env.get("RESEND_API_KEY");
  const resendKey = resendKeyRaw && resendKeyRaw !== "your_resend_api_key_here" ? resendKeyRaw : null;
  const from = Deno.env.get("ALERT_FROM_EMAIL") ?? "alerts@chipafarm.com";
  const to = Deno.env.get("ALERT_TO_EMAIL"); // SuperAdmin recipient

  if (!url || !serviceKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Pull trades that could be overdue (not both milestones received).
  const { data: trades, error } = await admin
    .from("trades")
    .select(
      "id, trade_reference, signing_date, bol_date, advance_status, balance_status, trade_status, clients(company_name)",
    )
    .neq("balance_status", "received");
  if (error) return json({ error: error.message }, 500);

  const alerts: { ref: string; client: string; kind: "Advance" | "Balance"; daysOverdue: number; id: string }[] = [];

  for (const t of trades ?? []) {
    const client = Array.isArray(t.clients) ? t.clients[0]?.company_name : t.clients?.company_name;
    const advAge = daysSince(t.signing_date);
    if (t.advance_status !== "received" && advAge !== null && advAge >= DAYS) {
      alerts.push({ ref: t.trade_reference, client: client ?? "—", kind: "Advance", daysOverdue: advAge - DAYS, id: t.id });
      await admin.from("trades").update({ advance_status: "overdue", trade_status: "overdue" }).eq("id", t.id);
    }
    const balAge = daysSince(t.bol_date);
    if (t.balance_status !== "received" && balAge !== null && balAge >= DAYS) {
      alerts.push({ ref: t.trade_reference, client: client ?? "—", kind: "Balance", daysOverdue: balAge - DAYS, id: t.id });
      await admin.from("trades").update({ balance_status: "overdue", trade_status: "overdue" }).eq("id", t.id);
    }
  }

  // Email each alert to the SuperAdmin via Resend (PRD §11.3). A failure on one
  // email never aborts the others (or the function) — collect and report them.
  let emailed = 0;
  const emailErrors: string[] = [];
  const emailSkipped = !resendKey || !to;
  if (!emailSkipped) {
    for (const a of alerts) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to,
            subject: `TradeMirror Alert: ${a.client} — ${a.kind} Overdue`,
            text:
              `Trade ${a.ref} — ${a.client}\n${a.kind} payment is ${a.daysOverdue} day(s) past the ${DAYS}-day deadline.\n` +
              `Open the trade folder to review.`,
          }),
        });
        if (res.ok) emailed++;
        else emailErrors.push(`${a.ref}: HTTP ${res.status} ${await res.text()}`);
      } catch (e) {
        emailErrors.push(`${a.ref}: ${e instanceof Error ? e.message : "network error"}`);
      }
    }
  }
  // When RESEND_API_KEY / ALERT_TO_EMAIL are unset, alerts are still flipped to
  // "overdue" (surfaced in-app); emails resume once the secrets are set.

  return json({ ok: true, overdue: alerts.length, emailed, emailSkipped, emailErrors }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
