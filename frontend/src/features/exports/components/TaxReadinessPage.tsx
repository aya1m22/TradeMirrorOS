import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, AlertCircle, Download } from "lucide-react";
import { Button, Card, CardContent, Spinner, EmptyState, Select, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { formatMoney } from "@/core/domain/finance";
import {
  fetchTaxRows,
  filterByYear,
  yearsPresent,
  toCsv,
  toPdf,
  INCOME_CLASSIFICATION,
} from "@/features/exports/taxReadiness";

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function TaxReadinessPage() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["tax-rows"], queryFn: fetchTaxRows });
  const years = useMemo(() => yearsPresent(data ?? []), [data]);
  const [year, setYear] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const activeYear = year ?? years[0] ?? new Date().getFullYear();
  const rows = useMemo(() => filterByYear(data ?? [], activeYear), [data, activeYear]);

  const exportCsv = () => {
    setExportError("");
    try {
      download(`tax-readiness-${activeYear}.csv`, new Blob([toCsv(rows)], { type: "text/csv" }));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Couldn't export the CSV.");
    }
  };
  const exportPdf = async () => {
    setExporting(true);
    setExportError("");
    try {
      const bytes = await toPdf(rows, activeYear);
      download(`tax-readiness-${activeYear}.pdf`, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Couldn't export the PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Settings · Exports</p>
          <h1 className="text-2xl font-semibold">Tax Readiness</h1>
          <p className="text-ink-500">Annual per-trade export for your CPA. {INCOME_CLASSIFICATION}.</p>
        </div>
        <div className="flex items-end gap-2">
          <Select label="Year" value={String(activeYear)} onChange={(e) => setYear(Number(e.target.value))} className="max-w-[120px]">
            {(years.length ? years : [activeYear]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={exportPdf} disabled={rows.length === 0 || exporting}>
            {exporting ? <Spinner size="sm" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </header>

      {exportError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {exportError}
        </div>
      )}

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

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState icon={Download} title={`No trades in ${activeYear}`} description="Pick another year or create trades first." />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <TH>Trade</TH>
                <TH>Date</TH>
                <TH>Client</TH>
                <TH>Country</TH>
                <TH>Entity</TH>
                <TH className="text-right">Frigo</TH>
                <TH className="text-right">Sale</TH>
                <TH className="text-right">Net profit</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.tradeRef}>
                  <TD className="font-mono text-xs">{r.tradeRef}</TD>
                  <TD className="whitespace-nowrap text-ink-600">{r.contractDate}</TD>
                  <TD>{r.client}</TD>
                  <TD>{r.clientCountry}</TD>
                  <TD>{r.entity}</TD>
                  <TD className="text-right font-mono tabular-nums">{formatMoney(r.frigoTotal)}</TD>
                  <TD className="text-right font-mono tabular-nums">{formatMoney(r.saleTotal)}</TD>
                  <TD className="text-right font-mono tabular-nums font-semibold">{formatMoney(r.netProfit)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
