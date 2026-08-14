import { describe, expect, it } from "vitest";

import { hashSeed, randomAt } from "../src/index.js";

describe("counter PRNG", () => {
  it("has a stable golden vector", () => {
    const seed = hashSeed("golden-seed");
    expect([
      randomAt(seed, 0, 0),
      randomAt(seed, 3, 9),
      randomAt(seed, 99, 1),
    ]).toEqual([0.50083768425975, 0.8691358544165269, 0.4367495145415887]);
  });

  it("is independent of traversal order", () => {
    const seed = hashSeed("order");
    expect(randomAt(seed, 2, 8)).toBe(randomAt(seed, 2, 8));
    expect(randomAt(seed, 2, 8)).not.toBe(randomAt(seed, 8, 2));
  });
});
