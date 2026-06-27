import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  internal: "Internal",
  partner: "Partner",
};

/**
 * Slim top bar. Shows the signed-in user + role and a sign-out action.
 */
export function Topbar() {
  const { user, role, signOut } = useAuth();
  const initials = (user?.full_name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "—";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 px-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <span className="hidden font-mono text-xs uppercase tracking-wide sm:inline">
          Triangular Beef Trading
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-ink-800">{user?.full_name ?? "Signed out"}</p>
          {role && <p className="text-[0.68rem] uppercase tracking-wide text-ink-400">{ROLE_LABEL[role] ?? role}</p>}
        </div>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
          aria-hidden
        >
          {initials}
        </span>
        {user && (
          <button
            type="button"
            onClick={() => void signOut()}
            title="Sign out"
            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
