import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { useAuth } from "../hooks/useAuth";

/**
 * Email + password login (PRD §2.3). On success the user is sent to "/"; the
 * route role-guards then redirect Partner to their dashboard. No self-registration
 * — accounts are created by the SuperAdmin (User Management).
 */
export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (e.g. dev auto-login) → bounce to the app.
  if (status === "authenticated") return <Navigate to={ROUTES.overview} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      navigate(ROUTES.overview, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-brand-700 font-display text-sm font-bold text-brass-300">
            TM
          </span>
          <h1 className="text-xl font-semibold text-ink-900">TradeMirror OS</h1>
          <p className="text-sm text-ink-500">Sign in to continue</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : null} Sign in
          </Button>
          <div className="text-center">
            <Link to={ROUTES.forgotPassword} className="text-sm text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
