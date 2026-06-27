import { useEffect, useState } from "react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { entityService } from "@/features/entities/services/entityService";
import type { EntityRow } from "@/services/supabase";

interface EntityForm {
  name: string;
  country: string;
  ruc_ein: string;
  address: string;
  city: string;
}

const empty: EntityForm = { name: "", country: "", ruc_ein: "", address: "", city: "" };

function toForm(e: EntityRow): EntityForm {
  return { name: e.name, country: e.country, ruc_ein: e.ruc_ein, address: e.address, city: e.city };
}

const REQUIRED: (keyof EntityForm)[] = ["name", "country", "ruc_ein", "address", "city"];

/** Create or edit an entity profile (PRD §4.1). */
export function EntityFormModal({
  open,
  onClose,
  onSaved,
  entity = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entity?: EntityRow | null;
}) {
  const [form, setForm] = useState<EntityForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(entity ? toForm(entity) : empty);
      setError("");
    }
  }, [open, entity]);

  const set = (k: keyof EntityForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (REQUIRED.some((k) => !form[k].trim())) {
      setError("Please fill in all fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (entity) await entityService.update(entity.id, form);
      else await entityService.create({ ...form, is_active: true });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save the entity: ${e.message}` : "Couldn't save the entity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entity ? "Edit entity" : "Add entity"}
      description="Company profile used as the exporter on generated contracts."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null} Save entity
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Legal name *" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Country *" value={form.country} onChange={(e) => set("country", e.target.value)} />
          <Input label="RUC / EIN *" value={form.ruc_ein} onChange={(e) => set("ruc_ein", e.target.value)} />
          <Input label="Address *" value={form.address} onChange={(e) => set("address", e.target.value)} />
          <Input label="City *" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
