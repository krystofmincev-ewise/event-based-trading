import { describe, expect, it } from "vitest";

import { finiteDomain, linearScale } from "../src/charts/chartUtils.js";

describe("chart domains", () => {
  it("keeps padded extreme finite wealth inside numeric range", () => {
    const [minimum, maximum] = finiteDomain([0, Number.MAX_VALUE]);
    expect(Number.isFinite(minimum)).toBe(true);
    expect(Number.isFinite(maximum)).toBe(true);
    expect(maximum).toBe(Number.MAX_VALUE);

    const scale = linearScale(minimum, maximum, 0, 920);
    expect(Number.isFinite(scale(0))).toBe(true);
    expect(Number.isFinite(scale(Number.MAX_VALUE))).toBe(true);
  });

  it("pads a constant maximum-value domain without overflowing", () => {
    const domain = finiteDomain([Number.MAX_VALUE, Number.MAX_VALUE]);
    expect(domain.every(Number.isFinite)).toBe(true);
    expect(domain[0]).toBeLessThan(domain[1]);
  });
});
