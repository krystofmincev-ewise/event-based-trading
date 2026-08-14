import { describe, expect, it } from "vitest";

import { formatCurrencyPrecise, formatPercent } from "../src/lib/format.js";

describe("formatPercent", () => {
  it("renders capped finite growth as scientific overflow rather than zero", () => {
    expect(formatPercent(Number.MAX_VALUE)).toBe("1.8e+310%");
    expect(formatPercent(Number.NaN)).toBe("Overflow");
  });
});

describe("formatCurrencyPrecise", () => {
  it("keeps adjacent million-dollar histogram bounds distinguishable", () => {
    expect(formatCurrencyPrecise(1_000_000)).toBe("$1,000,000.00");
    expect(formatCurrencyPrecise(1_010_000)).toBe("$1,010,000.00");
  });
});
