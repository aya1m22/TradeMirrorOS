import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Pencil, Trash2, AlertCircle, Star, Building2 } from "lucide-react";
import { Button, Card, CardHeader, CardContent, Spinner, EmptyState } from "@/components/ui";
import { entityService } from "@/features/entities/services/entityService";
import { bankProfileService } from "@/features/entities/services/bankProfileService";
import { EntityFormModal } from "./EntityFormModal";
import { BankProfileFormModal } from "./BankProfileFormModal";
import type { BankProfileRow, EntityRow } from "@/services/supabase";

export function EntitiesPage() {
  const queryClient = useQueryClient();
  const entitiesQ = useQuery({ queryKey: ["entities"], queryFn: () => entityService.list() });
  const banksQ = useQuery({ queryKey: ["bank_profiles"], queryFn: () => bankProfileService.list() });

  const [entityModal, setEntityModal] = useState<{ open: boolean; entity: EntityRow | null }>({ open: false, entity: null });
  const [bankModal, setBankModal] = useState<{ open: boolean; entityId: string; profile: BankProfileRow | null }>({
    open: false,
    entityId: "",
    profile: null,
  });
  const [actionError, setActionError] = useState("");

  const banksByEntity = useMemo(() => {
    const map = new Map<string, BankProfileRow[]>();
    for (const b of banksQ.data ?? []) {
      const arr = map.get(b.entity_id) ?? [];
      arr.push(b);
      map.set(b.entity_id, arr);
    }
    return map;
  }, [banksQ.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["entities"] });
    void queryClient.invalidateQueries({ queryKey: ["bank_profiles"] });
  };

  const guard = async (fn: () => Promise<void>, label: string) => {
    setActionError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? `${label}: ${e.message}` : label);
    }
  };

  const loading = entitiesQ.isLoading || banksQ.isLoading;
  const errored = entitiesQ.isError || banksQ.isError;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Settings</p>
          <h1 className="text-2xl font-semibold">Entities &amp; Banking</h1>
          <p className="text-ink-500">Company profiles and their beneficiary bank details.</p>
        </div>
        <Button onClick={() => setEntityModal({ open: true, entity: null })}>
          <Plus className="h-4 w-4" /> Add entity
        </Button>
      </header>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner /> Loading entities…
          </CardContent>
        </Card>
      )}

      {errored && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn't load entities or bank profiles.
        </div>
      )}

      {!loading && !errored && (entitiesQ.data ?? []).length === 0 && (
        <EmptyState
          icon={Landmark}
          title="No entities yet"
          description="Add your first company profile to act as the exporter on contracts."
          action={
            <Button onClick={() => setEntityModal({ open: true, entity: null })}>
              <Plus className="h-4 w-4" /> Add entity
            </Button>
          }
        />
      )}

      {!loading &&
        !errored &&
        (entitiesQ.data ?? []).map((entity) => {
          const banks = banksByEntity.get(entity.id) ?? [];
          return (
            <Card key={entity.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-ink-400" /> {entity.name}
                  </span>
                }
                description={`${entity.city}, ${entity.country} · RUC/EIN: ${entity.ruc_ein}`}
                action={
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEntityModal({ open: true, entity })}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => guard(() => entityService.remove(entity.id), `Couldn't delete ${entity.name}`)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-ink-700">Banking profiles</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBankModal({ open: true, entityId: entity.id, profile: null })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add bank profile
                  </Button>
                </div>
                {banks.length === 0 ? (
                  <p className="rounded border border-dashed border-border bg-surface-2 px-3 py-4 text-sm text-ink-500">
                    No banking profile for this entity yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded border border-border">
                    {banks.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-ink-800">
                            {b.profile_name}
                            {b.is_default && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brass-100 px-2 py-0.5 text-xs font-medium text-brass-700">
                                <Star className="h-3 w-3" /> Default
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {b.bank_name} ({b.bank_swift}) · Acct {b.account_number}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!b.is_default && (
                            <button
                              type="button"
                              onClick={() => guard(() => bankProfileService.setDefault(b.id, entity.id), "Couldn't set default")}
                              className="text-xs text-ink-500 transition-colors hover:text-brass-700"
                            >
                              Set default
                            </button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBankModal({ open: true, entityId: entity.id, profile: b })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => guard(() => bankProfileService.remove(b.id), "Couldn't delete profile")}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}

      <EntityFormModal
        open={entityModal.open}
        entity={entityModal.entity}
        onClose={() => setEntityModal({ open: false, entity: null })}
        onSaved={() => {
          setEntityModal({ open: false, entity: null });
          refresh();
        }}
      />
      <BankProfileFormModal
        open={bankModal.open}
        entityId={bankModal.entityId}
        profile={bankModal.profile}
        onClose={() => setBankModal({ open: false, entityId: "", profile: null })}
        onSaved={() => {
          setBankModal({ open: false, entityId: "", profile: null });
          refresh();
        }}
      />
    </div>
  );
}
