import { useEffect, useState } from "react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { contactService } from "@/features/contacts/services/contactService";
import type { ContactRow } from "@/services/supabase";

interface ContactForm {
  full_name: string;
  phone: string;
  email: string;
  role: string;
}

const empty: ContactForm = { full_name: "", phone: "", email: "", role: "" };

function toForm(c: ContactRow): ContactForm {
  return { full_name: c.full_name, phone: c.phone, email: c.email, role: c.role ?? "" };
}

const REQUIRED: (keyof ContactForm)[] = ["full_name", "phone", "email"];

/**
 * Create or edit an internal contact (PRD §6.1). The "default contact" toggle is
 * applied via contactService.setDefault (which clears any prior default) so the
 * single-default DB constraint is respected.
 */
export function ContactFormModal({
  open,
  onClose,
  onSaved,
  contact = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contact?: ContactRow | null;
}) {
  const [form, setForm] = useState<ContactForm>(empty);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(contact ? toForm(contact) : empty);
      setMakeDefault(contact?.is_default ?? false);
      setError("");
    }
  }, [open, contact]);

  const set = (k: keyof ContactForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (REQUIRED.some((k) => !form[k].trim())) {
      setError("Full name, phone, and email are required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!phoneRegex.test(form.phone.trim())) {
      setError("Please enter a valid phone number (e.g., +1 234 567 8901).");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { ...form, role: form.role.trim() || null };
    try {
      // Persist base fields with is_default false; apply default via setDefault.
      const saved = contact
        ? await contactService.update(contact.id, { ...payload, is_default: false })
        : await contactService.create({ ...payload, is_default: false });
      if (makeDefault) await contactService.setDefault(saved.id);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't save the contact: ${e.message}`
          : "Couldn't save the contact. Is the backend provisioned?",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? "Edit contact" : "Add contact"}
      description="Internal contact shown as the Contact Person on generated contracts."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null} Save contact
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Full name *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Phone *" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <Input label="Role / title" value={form.role} onChange={(e) => set("role", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
          Set as default contact
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
