import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button, Select } from "@/components/ui";
import type { ClientRow } from "@/services/supabase";

/**
 * Pick the buyer from the client list, searchable by company name, contact
 * person, or email. "+ Add Client" opens the create-client modal.
 */
export function ClientSelector({
  clients,
  selectedId,
  onSelect,
  onAdd,
  invalid,
}: {
  clients: ClientRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  invalid?: boolean;
}) {
  const [q, setQ] = useState("");

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = needle
      ? clients.filter((c) =>
          [c.company_name, c.contact_name, c.contact_email]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(needle)),
        )
      : clients;
    // Always keep the selected client visible even if it's filtered out.
    if (selectedId && !matches.some((c) => c.id === selectedId)) {
      const sel = clients.find((c) => c.id === selectedId);
      if (sel) return [sel, ...matches];
    }
    return matches;
  }, [clients, q, selectedId]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by company, contact, or email"
          className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
      </div>

      <Select
        label="Client"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        error={invalid ? "Select a client" : undefined}
      >
        {options.length === 0 && <option value="">No matching clients</option>}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.company_name}
            {c.contact_name ? ` — ${c.contact_name}` : ""}
          </option>
        ))}
      </Select>

      <Button variant="outline" onClick={onAdd} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Add Client
      </Button>
    </div>
  );
}
