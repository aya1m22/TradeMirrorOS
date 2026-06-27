import { useEffect, useState } from "react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { bankProfileService } from "@/features/entities/services/bankProfileService";
import type { BankProfileRow } from "@/services/supabase";

interface BankForm {
  profile_name: string;
  beneficiary_name: string;
  beneficiary_address: string;
  intermediary_bank_name: string;
  intermediary_bank_swift: string;
  bank_name: string;
  bank_swift: string;
  account_number: string;
  ara_number: string;
  field_71a: string;
}

const empty: BankForm = {
  profile_name: "",
  beneficiary_name: "",
  beneficiary_address: "",
  intermediary_bank_name: "",
  intermediary_bank_swift: "",
  bank_name: "",
  bank_swift: "",
  account_number: "",
  ara_number: "",
  field_71a: "OUR",
};

function toForm(b: BankProfileRow): BankForm {
  return {
    profile_name: b.profile_name,
    beneficiary_name: b.beneficiary_name,
    beneficiary_address: b.beneficiary_address,
    intermediary_bank_name: b.intermediary_bank_name,
    intermediary_bank_swift: b.intermediary_bank_swift,
    bank_name: b.bank_name,
    bank_swift: b.bank_swift,
    account_number: b.account_number,
    ara_number: b.ara_number ?? "",
    field_71a: b.field_71a,
  };
}

// Required per §4.2 (ARA optional; field_71a defaults to OUR).
const REQUIRED: (keyof BankForm)[] = [
  "profile_name",
  "beneficiary_name",
  "beneficiary_address",
  "intermediary_bank_name",
  "intermediary_bank_swift",
  "bank_name",
  "bank_swift",
  "account_number",
];

/** Create or edit a banking profile under an entity (PRD §4.2). */
export function BankProfileFormModal({
  open,
  onClose,
  onSaved,
  entityId,
  profile = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entityId: string;
  profile?: BankProfileRow | null;
}) {
  const [form, setForm] = useState<BankForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(profile ? toForm(profile) : empty);
      setError("");
    }
  }, [open, profile]);

  const set = (k: keyof BankForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (REQUIRED.some((k) => !form[k].trim())) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      ara_number: form.ara_number.trim() || null,
      field_71a: form.field_71a.trim() || "OUR",
    };
    try {
      if (profile) await bankProfileService.update(profile.id, payload);
      else await bankProfileService.create({ ...payload, entity_id: entityId, is_default: false });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save the bank profile: ${e.message}` : "Couldn't save the bank profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={profile ? "Edit banking profile" : "Add banking profile"}
      description="Beneficiary bank details injected into the contract's bank block."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null} Save profile
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Profile name *" value={form.profile_name} onChange={(e) => set("profile_name", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Beneficiary name *" value={form.beneficiary_name} onChange={(e) => set("beneficiary_name", e.target.value)} />
          <Input label="Beneficiary address *" value={form.beneficiary_address} onChange={(e) => set("beneficiary_address", e.target.value)} />
          <Input label="Intermediary bank *" value={form.intermediary_bank_name} onChange={(e) => set("intermediary_bank_name", e.target.value)} />
          <Input label="Intermediary SWIFT *" value={form.intermediary_bank_swift} onChange={(e) => set("intermediary_bank_swift", e.target.value)} />
          <Input label="Bank name *" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
          <Input label="Bank SWIFT *" value={form.bank_swift} onChange={(e) => set("bank_swift", e.target.value)} />
          <Input label="Account number / IBAN *" value={form.account_number} onChange={(e) => set("account_number", e.target.value)} />
          <Input label="ARA number" value={form.ara_number} onChange={(e) => set("ara_number", e.target.value)} />
          <Input label="Field 71A" value={form.field_71a} onChange={(e) => set("field_71a", e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
