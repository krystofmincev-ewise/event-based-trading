import { describe, expect, it } from "vitest";

import { updateLogCapital } from "../src/index.js";

describe("bankroll transitions", () => {
  it("uses net-profit win and full-stake loss multipliers", () => {
    const start = Math.log(1_000);
    expect(updateLogCapital(start, true, 0.1, 2).capital).toBeCloseTo(
      1_200,
      10,
    );
    expect(updateLogCapital(start, false, 0.1, 2).capital).toBeCloseTo(900, 10);
  });

  it("only produces literal zero for a full-fraction loss", () => {
    expect(
      updateLogCapital(Math.log(1_000), false, 0.999, 1).capital,
    ).toBeGreaterThan(0);
    expect(updateLogCapital(Math.log(1_000), false, 1, 1)).toMatchObject({
      capital: 0,
      literalZero: true,
    });
  });
});
