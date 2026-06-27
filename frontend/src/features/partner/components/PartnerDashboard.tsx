import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, AlertCircle, Download, FileText } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Spinner,
  EmptyState,
  Modal,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/core/domain/finance";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { documentService } from "@/features/trades/services/documentService";
import { PHASE_BADGE, toTradePhase, tradePhaseLabel } from "@/features/trades/tradeStatus";
import { MILESTONE_BADGE, MILESTONE_LABEL } from "@/features/trades/milestones";
import { fetchPartnerTrades, summarize, type PartnerTrade } from "../partnerData";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Partner Dashboard (PRD §13). Dedicated read-only portal: portfolio overview,
 * trade list, and per-trade financial detail with document downloads. Never
 * shows any profit split.
 */
export function PartnerDashboard() {
  const { user, signOut } = useAuth();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["partner-trades"], queryFn: fetchPartnerTrades });
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "processing" | "completed">("all");
  const [selected, setSelected] = useState<PartnerTrade | null>(null);

  const trades = data ?? [];
  const portfolio = useMemo(() => summarize(trades), [trades]);
  const rows = useMemo(
    () => (statusFilter === "all" ? trades : trades.filter((t) => toTradePhase(t.status) === statusFilter)),
    [trades, statusFilter],
  );

  return (
    <div className="min-h-screen bg-surface-2">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-5">
        <span className="font-display text-sm font-semibold text-ink-900">TradeMirror · Partner Portal</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-600">{user?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-ink-500">Read-only view of trade activity.</p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
              <Spinner /> Loading…
            </CardContent>
          </Card>
        )}

        {isError && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Couldn't load trades. {error instanceof Error ? error.message : ""}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Total trades" value={String(portfolio.totalTrades)} />
              <Metric label="Invested capital" value={formatMoney(portfolio.investedCapital)} />
              <Metric label="Net profit" value={formatMoney(portfolio.totalNetProfit)} accent />
              <Metric label="Active trades" value={String(portfolio.activeTrades)} />
              <Metric label="Overdue milestones" value={String(portfolio.overdueMilestones)} danger={portfolio.overdueMilestones > 0} />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
              {(["all", "draft", "processing", "completed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                    statusFilter === s ? "bg-surface-2 text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState icon={FileText} title="No trades" description="Trades will appear here as they're created." />
            ) : (
              <Card className="overflow-hidden p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>Trade</TH>
                      <TH>Client</TH>
                      <TH>Entity</TH>
                      <TH>Date</TH>
                      <TH className="text-right">Frigo price</TH>
                      <TH className="text-right">Sale price</TH>
                      <TH className="text-right">Net profit</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((t) => (
                      <TR key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                        <TD className="font-mono text-xs">{t.tradeRef}</TD>
                        <TD>{t.client}</TD>
                        <TD>{t.entity}</TD>
                        <TD className="whitespace-nowrap text-ink-600">{fmtDate(t.contractDate)}</TD>
                        <TD className="text-right font-mono tabular-nums">{formatMoney(t.frigoTotal)}</TD>
                        <TD className="text-right font-mono tabular-nums">{formatMoney(t.saleTotal)}</TD>
                        <TD className="text-right font-mono tabular-nums font-semibold">{formatMoney(t.netProfit)}</TD>
                        <TD>
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", PHASE_BADGE[toTradePhase(t.status)])}>
                            {tradePhaseLabel(t.status)}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </main>

      <PartnerTradeModal trade={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Metric({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
        <p className={cn("mt-1 font-mono text-lg font-semibold tabular-nums", accent ? "text-brand-700" : danger ? "text-danger" : "text-ink-900")}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function PartnerTradeModal({ trade, onClose }: { trade: PartnerTrade | null; onClose: () => void }) {
  const docsQ = useQuery({
    queryKey: ["partner-trade-docs", trade?.id],
    queryFn: () => documentService.listByTrade(trade!.id),
    enabled: !!trade,
  });
  const [err, setErr] = useState("");

  const download = async (path: string) => {
    setErr("");
    try {
      const url = await documentService.getSignedUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't open the document.");
    }
  };

  return (
    <Modal open={!!trade} onClose={onClose} title={trade ? `Trade ${trade.tradeRef}` : ""} size="lg">
      {trade && (
        <div className="space-y-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader title="Financial breakdown" />
              <CardContent className="space-y-2 text-sm">
                <Line label="Investment (Frigo)" value={formatMoney(trade.frigoTotal)} />
                <Line label="Shipping" value={formatMoney(trade.shipping)} />
                <Line label="Insurance" value={formatMoney(trade.insurance)} />
                <Line label="Bank fees" value={formatMoney(trade.bankFees)} />
                <Line label="Total costs" value={formatMoney(trade.totalCosts)} strong />
                <Line label="Sale total" value={formatMoney(trade.saleTotal)} strong />
                <div className="border-t border-border pt-2">
                  <Line label="Net profit" value={formatMoney(trade.netProfit)} accent />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Milestones" />
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">50% Advance</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", MILESTONE_BADGE[trade.advanceStatus])}>
                    {MILESTONE_LABEL[trade.advanceStatus]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">50% Balance</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", MILESTONE_BADGE[trade.balanceStatus])}>
                    {MILESTONE_LABEL[trade.balanceStatus]}
                  </span>
                </div>
                <Line label="Signing date" value={fmtDate(trade.signingDate)} />
                <Line label="BOL date" value={fmtDate(trade.bolDate)} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Documents" />
            <CardContent>
              {err && <p className="mb-2 text-xs text-danger">{err}</p>}
              {docsQ.isLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-ink-500">
                  <Spinner size="sm" /> Loading…
                </div>
              ) : (docsQ.data ?? []).length === 0 ? (
                <p className="py-3 text-sm text-ink-500">No documents.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(docsQ.data ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2 truncate text-sm text-ink-800">
                        <FileText className="h-4 w-4 shrink-0 text-ink-400" /> {d.file_name}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => download(d.storage_path)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Modal>
  );
}

function Line({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className={cn("font-mono tabular-nums", accent ? "text-base font-semibold text-brand-700" : strong ? "font-semibold text-ink-900" : "text-ink-800")}>
        {value}
      </span>
    </div>
  );
}
