import { describe, expect, it } from "vitest";

import { parseCompanyFacts } from "../src/providers/sec.js";

const fact = (filed: string, value: number) => ({
  frame: "CY2026Q2",
  end: "2026-06-30",
  filed,
  form: "10-Q",
  val: value,
});

describe("SEC point-in-time filtering", () => {
  it("excludes facts filed on the event date when acceptance time is unavailable", () => {
    const body = JSON.stringify({
      facts: {
        "us-gaap": {
          Revenues: {
            units: {
              USD: [fact("2026-07-23", 10), fact("2026-07-24", 20)],
            },
          },
        },
      },
    });

    expect(
      parseCompanyFacts(body, "2026-07-24T16:05:00-04:00").revenue,
    ).toEqual([expect.objectContaining({ filedAt: "2026-07-23", value: 10 })]);
  });
});
