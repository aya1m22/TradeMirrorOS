import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact, Plus, Search, Pencil, Trash2, AlertCircle, Star } from "lucide-react";
import { Button, Card, CardContent, Spinner, EmptyState, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { contactService } from "@/features/contacts/services/contactService";
import { ContactFormModal } from "./ContactFormModal";
import type { ContactRow } from "@/services/supabase";

export function ContactListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => contactService.list(),
  });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [actionError, setActionError] = useState("");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? []).filter((c) =>
      !needle
        ? true
        : [c.full_name, c.email, c.role].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [data, search]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: ContactRow) => {
    setEditing(c);
    setModalOpen(true);
  };
  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void refresh();
  };

  const handleDelete = async (c: ContactRow) => {
    if (!window.confirm(`Delete contact "${c.full_name}"? This cannot be undone.`)) return;
    setActionError("");
    try {
      await contactService.remove(c.id);
      void refresh();
    } catch (e) {
      setActionError(
        e instanceof Error
          ? `Couldn't delete "${c.full_name}": ${e.message} (it may be linked to a trade).`
          : "Couldn't delete the contact.",
      );
    }
  };

  const handleSetDefault = async (c: ContactRow) => {
    setActionError("");
    try {
      await contactService.setDefault(c.id);
      void refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't set the default contact.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Directory</p>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-ink-500">Internal contacts shown as the Contact Person on contracts.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add contact
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role"
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
            <Spinner /> Loading contacts…
          </CardContent>
        </Card>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load contacts. {error instanceof Error ? error.message : ""}
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          icon={Contact}
          title={data && data.length > 0 ? "No contacts match your search" : "No contacts yet"}
          description={
            data && data.length > 0
              ? "Try a different search term."
              : "Add your first internal contact to use on generated contracts."
          }
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add contact
            </Button>
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Default</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-ink-900">{c.full_name}</TD>
                  <TD className="text-ink-600">{c.phone || <span className="text-ink-400">—</span>}</TD>
                  <TD className="text-ink-600">{c.email || <span className="text-ink-400">—</span>}</TD>
                  <TD>{c.role || <span className="text-ink-400">—</span>}</TD>
                  <TD>
                    {c.is_default ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brass-100 px-2.5 py-0.5 text-xs font-medium text-brass-700">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(c)}
                        className="text-xs text-ink-500 transition-colors hover:text-brass-700"
                      >
                        Set default
                      </button>
                    )}
                  </TD>
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
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ContactFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} contact={editing} />
    </div>
  );
}
