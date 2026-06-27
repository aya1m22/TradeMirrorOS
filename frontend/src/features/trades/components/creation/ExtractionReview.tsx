import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, CircleHelp, Pencil, Lock } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ExtractedFieldKey, ExtractionResult } from "@/core/pdf-engine/parse";
import { REVIEW_FIELDS, type ReviewFieldConfig } from "./reviewFields";

type DisplayStatus = "extracted" | "uncertain" | "missing" | "edited";

interface FieldState {
  value: string;
  status: DisplayStatus;
  note?: string;
}

type FormState = Record<ExtractedFieldKey, FieldState>;

export function ExtractionReview({
  result,
  manual,
  onBack,
  onConfirm,
}: {
  result: ExtractionResult;
  manual?: boolean;
  onBack: () => void;
  onConfirm: (values: Record<ExtractedFieldKey, string>) => void;
}) {
  const [form, setForm] = useState<FormState>(
    () =>
      Object.fromEntries(
        Object.entries(result.contract).map(([k, f]) => [
          k,
          { value: f.value, status: f.status as DisplayStatus, note: f.note },
        ]),
      ) as FormState,
  );
  const [showErrors, setShowErrors] = useState(false);

  // Pure-mirror fields are locked once extracted; in manual mode everything is editable.
  const isLocked = (cfg: ReviewFieldConfig) => !!cfg.pureMirror && !manual;

  const update = (key: ExtractedFieldKey, value: string) =>
    setForm((s) => ({ ...s, [key]: { ...s[key], value, status: "edited" } }));

  const missingRequired = useMemo(
    () =>
      REVIEW_FIELDS.filter((f) => f.required && !isLocked(f) && !form[f.key].value.trim()).map(
        (f) => f.key,
      ),
    [form, manual],
  );

  const counts = useMemo(() => {
    const editable = REVIEW_FIELDS.filter((f) => !isLocked(f));
    return {
      review: editable.filter(
        (f) => form[f.key].status === "uncertain" || form[f.key].status === "missing",
      ).length,
      total: REVIEW_FIELDS.length,
    };
  }, [form, manual]);

  const handleConfirm = () => {
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    const values = Object.fromEntries(
      Object.entries(form).map(([k, f]) => [k, f.value]),
    ) as Record<ExtractedFieldKey, string>;
    onConfirm(values);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          ← Upload a different file
        </button>
        <h1 className="text-2xl font-semibold">Review extracted contract</h1>
        <p className="text-ink-500">
          {manual
            ? "Extraction couldn't read this file, so the fields are blank. Enter the details below."
            : "Pure-mirror fields are locked (copied verbatim from the source). Check the rest, then confirm."}
        </p>
      </header>

      <SummaryBar review={counts.review} total={counts.total} manual={manual} />

      <Card>
        <CardContent className="space-y-5">
          {REVIEW_FIELDS.map((cfg) => (
            <FieldRow
              key={cfg.key}
              label={cfg.label}
              required={cfg.required}
              multiline={cfg.multiline}
              mono={cfg.mono}
              locked={isLocked(cfg)}
              state={form[cfg.key]}
              invalid={showErrors && missingRequired.includes(cfg.key)}
              onChange={(v) => update(cfg.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {missingRequired.length > 0 && showErrors
            ? `${missingRequired.length} required field(s) still empty.`
            : "Confirm to build the company contract."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleConfirm}>Confirm details</Button>
        </div>
      </div>
    </div>
  );
}

function SummaryBar({
  review,
  total,
  manual,
}: {
  review: number;
  total: number;
  manual?: boolean;
}) {
  if (manual) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink-700">
        <Pencil className="h-4 w-4 text-warning" />
        Manual entry — nothing was extracted from this file.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-ink-700">
      <CheckCircle2 className="h-4 w-4 text-success" />
      {total - review} of {total} fields extracted
      {review > 0 && <span className="text-ink-500">· {review} need review</span>}
    </div>
  );
}

const STATUS_META: Record<
  DisplayStatus,
  { icon: typeof CheckCircle2; tint: string; label: string } | null
> = {
  extracted: { icon: CheckCircle2, tint: "text-success", label: "Extracted" },
  uncertain: { icon: AlertTriangle, tint: "text-warning", label: "Check this" },
  missing: { icon: CircleHelp, tint: "text-warning", label: "Add manually" },
  edited: { icon: Pencil, tint: "text-info", label: "Edited" },
};

function FieldRow({
  label,
  required,
  multiline,
  mono,
  locked,
  state,
  invalid,
  onChange,
}: {
  label: string;
  required: boolean;
  multiline?: boolean;
  mono?: boolean;
  locked?: boolean;
  state: FieldState;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  // Pure-mirror: read-only display, no review prompts.
  if (locked) {
    return (
      <div className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:items-start sm:gap-4">
        <label className="flex items-center gap-1.5 pt-2 text-sm font-medium text-ink-600">
          <Lock className="h-3.5 w-3.5 text-ink-400" />
          {label}
        </label>
        <div className="space-y-1">
          <div
            className={cn(
              "rounded border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700",
              mono && "font-mono",
            )}
          >
            {state.value || <span className="text-ink-400">Not specified in source</span>}
          </div>
          <span className="text-xs text-ink-400">Locked · mirrored from source</span>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[state.status];
  const needsAttention = state.status === "uncertain" || state.status === "missing";

  const inputClass = cn(
    "w-full rounded border bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400",
    "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
    mono && "font-mono",
    invalid
      ? "border-danger focus-visible:ring-danger/30"
      : needsAttention
        ? "border-warning/50 bg-warning/5"
        : "border-border hover:border-ink-300",
  );

  return (
    <div className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:items-start sm:gap-4">
      <label className="flex items-center gap-1 pt-2 text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      <div className="space-y-1">
        {multiline ? (
          <textarea
            rows={3}
            value={state.value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
        ) : (
          <input
            type="text"
            value={state.value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          {meta && (
            <span className={cn("flex items-center gap-1 text-xs", meta.tint)}>
              <meta.icon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
          )}
          {invalid && <span className="text-xs text-danger">Required</span>}
        </div>
        {needsAttention && state.note && <p className="text-xs text-ink-500">{state.note}</p>}
      </div>
    </div>
  );
}
