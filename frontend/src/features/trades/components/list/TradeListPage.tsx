import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search, AlertCircle, ArrowRight } from "lucide-react";
import { Button, Card, CardContent, Spinner, EmptyState, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ROUTES, tradeDetailPath } from "@/config/routes";
import { formatQuantity } from "@/core/domain/finance";
import { listTrades, type TradeListItem } from "@/features/trades/services/tradeListService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  TRADE_PHASES,
  toTradePhase,
  statusBadge,
  type TradePhase,
} from "@/features/trades/tradeStatus";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function TradeListPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canCreate = role === "super_admin"; // /trades/new is SuperAdmin-only (§3.4).
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trades"],
    queryFn: listTrades,
  });

  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<TradePhase | "all">("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      if (phase !== "all" && toTradePhase(t.status) !== phase) return false;
      if (!needle) return true;
      return [t.contractNumber, t.tradeReference, t.client, t.commodity]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [data, search, phase]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Trade folder</p>
          <h1 className="text-2xl font-semibold">Trades</h1>
          <p className="text-ink-500">Every saved sales contract and its documents.</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate(ROUTES.tradeNew)}>
            <Plus className="h-4 w-4" /> New trade
          </Button>
        )}
      </header>

      {/* Search + status filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by contract no., reference, client, or commodity"
            className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
          <FilterChip active={phase === "all"} onClick={() => setPhase("all")}>
            All
          </FilterChip>
          {TRADE_PHASES.map((p) => (
            <FilterChip key={p.value} active={phase === p.value} onClick={() => setPhase(p.value)}>
              {p.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner /> Loading trades…
          </CardContent>
        </Card>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load trades. {error instanceof Error ? error.message : ""}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          title={data && data.length > 0 ? "No trades match your filters" : "No trades yet"}
          description={
            data && data.length > 0
              ? "Try a different search term or status filter."
              : "Saved sales contracts will appear here. Start by creating one."
          }
          action={
            canCreate ? (
              <Button onClick={() => navigate(ROUTES.tradeNew)}>
                <Plus className="h-4 w-4" /> New trade
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <TH>Contract no.</TH>
                <TH>Client</TH>
                <TH>Commodity</TH>
                <TH className="text-right">Quantity</TH>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function TradeRow({ trade: t }: { trade: TradeListItem }) {
  const navigate = useNavigate();
  const badge = statusBadge(t.status);
  return (
    <TR>
      <TD>
        <Link to={tradeDetailPath(t.id)} className="font-medium text-ink-900 hover:text-brand-700">
          {t.contractNumber || "—"}
        </Link>
        <div className="font-mono text-xs text-ink-400">{t.tradeReference}</div>
      </TD>
      <TD>{t.client ?? <span className="text-ink-400">—</span>}</TD>
      <TD className="max-w-[280px] truncate" title={t.commodity}>
        {t.commodity || "—"}
      </TD>
      <TD className="text-right font-mono tabular-nums">{formatQuantity(t.quantityTons)} t</TD>
      <TD className="whitespace-nowrap text-ink-600">{formatDate(t.contractDate)}</TD>
      <TD>
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", badge.classes)}>
          {badge.label}
        </span>
      </TD>
      <TD className="text-right">
        <Button variant="ghost" size="sm" onClick={() => navigate(tradeDetailPath(t.id))}>
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </TD>
    </TR>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        active ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
      )}
    >
      {children}
    </button>
  );
}
