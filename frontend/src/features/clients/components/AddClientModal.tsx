import { useEffect, useState } from "react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { clientService } from "@/features/clients/services/clientService";
import type { ClientRow } from "@/services/supabase";

interface ClientForm {
  company_name: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
}

const empty: ClientForm = {
  company_name: "",
  address: "",
  city: "",
  country: "",
  tax_id: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
};

function toForm(c: ClientRow): ClientForm {
  return {
    company_name: c.company_name,
    address: c.address,
    city: c.city,
    country: c.country,
    tax_id: c.tax_id,
    contact_name: c.contact_name,
    contact_email: c.contact_email,
    contact_phone: c.contact_phone,
    notes: c.notes ?? "",
  };
}

// Required client fields per PRD §5.1 (Notes is optional).
const REQUIRED: (keyof ClientForm)[] = [
  "company_name",
  "address",
  "city",
  "country",
  "tax_id",
  "contact_name",
  "contact_email",
  "contact_phone",
];

/**
 * Create or edit a client (buyer) record (PRD §5). Persists to the `clients`
 * table and hands the saved row back via onCreated. Used both by the Client CMS
 * (create + edit) and the contract editor's "+ Add Client" flow (create only —
 * it passes no `client`, so behavior there is unchanged aside from collecting the
 * full §5.1 field set). Requires the Supabase backend — errors surface inline.
 */
export function AddClientModal({
  open,
  onClose,
  onCreated,
  client = null,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: ClientRow) => void;
  /** When provided, the modal edits this client instead of creating a new one. */
  client?: ClientRow | null;
}) {
  const [form, setForm] = useState<ClientForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load the record into the form when opening in edit mode (reset for create).
  useEffect(() => {
    if (open) {
      setForm(client ? toForm(client) : empty);
      setError("");
    }
  }, [open, client]);

  const set = (k: keyof ClientForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const close = () => {
    setError("");
    onClose();
  };

  const save = async () => {
    if (REQUIRED.some((k) => !form[k].trim())) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { ...form, notes: form.notes.trim() || null };
    try {
      const saved = client
        ? await clientService.update(client.id, payload)
        : await clientService.create(payload);
      onCreated(saved);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't save the client: ${e.message}`
          : "Couldn't save the client. Is the backend provisioned?",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={client ? "Edit client" : "Add client"}
      description={
        client
          ? "Update this buyer's details."
          : "Create a new buyer. It's saved to the client list and selected automatically."
      }
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null} Save client
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Company name *" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Tax ID / RUC *" value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          <Input label="Country *" value={form.country} onChange={(e) => set("country", e.target.value)} />
          <Input label="Address *" value={form.address} onChange={(e) => set("address", e.target.value)} />
          <Input label="City *" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="Contact person *" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          <Input label="Email *" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          <Input label="Phone *" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-700">Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full resize-y rounded border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 hover:border-ink-300"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
