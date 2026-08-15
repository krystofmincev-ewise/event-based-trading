import { describe, expect, it } from "vitest";

import {
  bootstrapMeanInterval,
  brierScore,
  logLoss,
  wilsonInterval,
} from "../src/statistics.js";

describe("event-edge statistics", () => {
  it("scores calibrated binary forecasts", () => {
    expect(brierScore(0.8, true)).toBeCloseTo(0.04);
    expect(logLoss(0.8, true)).toBeCloseTo(-Math.log(0.8));
  });

  it("returns bounded Wilson intervals", () => {
    const [lower, upper] = wilsonInterval(15, 20);
    expect(lower).toBeGreaterThan(0.5);
    expect(upper).toBeLessThanOrEqual(1);
  });

  it("uses deterministic bootstrap intervals", () => {
    expect(bootstrapMeanInterval([1, 2, 3], 100, 7)).toEqual(
      bootstrapMeanInterval([1, 2, 3], 100, 7),
    );
  });
});
