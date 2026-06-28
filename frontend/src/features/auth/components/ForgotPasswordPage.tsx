import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { accountService, AccountActionError } from "../services/accountService";
import { AuthScreen, AuthCard } from "./AuthScreen";

/**
 * Forgot password (PRD §2.3), step 1. Sends a reset link via Brevo through the
 * request-password-reset Edge Function. The response is intentionally the same
 * whether or not the address exists, so this never reveals which emails have
 * accounts — only a network/server failure shows an error.
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
      await accountService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof AccountActionError
          ? err.message
          : "Couldn't send the reset email. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      title="Reset password"
      subtitle="We'll email you a link to set a new password."
    >
      {sent ? (
        <AuthCard>
          <p className="text-sm text-ink-700">
            If an account exists for{" "}
            <span className="font-medium">{email.trim()}</span>, a reset link is on its way. The
            link expires in 60 minutes.
          </p>
          <Link
            to={ROUTES.login}
            className="inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Back to sign in
          </Link>
        </AuthCard>
      ) : (
        <form onSubmit={submit}>
          <AuthCard>
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
          </AuthCard>
        </form>
      )}
    </AuthScreen>
  );
}
