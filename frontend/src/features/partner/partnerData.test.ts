import { describe, it, expect } from "vitest";
import { summarize, type PartnerTrade } from "./partnerData";

const t = (over: Partial<PartnerTrade>): PartnerTrade => ({
  id: "x", tradeRef: "r", client: "c", entity: "e", contractDate: "2026-01-01",
  signingDate: null, bolDate: null, status: "draft", advanceStatus: "pending", balanceStatus: "pending",
  frigoTotal: 0, saleTotal: 0, shipping: 0, insurance: 0, bankFees: 0, totalCosts: 0, netProfit: 0,
  ...over,
});

describe("partner portfolio summary", () => {
  it("aggregates totals, active count, and overdue milestones", () => {
    const trades = [
      t({ frigoTotal: 50000, netProfit: 4000, status: "active" }),
      t({ frigoTotal: 30000, netProfit: 2000, status: "shipped", balanceStatus: "overdue" }),
      t({ frigoTotal: 10000, netProfit: 1000, status: "balance_received", advanceStatus: "overdue" }),
      t({ frigoTotal: 5000, netProfit: 500, status: "draft" }),
    ];
    const s = summarize(trades);
    expect(s.totalTrades).toBe(4);
    expect(s.investedCapital).toBe(95000);
    expect(s.totalNetProfit).toBe(7500);
    expect(s.activeTrades).toBe(2); // active + shipped (not draft, not balance_received)
    expect(s.overdueMilestones).toBe(2);
  });
});
