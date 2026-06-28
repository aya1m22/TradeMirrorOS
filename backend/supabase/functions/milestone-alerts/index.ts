// Supabase Edge Function: milestone-alerts (PRD §11)
//
// Scheduled (daily) check for overdue payment milestones:
//   - Advance overdue: advance_status != 'received' and signing_date + 7d < today
//   - Balance overdue: balance_status != 'received' and bol_date + 7d < today
// Flips the milestone (+ trade) to 'overdue', and emails the SuperAdmin via
// Brevo. Fires once at T+7 then daily until marked received.
//
// ── Secrets (set via `supabase secrets set ...`) ────────────────────────────
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   - auto-injected in the Edge runtime
//   BREVO_API_KEY, BREVO_SENDER_EMAIL         - transactional email (shared)
//   ALERT_TO_EMAIL                            - SuperAdmin recipient
//
// ── Scheduling ──────────────────────────────────────────────────────────────
//   Deploy:   supabase functions deploy milestone-alerts
//   Schedule: create a daily cron (Supabase Dashboard → Edge Functions → Schedules,
//             or pg_cron calling the function URL). Example cron: "0 8 * * *".

import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { isBrevoConfigured, sendBrevoEmail, escapeHtml } from "../_shared/brevo.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const DAYS = 7;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

Deno.serve(async () => {
  const to = Deno.env.get("ALERT_TO_EMAIL")?.trim(); // SuperAdmin recipient

  let admin;
  try {
    admin = getAdminClient();
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server not configured." }, 500);
  }

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

  // Email each alert to the SuperAdmin via Brevo (PRD §11.3). A failure on one
  // email never aborts the others (or the function) — collect and report them.
  let emailed = 0;
  const emailErrors: string[] = [];
  const emailSkipped = !isBrevoConfigured() || !to;
  if (!emailSkipped) {
    for (const a of alerts) {
      const line = `${a.kind} payment is ${a.daysOverdue} day(s) past the ${DAYS}-day deadline.`;
      try {
        await sendBrevoEmail(to!, "TradeMirror Admin", {
          subject: `TradeMirror Alert: ${a.client} — ${a.kind} Overdue`,
          text: `Trade ${a.ref} — ${a.client}\n${line}\nOpen the trade folder to review.`,
          html:
            `<p style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#1b211e;">` +
            `<strong>Trade ${escapeHtml(a.ref)}</strong> — ${escapeHtml(a.client)}<br>${escapeHtml(line)}<br>` +
            `Open the trade folder to review.</p>`,
        });
        emailed++;
      } catch (e) {
        emailErrors.push(`${a.ref}: ${e instanceof Error ? e.message : "send error"}`);
      }
    }
  }
  // When Brevo / ALERT_TO_EMAIL are unset, alerts are still flipped to "overdue"
  // (surfaced in-app); emails resume once the secrets are set.

  return json({ ok: true, overdue: alerts.length, emailed, emailSkipped, emailErrors }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
