import { describe, it, expect } from "vitest";
import { formatLatinNumber, parseLatinNumber } from "./finance";

describe("formatLatinNumber", () => {
  it("formats with Latin separators", () => {
    expect(formatLatinNumber(2310, 3)).toBe("2.310,000");
    expect(formatLatinNumber(62370, 2)).toBe("62.370,00");
    expect(formatLatinNumber(56700, 2)).toBe("56.700,00");
    expect(formatLatinNumber(300, 2)).toBe("300,00");
    expect(formatLatinNumber(0, 2)).toBe("0,00");
  });

  it("groups thousands for large numbers", () => {
    expect(formatLatinNumber(1234567.89, 2)).toBe("1.234.567,89");
  });

  it("round-trips with parseLatinNumber", () => {
    expect(parseLatinNumber(formatLatinNumber(60750, 2))).toBe(60750);
    expect(parseLatinNumber(formatLatinNumber(2100, 3))).toBe(2100);
  });
});
