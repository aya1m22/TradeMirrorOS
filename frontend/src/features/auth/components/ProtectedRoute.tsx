import { Navigate, Outlet } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "@/services/supabase";

/**
 * Gate for authenticated routes (PRD §2). While the session resolves we show a
 * spinner; with no session we redirect to /login. There is no auto-login in any
 * environment — the app always starts at /login until a real session exists.
 */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (status === "unauthenticated") return <Navigate to={ROUTES.login} replace />;
  return <Outlet />;
}

/**
 * Role gate (PRD §3.4). Renders the nested routes only for the allowed roles;
 * otherwise redirects to `fallback` (used to send Partner → /partner and to keep
 * SuperAdmin-only settings out of reach of other roles).
 */
export function RequireRole({ roles, fallback }: { roles: UserRole[]; fallback: string }) {
  const { role, status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!role || !roles.includes(role)) return <Navigate to={fallback} replace />;
  return <Outlet />;
}
