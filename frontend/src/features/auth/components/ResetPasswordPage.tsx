import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { useAuth } from "../hooks/useAuth";
import { accountService, AccountActionError } from "../services/accountService";
import { AuthScreen, AuthCard } from "./AuthScreen";

const MIN_PASSWORD = 8;

type Phase = "verifying" | "ready" | "blocked" | "needs-login";

/**
 * Reset password (PRD §2.3), step 2. The reset token arrives in the URL. We
 * verify it on load, then let the user set a new password, invalidate the token,
 * and sign them straight in.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [email, setEmail] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setBlockedMsg("This reset link is missing its token. Request a new one.");
      setPhase("blocked");
      return;
    }
    setPhase("verifying");
    accountService
      .verifyResetToken(token)
      .then(({ email: who }) => {
        if (cancelled) return;
        setEmail(who);
        setPhase("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setBlockedMsg(
          e instanceof AccountActionError
            ? e.message
            : "We couldn't verify this reset link. Try again later.",
        );
        setPhase("blocked");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (password.length < MIN_PASSWORD) {
      setFormError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setFormError("Those passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { email: who } = await accountService.confirmPasswordReset(token, password);
      try {
        await signIn(who, password);
        navigate(ROUTES.overview, { replace: true });
      } catch {
        setPhase("needs-login");
      }
    } catch (err) {
      if (err instanceof AccountActionError) {
        if (err.code === "used" || err.code === "expired" || err.code === "invalid") {
          setBlockedMsg(err.message);
          setPhase("blocked");
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  };

  if (phase === "verifying") {
    return (
      <AuthScreen title="Checking your reset link">
        <AuthCard>
          <div className="flex items-center justify-center gap-3 py-4 text-sm text-ink-500">
            <Spinner /> Verifying your reset link…
          </div>
        </AuthCard>
      </AuthScreen>
    );
  }

  if (phase === "blocked") {
    return (
      <AuthScreen title="Link unavailable">
        <AuthCard>
          <p className="text-sm text-ink-700">{blockedMsg}</p>
          <div className="flex gap-4">
            <Link
              to={ROUTES.forgotPassword}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Request a new link
            </Link>
            <Link to={ROUTES.login} className="text-sm text-ink-500 hover:underline">
              Back to sign in
            </Link>
          </div>
        </AuthCard>
      </AuthScreen>
    );
  }

  if (phase === "needs-login") {
    return (
      <AuthScreen title="Password updated">
        <AuthCard>
          <p className="text-sm text-ink-700">
            Your password has been changed. Sign in with your new password to continue.
          </p>
          <Button onClick={() => navigate(ROUTES.login, { replace: true })}>Go to sign in</Button>
        </AuthCard>
      </AuthScreen>
    );
  }

  // phase === "ready"
  return (
    <AuthScreen
      title="Choose a new password"
      subtitle={
        email ? (
          <>
            for <span className="font-medium text-ink-700">{email}</span>
          </>
        ) : undefined
      }
    >
      <form onSubmit={submit}>
        <AuthCard>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={`At least ${MIN_PASSWORD} characters.`}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirm && confirm !== password ? "Passwords don't match." : undefined}
            required
          />
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : null} Update password &amp; sign in
          </Button>
        </AuthCard>
      </form>
    </AuthScreen>
  );
}
