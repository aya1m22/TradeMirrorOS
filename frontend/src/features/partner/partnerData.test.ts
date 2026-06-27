import { describe, it, expect } from "vitest";
import { summarize, type PartnerTrade } from "./partnerData";

const t = (over: Partial<PartnerTrade>): PartnerTrade => ({
  id: "x", tradeRef: "r", client: "c", entity: "e", contractDate: "2026-01-01",
  signingDate: null, bolDate: null, status: "draft", advanceStatus: "pending", balanceStatus: "pending",
  netProfit: 0,
  ...over,
});

describe("partner portfolio summary", () => {
  it("aggregates totals, active count, and overdue milestones (net profit only)", () => {
    const trades = [
      t({ netProfit: 4000, status: "active" }),
      t({ netProfit: 2000, status: "shipped", balanceStatus: "overdue" }),
      t({ netProfit: 1000, status: "balance_received", advanceStatus: "overdue" }),
      t({ netProfit: 500, status: "draft" }),
    ];
    const s = summarize(trades);
    expect(s.totalTrades).toBe(4);
    expect(s.totalNetProfit).toBe(7500);
    expect(s.activeTrades).toBe(2); // active + shipped (not draft, not balance_received)
    expect(s.overdueMilestones).toBe(2);
  });
});
