import { describe, it, expect } from "vitest";
import { toTradePhase, tradePhaseLabel, TRADE_PHASES } from "./tradeStatus";

describe("trade status mapping", () => {
  it("maps the stored enum into the three display phases", () => {
    expect(toTradePhase("draft")).toBe("draft");
    expect(toTradePhase("balance_received")).toBe("completed");
    for (const s of ["active", "advance_received", "shipped", "overdue"] as const) {
      expect(toTradePhase(s)).toBe("processing");
    }
  });

  it("exposes exactly Draft / Processing / Completed", () => {
    expect(TRADE_PHASES.map((p) => p.label)).toEqual(["Draft", "Processing", "Completed"]);
  });

  it("labels statuses for display", () => {
    expect(tradePhaseLabel("draft")).toBe("Draft");
    expect(tradePhaseLabel("shipped")).toBe("Processing");
    expect(tradePhaseLabel("balance_received")).toBe("Completed");
  });
});
