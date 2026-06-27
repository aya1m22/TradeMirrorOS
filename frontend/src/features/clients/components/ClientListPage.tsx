import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, Pencil, Trash2, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button, Card, CardContent, Spinner, EmptyState, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { cn } from "@/lib/cn";
import { clientService } from "@/features/clients/services/clientService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { AddClientModal } from "./AddClientModal";
import type { ClientRow } from "@/services/supabase";

type SortKey = "company_name" | "country";
type SortDir = "asc" | "desc";

export function ClientListPage() {
  const { role } = useAuth();
  const canManage = role === "super_admin"; // Internal team is view-only (§3.4).
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientService.list(),
  });

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("company_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [actionError, setActionError] = useState("");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data ?? []).filter((c) =>
      !needle
        ? true
        : [c.company_name, c.country, c.contact_name, c.contact_email]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(needle)),
    );
    const sorted = [...filtered].sort((a, b) => {
      const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: ClientRow) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleDelete = async (c: ClientRow) => {
    if (!window.confirm(`Delete client "${c.company_name}"? This cannot be undone.`)) return;
    setActionError("");
    try {
      await clientService.remove(c.id);
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      setActionError(
        e instanceof Error
          ? `Couldn't delete "${c.company_name}": ${e.message} (it may be linked to a trade).`
          : "Couldn't delete the client.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Directory</p>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-ink-500">Buyer records used when generating sales contracts.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add client
          </Button>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company, country, or contact"
          className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner /> Loading clients…
          </CardContent>
        </Card>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load clients. {error instanceof Error ? error.message : ""}
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          icon={Building2}
          title={data && data.length > 0 ? "No clients match your search" : "No clients yet"}
          description={
            data && data.length > 0
              ? "Try a different search term."
              : "Add your first buyer to use it when generating contracts."
          }
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add client
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <SortableTH label="Company" active={sortKey === "company_name"} dir={sortDir} onClick={() => toggleSort("company_name")} />
                <TH>Contact</TH>
                <TH>Email</TH>
                <SortableTH label="Country" active={sortKey === "country"} dir={sortDir} onClick={() => toggleSort("country")} />
                <TH>Tax ID</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-ink-900">{c.company_name}</TD>
                  <TD>{c.contact_name || <span className="text-ink-400">—</span>}</TD>
                  <TD className="text-ink-600">{c.contact_email || <span className="text-ink-400">—</span>}</TD>
                  <TD>{c.country || <span className="text-ink-400">—</span>}</TD>
                  <TD className="font-mono text-xs text-ink-600">{c.tax_id || <span className="text-ink-400">—</span>}</TD>
                  {canManage && (
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <AddClientModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleSaved} client={editing} />
    </div>
  );
}

function SortableTH({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <TH>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink-800",
          active ? "text-ink-800" : "text-ink-500",
        )}
      >
        {label}
        {active &&
          (dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </button>
    </TH>
  );
}
