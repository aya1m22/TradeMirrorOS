import type { TradeStatus } from "@/services/supabase";

/**
 * Phase-2 display phases. The database `trade_status` enum is richer (it carries
 * the milestone state machine for later phases); the Trade Dashboard collapses it
 * into three user-facing phases for display and filtering. Read-only mapping — no
 * change to stored values or Phase-1 behavior.
 */
export type TradePhase = "draft" | "processing" | "completed";

export const TRADE_PHASES: { value: TradePhase; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
];

/** Collapse the stored trade_status into one of the three Phase-2 phases. */
export function toTradePhase(status: TradeStatus): TradePhase {
  if (status === "draft") return "draft";
  if (status === "balance_received") return "completed";
  return "processing"; // active, advance_received, shipped, overdue
}

export function tradePhaseLabel(status: TradeStatus): string {
  const phase = toTradePhase(status);
  return TRADE_PHASES.find((p) => p.value === phase)!.label;
}

export const PHASE_BADGE: Record<TradePhase, string> = {
  draft: "bg-ink-100 text-ink-600",
  processing: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

/**
 * Badge for a trade's status, surfacing "Overdue" distinctly (PRD §11.2 in-app
 * alert on the relevant trade record) while collapsing the rest to the 3 phases.
 */
export function statusBadge(status: TradeStatus): { label: string; classes: string } {
  if (status === "overdue") return { label: "Overdue", classes: "bg-danger/10 text-danger" };
  return { label: tradePhaseLabel(status), classes: PHASE_BADGE[toTradePhase(status)] };
}
