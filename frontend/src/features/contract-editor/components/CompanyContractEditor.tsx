import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Download, Eye, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Card, CardHeader, CardContent, Modal, Spinner, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildMirroredContract, type ReviewedValues } from "@/core/mirroring";
import {
  ENTITIES,
  BANK_PROFILES,
  CONTACTS,
  ACTIVE_ENTITY_ID,
  DEFAULT_BALANCE_TEXT,
  PHASE1_DEFAULT_CLIENT,
  type EntityOption,
  type BankOption,
  type ContactOption,
} from "@/core/mirroring/phase1Defaults";
import { persistGeneratedContract } from "@/features/trades/services/contractPersistence";
import {
  formatMoney,
  formatLatinNumber,
  parseLatinNumber,
  round2,
} from "@/core/domain/finance";
import type { OverlayBank, OverlayData, OverlayParty } from "@/core/pdf-engine/generate";
import { clientService } from "@/features/clients/services/clientService";
import { entityService } from "@/features/entities/services/entityService";
import { bankProfileService } from "@/features/entities/services/bankProfileService";
import { contactService } from "@/features/contacts/services/contactService";
import { ClientSelector } from "@/features/clients/components/ClientSelector";
import { AddClientModal } from "@/features/clients/components/AddClientModal";
import type { ClientRow, EntityRow, BankProfileRow, ContactRow } from "@/services/supabase";
import { useCompanyContract } from "../hooks/useCompanyContract";
import { LockedField } from "./LockedField";
// Bundled 701-2026 template — overlay fallback when entered manually (no upload).
import templateUrl from "@/data/fixtures/contrato-701-2026.pdf?url";

type SaveState =
  | { status: "idle" | "saving" }
  | { status: "saved"; reference: string }
  | { status: "error"; message: string };

type CargoKey = "commodity" | "quantity" | "quality" | "incoterm" | "deliveryTerms";

const EMPTY_BANK: OverlayBank = {
  intermediaryBankName: "",
  intermediaryBankSwift: "",
  bankName: "",
  bankSwift: "",
  accountNumber: "",
  araNumber: "",
  beneficiaryName: "",
  beneficiaryAddress: "",
};

const DEFAULT_CLIENT_ROW = {
  ...PHASE1_DEFAULT_CLIENT,
  created_at: "",
  notes: null,
} as ClientRow;

// Map live DB rows → the selector option shapes (same shapes as the Phase-1
// catalogs, used as fallback). "PENDING" RUC maps to blank to preserve the
// current contract appearance until a real RUC is entered via the CMS.
function mapEntity(e: EntityRow): EntityOption {
  return {
    id: e.id,
    name: e.name,
    party: {
      name: e.name,
      taxId: e.ruc_ein && e.ruc_ein !== "PENDING" ? e.ruc_ein : "",
      address: e.address && e.address !== "PENDING" ? e.address : "",
      city: e.city && e.city !== "PENDING" ? e.city : "",
      country: e.country,
    },
  };
}
function mapBank(b: BankProfileRow): BankOption {
  return {
    id: b.id,
    entityId: b.entity_id,
    label: b.profile_name,
    bank: {
      intermediaryBankName: b.intermediary_bank_name,
      intermediaryBankSwift: b.intermediary_bank_swift,
      bankName: b.bank_name,
      bankSwift: b.bank_swift,
      accountNumber: b.account_number,
      araNumber: b.ara_number ?? "",
      beneficiaryName: b.beneficiary_name,
      beneficiaryAddress: b.beneficiary_address,
    },
  };
}
function mapContact(c: ContactRow): ContactOption {
  return {
    id: c.id,
    label: c.role ? `${c.full_name} — ${c.role}` : c.full_name,
    contact: { name: c.full_name, phone: c.phone, email: c.email },
  };
}

async function loadOriginalBytes(file: File | null): Promise<ArrayBuffer> {
  if (file) return file.arrayBuffer();
  const res = await fetch(templateUrl);
  return res.arrayBuffer();
}

