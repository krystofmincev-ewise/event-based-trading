import { describe, expect, it } from "vitest";

import { marketCloseIso } from "../src/time.js";

describe("market close cutoff", () => {
  it("accounts for New York daylight-saving time", () => {
    expect(marketCloseIso("2026-07-24")).toBe("2026-07-24T20:00:00.000Z");
    expect(marketCloseIso("2026-12-24")).toBe("2026-12-24T21:00:00.000Z");
  });
});
