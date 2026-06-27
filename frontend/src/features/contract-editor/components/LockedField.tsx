import { Lock, Pencil, Unlock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A back-to-back field mirrored from the supplier contract. Locked by default
 * (shown read-only with a "Mirrored from source" badge). The operator can
 * "Unlock field" to override just that field; the original value is preserved
 * for reference and the field is badged "Modified manually".
 */
export function LockedField({
  label,
  value,
  originalValue,
  unlocked,
  multiline,
  mono,
  suffix,
  reflectsInPdf = true,
  onUnlock,
  onReset,
  onChange,
}: {
  label: string;
  /** Current effective value (original unless overridden). */
  value: string;
  /** The mirrored-from-source value, kept for audit/reference. */
  originalValue: string;
  unlocked: boolean;
  multiline?: boolean;
  mono?: boolean;
  /** Static unit shown after the value (e.g. "Ton"). */
  suffix?: string;
  /** False for fields with no slot on this template (override recorded, not redrawn). */
  reflectsInPdf?: boolean;
  onUnlock: () => void;
  onReset: () => void;
  onChange: (value: string) => void;
}) {
  const isOverridden = value !== originalValue;

  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <span className="flex items-center gap-1.5 pt-2 text-sm font-medium text-ink-600">
        {unlocked ? (
          <Unlock className="h-3.5 w-3.5 text-brass-500" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-ink-400" />
        )}
        {label}
      </span>

      <div className="space-y-1.5">
        {!unlocked ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded border border-dashed border-ink-200 bg-ink-50 px-3 py-2">
              <span className={cn("text-sm text-ink-700", mono && "font-mono")}>
                {value ? `${value}${suffix ? ` ${suffix}` : ""}` : (
                  <span className="text-ink-400">Not specified</span>
                )}
              </span>
              <button
                type="button"
                onClick={onUnlock}
                className="flex shrink-0 items-center gap-1 text-xs text-brass-600 transition-colors hover:text-brass-700"
              >
                <Unlock className="h-3 w-3" /> Unlock field
              </button>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-ink-400">
              <Lock className="h-3 w-3" /> Mirrored from source
            </span>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2">
              {multiline ? (
                <textarea
                  rows={3}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className={cn(
                    "w-full resize-y rounded border border-brass-300 bg-surface px-3 py-2 text-sm leading-relaxed text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                    mono && "font-mono",
                  )}
                />
              ) : (
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className={cn(
                    "h-9 w-full rounded border border-brass-300 bg-surface px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                    mono && "font-mono",
                  )}
                />
              )}
              {suffix && <span className="pt-2 text-sm text-ink-500">{suffix}</span>}
              <button
                type="button"
                onClick={onReset}
                title="Reset to source value and relock"
                className="flex shrink-0 items-center gap-1 pt-2 text-xs text-ink-500 transition-colors hover:text-ink-800"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {isOverridden && (
                <span className="inline-flex items-center gap-1 text-xs text-info">
                  <Pencil className="h-3 w-3" /> Modified manually
                </span>
              )}
              <span className="text-xs text-ink-400">Original: {originalValue || "—"}</span>
              {isOverridden && !reflectsInPdf && (
                <span className="text-xs text-warning">Recorded only — stays as source on the page</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
