import type { MilestoneStatus } from "@/services/supabase";

/**
 * Milestone helpers (PRD §9.2 / §11): the advance is due 7 days after the
 * signing date, the balance 7 days after the BOL date. A milestone not marked
 * received by its deadline reads as overdue. (Persisting "overdue" to the row is
 * the milestone-alerts cron's job; this computes the display state live.)
 */
export type MilestonePhase = "pending" | "received" | "overdue";

export const MILESTONE_DAYS = 7;

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

export function deadlineFrom(iso: string | null, days = MILESTONE_DAYS): Date | null {
  return iso ? addDays(iso, days) : null;
}

export function milestonePhase(status: MilestoneStatus, deadline: Date | null): MilestonePhase {
  if (status === "received") return "received";
  if (deadline && Date.now() > deadline.getTime()) return "overdue";
  return "pending";
}

export const MILESTONE_BADGE: Record<MilestonePhase, string> = {
  pending: "bg-ink-100 text-ink-600",
  received: "bg-success/10 text-success",
  overdue: "bg-danger/10 text-danger",
};

export const MILESTONE_LABEL: Record<MilestonePhase, string> = {
  pending: "Pending",
  received: "Received",
  overdue: "Overdue",
};
