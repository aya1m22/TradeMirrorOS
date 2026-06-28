import { FileText, Building2, Users as UsersIcon, FileStack, Plus, ArrowRight, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, Spinner, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ROUTES, tradeDetailPath } from "@/config/routes";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatQuantity } from "@/core/domain/finance";
import { statusBadge } from "@/features/trades/tradeStatus";
import { fetchDashboardStats } from "@/features/dashboard/dashboardData";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Admin Dashboard — the landing surface for super_admin + internal. Live counts
 * and recent activity from existing tables (no mock data); quick actions and the
 * users metric are role-gated so nobody sees a link the router would then block.
 */
export function OverviewPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-stats", isSuperAdmin],
    queryFn: () => fetchDashboardStats(isSuperAdmin),
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wider text-brass-600">
          Chipa Farm · Internal Operations
        </p>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="max-w-2xl text-ink-500">
          Turn a supplier contract into a mirrored sales contract — preserving every cargo
          specification, replacing only the seller identity, banking, contact, and price.
        </p>
      </header>

      {/* ── Live metrics ─────────────────────────────────────────────────── */}
      {isError ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load dashboard data. {error instanceof Error ? error.message : ""}
        </div>
      ) : (
        <div className={cn("grid gap-4", isSuperAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Metric icon={FileText} label="Total trades" value={data?.tradeCount} loading={isLoading} />
          <Metric icon={FileStack} label="Documents" value={data?.documentCount} loading={isLoading} />
          {isSuperAdmin && (
            <Metric icon={UsersIcon} label="Users" value={data?.userCount ?? undefined} loading={isLoading} />
          )}
        </div>
      )}

      {/* ── Quick actions (role-gated) ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isSuperAdmin && (
            <ActionCard to={ROUTES.tradeNew} icon={Plus} title="New Trade" body="Upload a supplier contract and generate the mirror." primary />
          )}
          <ActionCard to={ROUTES.trades} icon={FileText} title="Trade Folder" body="Browse saved trades and their documents." />
          <ActionCard to={ROUTES.clients} icon={Building2} title="Clients" body="Buyer records for sales contracts." />
          {isSuperAdmin && (
            <ActionCard to={ROUTES.users} icon={UsersIcon} title="Users" body="Invite teammates and manage roles." />
          )}
        </div>
      </section>

      {/* ── Recent activity ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Recent activity</h2>
        <Card className="p-0">
          <CardHeader title="Latest trades" description="The five most recently created trades." />
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
                <Spinner size="sm" /> Loading…
              </div>
            ) : isError ? (
              <p className="py-4 text-sm text-ink-500">Recent activity unavailable.</p>
            ) : (data?.recentTrades ?? []).length === 0 ? (
              <EmptyState icon={FileText} title="No activity yet" description="Created trades will appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {(data?.recentTrades ?? []).map((t) => {
                  const badge = statusBadge(t.status);
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link
                          to={tradeDetailPath(t.id)}
                          className="font-medium text-ink-900 hover:text-brand-700"
                        >
                          {t.contractNumber || t.tradeReference}
                        </Link>
                        <p className="truncate text-xs text-ink-500">
                          {t.client ?? "—"} · {formatQuantity(t.quantityTons)} t · {formatDate(t.contractDate)}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", badge.classes)}>
                        {badge.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof FileText;
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-ink-900">
            {loading ? <span className="text-ink-300">…</span> : (value ?? 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  body,
  primary,
}: {
  to: string;
  icon: typeof FileText;
  title: string;
  body: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group rounded-lg border p-5 shadow-card transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        primary
          ? "border-brand-300 bg-brand-50/60 hover:border-brand-400"
          : "border-border bg-surface hover:border-brand-300",
      )}
    >
      <div
        className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded",
          primary ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="flex items-center gap-1 text-base font-semibold text-ink-900">
        {title}
        <ArrowRight className="h-4 w-4 -translate-x-1 text-ink-300 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
      </h3>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </Link>
  );
}
