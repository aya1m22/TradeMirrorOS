import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { authService } from "../services/authService";

/**
 * Forgot-password (PRD §2.3). Triggers Supabase Auth's password-reset email.
 *
 * TODO(secrets): production email delivery should go through Resend. Configure
 * Supabase Auth → SMTP with the Resend SMTP credentials (RESEND_API_KEY) and a
 * verified @chipafarm.com sender domain. Until then Supabase's default mailer is
 * used (rate-limited). No app code change is needed when SMTP is configured.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await authService.resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold text-ink-900">Reset password</h1>
        <p className="mb-6 text-center text-sm text-ink-500">
          We'll email you a link to set a new password.
        </p>
        {sent ? (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-6 text-center shadow-card">
            <p className="text-sm text-ink-700">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on
              its way.
            </p>
            <Link to={ROUTES.login} className="inline-block text-sm text-brand-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : null} Send reset link
            </Button>
            <div className="text-center">
              <Link to={ROUTES.login} className="text-sm text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
