import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import type { UserRole } from "@/services/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  accountService,
  AccountActionError,
  type InvitationDetails,
} from "../services/accountService";
import { AuthScreen, AuthCard } from "./AuthScreen";

const MIN_PASSWORD = 8;

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  internal: "Internal Team",
  partner: "Partner",
};

type Phase = "verifying" | "ready" | "blocked" | "needs-login";

/**
 * Accept an invitation (PRD §2.2). The invite token arrives in the URL. We
 * verify it on load, then let the invitee set a password — which creates their
 * account, attaches their role, marks the invite accepted, and signs them in.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [invite, setInvite] = useState<InvitationDetails | null>(null);
  const [blockedMsg, setBlockedMsg] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Verify the token on mount (and whenever it changes, e.g. after a refresh).
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setBlockedMsg("This invitation link is missing its token. Ask an admin to resend it.");
      setPhase("blocked");
      return;
    }
    setPhase("verifying");
    accountService
      .verifyInvitation(token)
      .then((details) => {
        if (cancelled) return;
        setInvite(details);
        setPhase("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setBlockedMsg(
          e instanceof AccountActionError
            ? e.message
            : "We couldn't verify this invitation. Try again later.",
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
      const { email } = await accountService.acceptInvitation(token, password);
      // Account exists now — sign in with the password they just set.
      try {
        await signIn(email, password);
        navigate(ROUTES.overview, { replace: true });
      } catch {
        // Account is set up but auto sign-in failed (rare). Send them to login.
        setPhase("needs-login");
      }
    } catch (err) {
      if (err instanceof AccountActionError) {
        // A consumed/expired/invalid token can't be retried with a password —
        // surface it as a blocking state, not a form error.
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
      <AuthScreen title="Checking your invitation">
        <AuthCard>
          <div className="flex items-center justify-center gap-3 py-4 text-sm text-ink-500">
            <Spinner /> Verifying your invitation link…
          </div>
        </AuthCard>
      </AuthScreen>
    );
  }

  if (phase === "blocked") {
    return (
      <AuthScreen title="Invitation unavailable">
        <AuthCard>
          <p className="text-sm text-ink-700">{blockedMsg}</p>
          <Link
            to={ROUTES.login}
            className="inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Go to sign in
          </Link>
        </AuthCard>
      </AuthScreen>
    );
  }

  if (phase === "needs-login") {
    return (
      <AuthScreen title="Account ready">
        <AuthCard>
          <p className="text-sm text-ink-700">
            Your account is set up. Sign in with your new password to continue.
          </p>
          <Button onClick={() => navigate(ROUTES.login, { replace: true })}>Go to sign in</Button>
        </AuthCard>
      </AuthScreen>
    );
  }

  // phase === "ready"
  return (
    <AuthScreen
      title="Set your password"
      subtitle={
        invite ? (
          <>
            Activating <span className="font-medium text-ink-700">{invite.email}</span> as{" "}
            {ROLE_LABEL[invite.role]}.
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
            {submitting ? <Spinner size="sm" /> : null} Create account &amp; sign in
          </Button>
        </AuthCard>
      </form>
    </AuthScreen>
  );
}
