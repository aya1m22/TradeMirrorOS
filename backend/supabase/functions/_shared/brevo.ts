// Brevo (https://www.brevo.com) transactional email client + branded templates.
//
// Replaces the previous Resend integration. One sender is configured via env;
// callers build a {subject, html, text} with the template helpers and pass it to
// sendBrevoEmail. A non-2xx response throws with the Brevo detail so the caller
// can log/surface it — sending is best-effort and never corrupts app state.
//
// Secrets (set via `supabase secrets set ...`):
//   BREVO_API_KEY      - Brevo transactional API key (xkeysib-…).
//   BREVO_SENDER_EMAIL - verified Brevo sender address.
//   BREVO_SENDER_NAME  - optional display name (default "TradeMirror OS").

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const PLACEHOLDER_KEYS = new Set([
  "",
  "your_brevo_api_key_here",
  "your_brevo_api_key",
]);

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function getApiKey(): string | null {
  const key = Deno.env.get("BREVO_API_KEY")?.trim();
  return key && !PLACEHOLDER_KEYS.has(key) ? key : null;
}

function getSender(): { email: string; name: string } | null {
  const email = Deno.env.get("BREVO_SENDER_EMAIL")?.trim();
  if (!email) return null;
  const name = Deno.env.get("BREVO_SENDER_NAME")?.trim() || "TradeMirror OS";
  return { email, name };
}

/** True only when both an API key and a verified sender are configured. */
export function isBrevoConfigured(): boolean {
  return Boolean(getApiKey() && getSender());
}

/**
 * Send one transactional email through Brevo. Throws on missing config or a
 * non-2xx response (with the Brevo error detail). Callers treat email as
 * best-effort and catch this — it must never roll back account/DB state.
 */
export async function sendBrevoEmail(
  to: string,
  toName: string,
  content: EmailContent,
): Promise<void> {
  const apiKey = getApiKey();
  const sender = getSender();
  if (!apiKey || !sender) {
    throw new Error(
      "Email is not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL.",
    );
  }

  let res: Response;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to, name: toName || to }],
        subject: content.subject,
        htmlContent: content.html,
        textContent: content.text,
      }),
    });
  } catch (e) {
    // Network/DNS failure reaching Brevo.
    throw new Error(
      `Couldn't reach the email service: ${e instanceof Error ? e.message : "network error"}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email service returned ${res.status}: ${detail}`);
  }
}

// ── Branded templates (Pine/Brass, email-client-safe inline styles) ────────

/** Escape user-supplied text before interpolating into email HTML. */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function layout(opts: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
}): string {
  // Table-based layout for Outlook/Gmail compatibility; brand colors inline.
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#eaece8;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaece8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(27,33,30,0.10);">
        <tr><td style="background-color:#1a4a39;padding:20px 28px;">
          <span style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">TradeMirror<span style="color:#ddc187;"> OS</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px 8px;">
          <h1 style="margin:0 0 12px;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#1b211e;">${escapeHtml(opts.heading)}</h1>
          <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3f4742;">${opts.bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background-color:#1a4a39;">
            <a href="${opts.buttonUrl}" style="display:inline-block;padding:12px 24px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(opts.buttonLabel)}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <p style="margin:0 0 6px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#69736c;">${opts.footnote}</p>
          <p style="margin:8px 0 0;font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;color:#8b948c;word-break:break-all;">${escapeHtml(opts.buttonUrl)}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#8b948c;">TradeMirror OS — secure trade operations</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Invitation email: "set up your account". */
export function inviteEmailTemplate(opts: {
  fullName: string;
  acceptUrl: string;
  expiresHours: number;
}): EmailContent {
  const name = opts.fullName.trim() || "there";
  return {
    subject: "You're invited to TradeMirror OS",
    html: layout({
      preheader: "Set up your TradeMirror OS account.",
      heading: `Welcome, ${escapeHtml(name)}`,
      bodyHtml:
        `<p style="margin:0 0 12px;">You've been invited to join <strong>TradeMirror OS</strong>. ` +
        `Choose a password to activate your account and sign in.</p>` +
        `<p style="margin:0;">This invitation expires in ${opts.expiresHours} hours.</p>`,
      buttonLabel: "Accept invitation",
      buttonUrl: opts.acceptUrl,
      footnote:
        "If you weren't expecting this invitation you can safely ignore this email. " +
        "Or paste this link into your browser:",
    }),
    text:
      `Welcome, ${name}\n\n` +
      `You've been invited to join TradeMirror OS. Choose a password to activate ` +
      `your account and sign in:\n${opts.acceptUrl}\n\n` +
      `This invitation expires in ${opts.expiresHours} hours. If you weren't ` +
      `expecting it, you can ignore this email.`,
  };
}

/** Password-reset email. */
export function resetEmailTemplate(opts: {
  fullName: string;
  resetUrl: string;
  expiresMinutes: number;
}): EmailContent {
  const name = opts.fullName.trim() || "there";
  return {
    subject: "Reset your TradeMirror OS password",
    html: layout({
      preheader: "Reset your TradeMirror OS password.",
      heading: "Reset your password",
      bodyHtml:
        `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)}, we received a request to reset the ` +
        `password for your <strong>TradeMirror OS</strong> account.</p>` +
        `<p style="margin:0;">This link expires in ${opts.expiresMinutes} minutes and can be used once.</p>`,
      buttonLabel: "Reset password",
      buttonUrl: opts.resetUrl,
      footnote:
        "If you didn't request a reset, you can safely ignore this email — your " +
        "password won't change. Or paste this link into your browser:",
    }),
    text:
      `Reset your password\n\n` +
      `Hi ${name}, we received a request to reset your TradeMirror OS password. ` +
      `Open this link to choose a new one:\n${opts.resetUrl}\n\n` +
      `This link expires in ${opts.expiresMinutes} minutes and can be used once. ` +
      `If you didn't request it, you can ignore this email.`,
  };
}