export function CompanyContractEditor({
  reviewed,
  originalFile,
  onBack,
}: {
  reviewed: ReviewedValues;
  originalFile: File | null;
  onBack: () => void;
}) {
  const initial = useMemo(() => buildMirroredContract({ reviewed }), [reviewed]);
  const { contract, financials, setMargin, setSaleUnitPrice, setNumber, setCargoText, setQuantity } =
    useCompanyContract(initial);

  // ── Acting entity / bank / contact — live profiles, Phase-1 catalogs as fallback ──
  const liveEntities = useQuery({ queryKey: ["entities"], queryFn: () => entityService.list() }).data;
  const liveBanks = useQuery({ queryKey: ["bank_profiles"], queryFn: () => bankProfileService.list() }).data;
  const liveContacts = useQuery({ queryKey: ["contacts"], queryFn: () => contactService.list() }).data;

  const entities = liveEntities && liveEntities.length ? liveEntities.map(mapEntity) : ENTITIES;
  const bankProfiles = liveBanks && liveBanks.length ? liveBanks.map(mapBank) : BANK_PROFILES;
  const contacts = liveContacts && liveContacts.length ? liveContacts.map(mapContact) : CONTACTS;

  const [entityId, setEntityId] = useState(ACTIVE_ENTITY_ID);
  const [bankId, setBankId] = useState(
    BANK_PROFILES.find((b) => b.entityId === ACTIVE_ENTITY_ID)?.id ?? "",
  );
  const [contactId, setContactId] = useState(CONTACTS[0].id);
  const [prepaymentDate, setPrepaymentDate] = useState("");

  const entity = entities.find((e) => e.id === entityId) ?? entities[0];
  const banksForEntity = bankProfiles.filter((b) => b.entityId === entity.id);
  const bankOption = bankProfiles.find((b) => b.id === bankId) ?? banksForEntity[0];
  const bank = bankOption?.bank ?? EMPTY_BANK;
  const contact = (contacts.find((c) => c.id === contactId) ?? contacts[0]).contact;

  const onEntityChange = (id: string) => {
    setEntityId(id);
    setBankId(bankProfiles.find((b) => b.entityId === id)?.id ?? "");
  };

  // ── Client (buyer) selector + add-client ──────────────────────────────────
  const [clients, setClients] = useState<ClientRow[]>([DEFAULT_CLIENT_ROW]);
  const [selectedClientId, setSelectedClientId] = useState(DEFAULT_CLIENT_ROW.id);
  const [showAddClient, setShowAddClient] = useState(false);

  useEffect(() => {
    let active = true;
    clientService
      .list()
      .then((rows) => {
        if (!active) return;
        const map = new Map<string, ClientRow>([[DEFAULT_CLIENT_ROW.id, DEFAULT_CLIENT_ROW]]);
        for (const r of rows) map.set(r.id, r);
        setClients([...map.values()]);
      })
      .catch(() => {
        /* offline / backend not provisioned — keep the default client */
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? clients[0];
  const clientParty: OverlayParty = {
    name: selectedClient.company_name,
    address: selectedClient.address,
    city: selectedClient.city,
    country: selectedClient.country,
    taxId: selectedClient.tax_id,
  };

  const handleClientCreated = (client: ClientRow) => {
    setClients((cs) => {
      const map = new Map(cs.map((c) => [c.id, c]));
      map.set(client.id, client);
      return [...map.values()];
    });
    setSelectedClientId(client.id);
    setShowAddClient(false);
  };

  // ── Cargo (mirrored, unlockable) ──────────────────────────────────────────
  const originalCargo = useMemo(
    () => ({
      commodity: initial.commodity,
      quantity: initial.quantity,
      quality: initial.quality,
      incoterm: initial.incoterm,
      deliveryTerms: initial.deliveryTerms,
    }),
    [initial],
  );
  const [unlocked, setUnlocked] = useState<Set<CargoKey>>(new Set());
  const unlock = (k: CargoKey) => setUnlocked((s) => new Set(s).add(k));
  const relock = (k: CargoKey) =>
    setUnlocked((s) => {
      const next = new Set(s);
      next.delete(k);
      return next;
    });
  const resetCargo = (k: CargoKey) => {
    if (k === "quantity") setQuantity(originalCargo.quantity);
    else setCargoText(k, originalCargo[k]);
    relock(k);
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [showErrors, setShowErrors] = useState(false);

  // ── Auto-generated payment conditions ─────────────────────────────────────
  const advance = round2(financials.saleTotal / 2);
  const balance = round2(financials.saleTotal - advance);
  const prepaymentText = `50% until ${prepaymentDate || "____________"} - Advanced value: ${formatLatinNumber(
    advance,
    2,
  )}`;
  const balanceText = DEFAULT_BALANCE_TEXT;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!selectedClient || !selectedClient.company_name.trim()) e.push("Select a client (buyer).");
    if (contract.saleUnitPrice <= 0) e.push("Sale unit price must be greater than zero.");
    if (!bankOption) e.push("Selected entity has no banking profile — pick another entity.");
    return e;
  }, [selectedClient, contract.saleUnitPrice, bankOption]);

  const fileName = `${contract.frigoContractRef || "sales-contract"}-mirror.pdf`;

  const overlayData = (): OverlayData => {
    const overrides: NonNullable<OverlayData["overrides"]> = {};
    if (contract.commodity !== originalCargo.commodity) overrides.commodity = contract.commodity;
    if (contract.quantity !== originalCargo.quantity)
      overrides.quantityLatin = formatLatinNumber(contract.quantity, 2);
    if (contract.incoterm !== originalCargo.incoterm) overrides.incoterm = contract.incoterm;

    return {
      exporter: entity.party,
      client: clientParty,
      contact,
      unitPriceLatin: formatLatinNumber(contract.saleUnitPrice, 3),
      totalLatin: formatLatinNumber(financials.saleTotal, 2),
      freightLatin: formatLatinNumber(contract.shippingCost, 2),
      insuranceLatin: formatLatinNumber(contract.insuranceCost, 2),
      prepaymentText,
      balanceText,
      bank,
      buyerSignatureName: entity.name,
      ...(Object.keys(overrides).length ? { overrides } : {}),
    };
  };

  // Lazy-load pdf-lib + the overlay engine so they only download when needed.
  const generate = async (): Promise<Uint8Array> => {
    const { generateOverlayContractPdf } = await import("@/core/pdf-engine/generate");
    const bytes = await loadOriginalBytes(originalFile);
    return generateOverlayContractPdf(bytes, overlayData());
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const bytes = await generate();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      setPreviewUrl(url);
    } catch (e) {
      setSave({ status: "error", message: e instanceof Error ? e.message : "Couldn't render the PDF." });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const bytes = await generate();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSave({ status: "error", message: e instanceof Error ? e.message : "Couldn't generate the PDF." });
    }
  };

  const handleSave = async () => {
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    setSave({ status: "saving" });
    try {
      const bytes = await generate();
      const result = await persistGeneratedContract({
        bytes,
        fileName,
        mirrored: contract,
        context: { entityId, bankProfileId: bankId, contactId, clientId: selectedClientId },
      });
      setSave({ status: "saved", reference: result.tradeReference });
    } catch (e) {
      setSave({ status: "error", message: e instanceof Error ? e.message : "Couldn't save." });
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          ← Back to review
        </button>
        <p className="font-mono text-xs uppercase tracking-wider text-brass-600">
          New trade · Step 2
        </p>
        <h1 className="text-2xl font-semibold">Company sales contract</h1>
        <p className="text-ink-500">
          The supplier is replaced by {entity.name} as exporter. The mirrored values below are
          overlaid onto the original 701-2026 PDF; cargo terms stay back-to-back unless unlocked.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-xs text-ink-600">
        <Lock className="h-3.5 w-3.5 text-ink-400" />
        Locked fields are mirrored from the supplier contract. Unlock a field to override it.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          {/* Active entity (exporter) — selector */}
          <Card>
            <CardHeader title="Active entity (exporter)" description="Selected profile replaces the supplier as exporter." />
            <CardContent className="space-y-3">
              <Select label="Active entity" value={entityId} onChange={(e) => onEntityChange(e.target.value)}>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <ProfileDetails
                rows={[
                  ["Tax ID / RUC", entity.party.taxId],
                  ["Address", entity.party.address],
                  ["City", entity.party.city],
                  ["Country", entity.party.country],
                ]}
              />
            </CardContent>
          </Card>

          {/* Client (buyer) — selector + add */}
          <Card>
            <CardHeader title="Client (buyer)" description="Select an existing client or add a new one." />
            <CardContent className="space-y-3">
              <ClientSelector
                clients={clients}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
                onAdd={() => setShowAddClient(true)}
                invalid={showErrors && !selectedClient?.company_name.trim()}
              />
              <ProfileDetails
                rows={[
                  ["Contact", selectedClient?.contact_name ?? ""],
                  ["Email", selectedClient?.contact_email ?? ""],
                  ["Address", selectedClient?.address ?? ""],
                  ["City / Country", [selectedClient?.city, selectedClient?.country].filter(Boolean).join(", ")],
                ]}
              />
            </CardContent>
          </Card>

          {/* Contact person — selector */}
          <Card>
            <CardHeader title="Contact person" description="Selected from the contact library." />
            <CardContent className="space-y-3">
              <Select label="Contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <ProfileDetails
                rows={[
                  ["Name", contact.name],
                  ["Phone", contact.phone],
                  ["Email", contact.email],
                ]}
              />
            </CardContent>
          </Card>

          {/* Cargo — locked, unlockable */}
          <Card>
            <CardHeader title="Cargo" description="Mirrored from the supplier contract. Unlock to override." />
            <CardContent className="space-y-4">
              <LockedField
                label="Commodity"
                value={contract.commodity}
                originalValue={originalCargo.commodity}
                unlocked={unlocked.has("commodity")}
                multiline
                onUnlock={() => unlock("commodity")}
                onReset={() => resetCargo("commodity")}
                onChange={(v) => setCargoText("commodity", v)}
              />
              <LockedField
                label="Quantity"
                value={String(contract.quantity)}
                originalValue={String(originalCargo.quantity)}
                unlocked={unlocked.has("quantity")}
                mono
                suffix={contract.quantityUnit}
                onUnlock={() => unlock("quantity")}
                onReset={() => resetCargo("quantity")}
                onChange={(v) => setQuantity(parseLatinNumber(v))}
              />
              <LockedField
                label="Quality"
                value={contract.quality}
                originalValue={originalCargo.quality}
                unlocked={unlocked.has("quality")}
                reflectsInPdf={false}
                onUnlock={() => unlock("quality")}
                onReset={() => resetCargo("quality")}
                onChange={(v) => setCargoText("quality", v)}
              />
              <LockedField
                label="Incoterm"
                value={contract.incoterm}
                originalValue={originalCargo.incoterm}
                unlocked={unlocked.has("incoterm")}
                mono
                onUnlock={() => unlock("incoterm")}
                onReset={() => resetCargo("incoterm")}
                onChange={(v) => setCargoText("incoterm", v)}
              />
              <LockedField
                label="Delivery terms"
                value={contract.deliveryTerms}
                originalValue={originalCargo.deliveryTerms}
                unlocked={unlocked.has("deliveryTerms")}
                multiline
                reflectsInPdf={false}
                onUnlock={() => unlock("deliveryTerms")}
                onReset={() => resetCargo("deliveryTerms")}
                onChange={(v) => setCargoText("deliveryTerms", v)}
              />
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader title="Pricing" description="Set your sale price and costs; totals auto-calculate." />
            <CardContent className="space-y-4">
              <ReadonlyMoney label="Supplier unit price" value={formatMoney(contract.supplierUnitPrice, contract.currency)} />
              <NumberField label="Margin / unit" value={contract.marginPerUnit} onChange={setMargin} />
              <NumberField
                label="Sale unit price"
                value={contract.saleUnitPrice}
                onChange={setSaleUnitPrice}
                invalid={showErrors && contract.saleUnitPrice <= 0}
              />
              <ReadonlyMoney label="Total amount (auto)" value={formatMoney(financials.saleTotal, contract.currency)} />
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Freight cost" value={contract.shippingCost} onChange={(v) => setNumber("shippingCost", v)} compact />
                <NumberField label="Insurance cost" value={contract.insuranceCost} onChange={(v) => setNumber("insuranceCost", v)} compact />
                <NumberField label="Bank fees" value={contract.bankFees} onChange={(v) => setNumber("bankFees", v)} compact />
              </div>
            </CardContent>
          </Card>

          {/* Payment terms — auto-generated */}
          <Card>
            <CardHeader title="Payment terms" description="Generated automatically — 50% advance, 50% balance against BL copy." />
            <CardContent className="space-y-4">
              <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
                <label className="text-sm font-medium text-ink-700">Prepayment due date</label>
                <input
                  type="text"
                  placeholder="e.g. abr/27/2026"
                  value={prepaymentDate}
                  onChange={(e) => setPrepaymentDate(e.target.value)}
                  className="h-9 w-full rounded border border-border bg-surface px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 hover:border-ink-300"
                />
              </div>
              <ReadonlyMoney label="Advance (50%)" value={formatMoney(advance, contract.currency)} />
              <ReadonlyMoney label="Balance (50%)" value={formatMoney(balance, contract.currency)} />
              <ReadonlyText label="Prepayment line" value={prepaymentText} />
              <ReadonlyText label="Balance line" value={balanceText} />
            </CardContent>
          </Card>

          {/* Beneficiary bank — selector */}
          <Card>
            <CardHeader title="Beneficiary bank" description="Active banking profile injected into the bank block." />
            <CardContent className="space-y-3">
              <Select label="Banking profile" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                {banksForEntity.length === 0 && <option value="">No profile for this entity</option>}
                {banksForEntity.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
              {bankOption ? (
                <ProfileDetails
                  rows={[
                    ["Intermediary", `${bank.intermediaryBankName} (${bank.intermediaryBankSwift})`],
                    ["Bank", `${bank.bankName} (${bank.bankSwift})`],
                    ["Account", bank.accountNumber],
                    ["Beneficiary", bank.beneficiaryName],
                  ]}
                />
              ) : (
                <p className="text-xs text-danger">
                  No banking profile is seeded for {entity.name}. Select an entity that has one.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live summary + actions */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardHeader title="Summary" />
            <CardContent className="space-y-2.5 text-sm">
              <SummaryRow label="Sale total" value={formatMoney(financials.saleTotal, contract.currency)} strong />
              <SummaryRow label="Margin" value={formatMoney(financials.marginTotal, contract.currency)} />
              <SummaryRow label="Total costs" value={formatMoney(financials.totalCosts, contract.currency)} />
              <div className="border-t border-border pt-2.5">
                <SummaryRow label="Net profit" value={formatMoney(financials.netProfit, contract.currency)} accent />
              </div>
            </CardContent>
          </Card>

          {showErrors && errors.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Button onClick={handlePreview} variant="outline" className="w-full" disabled={generating}>
              {generating ? <Spinner size="sm" /> : <Eye className="h-4 w-4" />} Preview PDF
            </Button>
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={handleSave} variant="secondary" className="w-full" disabled={save.status === "saving"}>
              {save.status === "saving" ? <Spinner size="sm" /> : <Save className="h-4 w-4" />} Save to Trade Folder
            </Button>
            <p className="text-[11px] leading-relaxed text-ink-400">
              Preview &amp; download work offline. Saving needs the Supabase backend provisioned.
            </p>
          </div>

          {save.status === "saved" && (
            <p className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" /> Saved as {save.reference}
            </p>
          )}
          {save.status === "error" && (
            <p className="flex items-start gap-2 text-xs text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {save.message}
            </p>
          )}
        </div>
      </div>

      <Modal open={!!previewUrl} onClose={closePreview} title="Contract preview" size="lg">
        {previewUrl && <iframe src={previewUrl} title="Contract preview" className="h-[70vh] w-full rounded border border-border" />}
      </Modal>

      <AddClientModal
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onCreated={handleClientCreated}
      />
    </div>
  );
}

// ── Small field helpers ─────────────────────────────────────────────────────
function ProfileDetails({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="rounded border border-dashed border-ink-200 bg-ink-50 px-3 py-2.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 py-0.5">
          <dt className="w-28 shrink-0 text-ink-500">{k}</dt>
          <dd className="text-ink-700">{v || <span className="text-ink-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function NumberField({
  label,
  value,
  onChange,
  invalid,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  invalid?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-1", !compact && "sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4")}>
      <label className="text-sm font-medium text-ink-700">{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={cn(
          "h-9 w-full rounded border bg-surface px-3 font-mono text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
          invalid ? "border-danger" : "border-border hover:border-ink-300",
        )}
      />
    </div>
  );
}

function ReadonlyMoney({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
      <span className="text-sm font-medium text-ink-600">{label}</span>
      <span className="font-mono text-sm text-ink-500">{value}</span>
    </div>
  );
}

function ReadonlyText({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <span className="text-sm font-medium text-ink-600">{label}</span>
      <span className="rounded border border-dashed border-ink-200 bg-ink-50 px-3 py-1.5 text-sm text-ink-700">
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-ink-500", strong && "text-ink-700")}>{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          accent ? "text-base font-semibold text-brand-700" : strong ? "font-semibold text-ink-900" : "text-ink-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}
