import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, AlertCircle, FileText, CheckCircle2, Upload, Archive } from "lucide-react";
import { Button, Card, CardHeader, CardContent, Spinner, EmptyState, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ROUTES } from "@/config/routes";
import { formatMoney, formatQuantity } from "@/core/domain/finance";
import { getTrade } from "@/features/trades/services/tradeListService";
import { documentService } from "@/features/trades/services/documentService";
import { tradeService } from "@/features/trades/services/tradeService";
import { userService } from "@/features/users/services/userService";
import { storageService } from "@/services/storage/storageService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { DocumentType } from "@/services/supabase";
import { PHASE_BADGE, toTradePhase, tradePhaseLabel } from "@/features/trades/tradeStatus";
import {
  deadlineFrom,
  milestonePhase,
  MILESTONE_BADGE,
  MILESTONE_LABEL,
  type MilestonePhase,
} from "@/features/trades/milestones";
import type { Updatable } from "@/services/supabase";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const DOC_LABEL: Record<string, string> = {
  frigo_contract: "Supplier contract",
  sales_contract: "Sales contract",
  signed_contract: "Signed contract",
  bol: "Bill of lading",
  other: "Other",
};

export function TradeFolderPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canSeeFinancials = role === "super_admin"; // Internal sees no financials (§3.4).
  const canManage = role === "super_admin"; // milestone logging + status is SuperAdmin (§3.4).
  const canUpload = role === "super_admin" || role === "internal"; // §3.4 Trade Folder docs
  const queryClient = useQueryClient();

  const tradeQ = useQuery({ queryKey: ["trade", id], queryFn: () => getTrade(id), enabled: !!id });
  const docsQ = useQuery({
    queryKey: ["trade-docs", id],
    queryFn: () => documentService.listByTrade(id),
    enabled: !!id,
  });
  // Partner roster for the assignment selector — SuperAdmin only (§3.4).
  const partnersQ = useQuery({
    queryKey: ["partner-users"],
    queryFn: () => userService.list(),
    enabled: canManage,
    select: (users) => users.filter((u) => u.role === "partner" && u.is_active),
  });

  const [downloadError, setDownloadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");

  const mutateTrade = async (patch: Updatable<"trades">) => {
    setBusy(true);
    setLifecycleError("");
    try {
      await tradeService.update(id, patch);
      await queryClient.invalidateQueries({ queryKey: ["trade", id] });
      await queryClient.invalidateQueries({ queryKey: ["trades"] });
    } catch (e) {
      setLifecycleError(e instanceof Error ? e.message : "Couldn't update the trade.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (path: string) => {
    setDownloadError("");
    try {
      const url = await documentService.getSignedUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Couldn't open the document.");
    }
  };

  // ── Document upload (signed contract / BOL / additional) — §10.1–10.2 ──────
  const [uploadType, setUploadType] = useState<DocumentType>("signed_contract");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [bolDate, setBolDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    if (uploadType === "bol" && !bolDate) {
      setUploadError("Please enter the BOL date.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const uploaded = await storageService.uploadDocument(uploadFile);
      await documentService.create({
        trade_id: id,
        document_type: uploadType,
        file_name: uploaded.fileName,
        storage_path: uploaded.path,
        uploaded_by: user.id,
      });
      // A BOL upload records the BOL date and advances the trade to "shipped".
      if (uploadType === "bol") {
        await tradeService.update(id, { bol_date: bolDate, trade_status: "shipped" });
        await queryClient.invalidateQueries({ queryKey: ["trade", id] });
      }
      setUploadFile(null);
      setBolDate("");
      await queryClient.invalidateQueries({ queryKey: ["trade-docs", id] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't upload the document.");
    } finally {
      setUploading(false);
    }
  };

  // ── Audit Trail ZIP (§12.1) — SuperAdmin only ─────────────────────────────
  const [zipBusy, setZipBusy] = useState(false);
  const handleAuditZip = async () => {
    const docs = docsQ.data ?? [];
    if (docs.length === 0) return;
    setZipBusy(true);
    setDownloadError("");
    try {
      const { buildAuditZip } = await import("@/features/exports/auditTrail");
      const bytes = await buildAuditZip(docs);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${tradeQ.data?.trade_reference ?? "trade"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Couldn't build the audit ZIP.");
    } finally {
      setZipBusy(false);
    }
  };

  const trade = tradeQ.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to={ROUTES.trades} className="text-sm text-ink-500 transition-colors hover:text-ink-800">
          ← Back to trades
        </Link>
      </div>

      {tradeQ.isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner /> Loading trade…
          </CardContent>
        </Card>
      )}

      {tradeQ.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load this trade. {tradeQ.error instanceof Error ? tradeQ.error.message : ""}
        </div>
      )}

      {!tradeQ.isLoading && !tradeQ.isError && !trade && (
        <EmptyState
          icon={FileText}
          title="Trade not found"
          description="This trade doesn't exist or you don't have access to it."
          action={<Button onClick={() => navigate(ROUTES.trades)}>Back to trades</Button>}
        />
      )}

      {trade && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-wider text-brass-600">
                {trade.trade_reference}
              </p>
              <h1 className="text-2xl font-semibold">Contract {trade.frigo_contract_ref || "—"}</h1>
              <p className="text-ink-500">{trade.client ?? "Client not set"}</p>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                PHASE_BADGE[toTradePhase(trade.trade_status)],
              )}
            >
              {tradePhaseLabel(trade.trade_status)}
            </span>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Cargo" />
              <CardContent className="space-y-3 text-sm">
                <Row label="Commodity" value={trade.product_description || "—"} />
                <Row label="Quantity" value={`${formatQuantity(Number(trade.quantity_tons))} tons`} />
                <Row label="Contract date" value={formatDate(trade.contract_date)} />
                <Row label="Signing date" value={formatDate(trade.signing_date)} />
                <Row label="BL date" value={formatDate(trade.bol_date)} />
              </CardContent>
            </Card>

            {canSeeFinancials && (
              <Card>
                <CardHeader title="Financials" />
                <CardContent className="space-y-3 text-sm">
                  <Row label="Sale unit price" value={formatMoney(Number(trade.sale_unit_price))} mono />
                  <Row label="Sale total" value={formatMoney(Number(trade.sale_total))} mono strong />
                  <Row label="Freight" value={formatMoney(Number(trade.shipping_cost))} mono />
                  <Row label="Insurance" value={formatMoney(Number(trade.insurance_cost))} mono />
                  <Row label="Net profit" value={formatMoney(Number(trade.net_profit))} mono strong />
                </CardContent>
              </Card>
            )}
          </div>

          {canManage && (
            <Card>
              <CardHeader
                title="Partner assignment"
                description="Assign the investing partner who may see this trade in their portal (§13)."
              />
              <CardContent className="text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    label="Assigned partner"
                    value={trade.partner_id ?? ""}
                    disabled={busy || partnersQ.isLoading}
                    onChange={(e) => mutateTrade({ partner_id: e.target.value || null })}
                    className="max-w-[280px]"
                  >
                    <option value="">Unassigned</option>
                    {(partnersQ.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </Select>
                  {!partnersQ.isLoading && (partnersQ.data ?? []).length === 0 && (
                    <p className="text-xs text-ink-500">
                      No active partner users yet — invite one from Settings → Users.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader title="Lifecycle & milestones" description="Status and payment milestones (PRD §9.2/§10.3)." />
              <CardContent className="space-y-4 text-sm">
                {lifecycleError && <p className="text-xs text-danger">{lifecycleError}</p>}

                <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
                  <label className="text-ink-600">Signing date</label>
                  <input
                    type="date"
                    value={trade.signing_date ?? ""}
                    disabled={busy}
                    onChange={(e) => mutateTrade({ signing_date: e.target.value || null })}
                    className="h-9 w-full max-w-[220px] rounded border border-border bg-surface px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 hover:border-ink-300"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-600">Status</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", PHASE_BADGE[toTradePhase(trade.trade_status)])}>
                      {tradePhaseLabel(trade.trade_status)}
                    </span>
                    {trade.trade_status === "draft" && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => mutateTrade({ trade_status: "active" })}>
                        Mark as sent
                      </Button>
                    )}
                  </div>
                </div>

                <MilestoneRow
                  label="50% Advance"
                  hint="Due 7 days after signing date"
                  phase={milestonePhase(trade.advance_status, deadlineFrom(trade.signing_date))}
                  receivedAt={trade.advance_received_at}
                  onMark={
                    busy
                      ? undefined
                      : () =>
                          mutateTrade({
                            advance_status: "received",
                            advance_received_at: new Date().toISOString(),
                            trade_status: "advance_received",
                          })
                  }
                />
                <MilestoneRow
                  label="50% Balance"
                  hint="Due 7 days after BOL date"
                  phase={milestonePhase(trade.balance_status, deadlineFrom(trade.bol_date))}
                  receivedAt={trade.balance_received_at}
                  onMark={
                    busy
                      ? undefined
                      : () =>
                          mutateTrade({
                            balance_status: "received",
                            balance_received_at: new Date().toISOString(),
                            trade_status: "balance_received",
                          })
                  }
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Documents"
              description="Files saved to this Trade Folder."
              action={
                canManage && (docsQ.data ?? []).length > 0 ? (
                  <Button variant="outline" size="sm" onClick={handleAuditZip} disabled={zipBusy}>
                    {zipBusy ? <Spinner size="sm" /> : <Archive className="h-3.5 w-3.5" />} Audit ZIP
                  </Button>
                ) : undefined
              }
            />
            <CardContent>
              {canUpload && (
                <div className="mb-4 rounded-lg border border-dashed border-border bg-surface-2 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Select
                      label="Document type"
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value as DocumentType)}
                      className="max-w-[200px]"
                    >
                      <option value="signed_contract">Signed contract</option>
                      <option value="bol">Bill of lading</option>
                      <option value="other">Other</option>
                    </Select>
                    {uploadType === "bol" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-ink-700">BOL date</label>
                        <input
                          type="date"
                          value={bolDate}
                          onChange={(e) => setBolDate(e.target.value)}
                          className="h-10 rounded border border-border bg-surface px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 hover:border-ink-300"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-ink-700">File</label>
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="text-sm text-ink-600 file:mr-3 file:rounded file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink-700 hover:file:bg-ink-50"
                      />
                    </div>
                    <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
                      {uploading ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />} Upload
                    </Button>
                  </div>
                  {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}
                </div>
              )}
              {downloadError && (
                <p className="mb-3 flex items-start gap-2 text-xs text-danger">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {downloadError}
                </p>
              )}
              {docsQ.isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
                  <Spinner size="sm" /> Loading documents…
                </div>
              ) : (docsQ.data ?? []).length === 0 ? (
                <p className="py-4 text-sm text-ink-500">No documents recorded for this trade.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(docsQ.data ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-800">{d.file_name}</p>
                          <p className="text-xs text-ink-500">
                            {DOC_LABEL[d.document_type] ?? d.document_type} · {formatDate(d.uploaded_at)}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(d.storage_path)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MilestoneRow({
  label,
  hint,
  phase,
  receivedAt,
  onMark,
}: {
  label: string;
  hint: string;
  phase: MilestonePhase;
  receivedAt: string | null;
  onMark?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <div>
        <p className="font-medium text-ink-800">{label}</p>
        <p className="text-xs text-ink-500">
          {phase === "received" && receivedAt
            ? `Received ${new Date(receivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
            : hint}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", MILESTONE_BADGE[phase])}>
          {MILESTONE_LABEL[phase]}
        </span>
        {phase !== "received" && onMark && (
          <Button variant="outline" size="sm" onClick={onMark}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark received
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className={cn(mono && "font-mono tabular-nums", strong ? "font-semibold text-ink-900" : "text-ink-800")}>
        {value}
      </span>
    </div>
  );
}
