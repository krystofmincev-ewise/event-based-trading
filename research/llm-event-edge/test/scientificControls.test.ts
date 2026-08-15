import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertArtifactHash,
  assertExactCoverage,
  assertUniqueValues,
} from "../src/artifactControls.js";
import type { EventCase, HistoricalMetric, SecFiling } from "../src/domain.js";
import {
  buildMacOsSeatbeltProfile,
  cacheMatchesProvenance,
} from "../src/forecastExecutionControls.js";
import { buildForecastPacket } from "../src/forecastPacket.js";

const metric = (filedAt: string, value: number): HistoricalMetric => ({
  period: "Q2",
  endDate: "2026-06-01",
  filedAt,
  value,
  unit: "USD",
  form: "10-Q",
});

const filing = (acceptedAt: string, accessionNumber: string): SecFiling => ({
  accessionNumber,
  acceptedAt,
  filingDate: acceptedAt.slice(0, 10),
  form: "10-Q",
  items: "",
  primaryDocument: "report.htm",
});

const eventCase = (): EventCase => ({
  id: "study:TEST:2026-06-15",
  studyId: "study",
  ticker: "TEST",
  companyName: "Test Company",
  cik: 1,
  marketCapUsd: 9_000_000_000,
  capitalizationId: "mid",
  nasdaqSector: "Technology",
  industry: "Software",
  sectorIds: ["information-technology"],
  eventType: "earnings",
  eventDate: "2026-06-15",
  acceptedAt: "2026-06-15T20:05:00.000Z",
  eventSession: "after-market",
  informationCutoff: "2026-06-12T20:00:00.000Z",
  filing: filing("2026-06-15T20:05:00.000Z", "event"),
  consensusEps: 1.25,
  estimateCount: 12,
  actualEps: 1.5,
  surprisePercent: 20,
  fundamentals: {
    revenue: [metric("2026-06-11", 100), metric("2026-06-12", 999)],
    dilutedEps: [metric("2026-06-10", 1), metric("2026-06-13", 2)],
    netIncome: [metric("2026-06-01", 10)],
    researchAndDevelopment: [metric("2026-06-15", 20)],
  },
  priorFilings: [
    filing("2026-06-11T18:00:00.000Z", "prior"),
    filing("2026-06-12T21:00:00.000Z", "post-cutoff"),
  ],
  marketFeatures: {
    entryDate: "2026-06-12",
    entryClose: 10,
    trailingReturn5d: 0.01,
    trailingReturn20d: 0.02,
    trailingReturn60d: 0.03,
    realizedVolatility20d: 0.4,
    realizedVolatility60d: 0.35,
    drawdownFrom60dHigh: -0.1,
    benchmarkTrailingReturn20d: 0.01,
  },
  outcome: {
    settlement1dDate: "2026-06-16",
    settlement1dClose: 12,
    return1d: 0.2,
    benchmarkReturn1d: 0.01,
    marketAdjustedReturn1d: 0.19,
    settlement10dDate: null,
    settlement10dClose: null,
    return10d: null,
    benchmarkReturn10d: null,
    marketAdjustedReturn10d: null,
    settlement40dDate: null,
    settlement40dClose: null,
    return40d: null,
    benchmarkReturn40d: null,
    marketAdjustedReturn40d: null,
  },
  sources: [],
  outcomeSources: [],
  retrospectiveQuality: "reconstructed-point-in-time",
});

describe("forecast packet leakage boundary", () => {
  it("emits only allowed fields and filters observations at or after the cutoff", () => {
    const input = Object.assign(eventCase(), {
      unreleasedInternalNote: "must never reach the model",
    });

    const packet = buildForecastPacket(input, "information-technology");
    const serialized = JSON.parse(JSON.stringify(packet)) as Record<
      string,
      unknown
    >;

    expect(packet.consensusEps).toBeNull();
    expect(packet.estimateCount).toBeNull();
    expect(packet.fundamentals.revenue.map(({ value }) => value)).toEqual([
      100,
    ]);
    expect(packet.fundamentals.dilutedEps.map(({ value }) => value)).toEqual([
      1,
    ]);
    expect(packet.fundamentals.researchAndDevelopment).toEqual([]);
    expect(
      packet.priorFilings.map(({ accessionNumber }) => accessionNumber),
    ).toEqual(["prior"]);
    expect(packet.sourceUrls).toHaveLength(1);
    expect(serialized).not.toHaveProperty("outcome");
    expect(serialized).not.toHaveProperty("actualEps");
    expect(serialized).not.toHaveProperty("surprisePercent");
    expect(serialized).not.toHaveProperty("marketCapUsd");
    expect(serialized).not.toHaveProperty("capitalizationId");
    expect(serialized).not.toHaveProperty("unreleasedInternalNote");
  });
});

describe("forecast cache provenance", () => {
  const expected = {
    id: "technology:0:analyst-1",
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
    promptHash: "prompt-hash",
    provenance: {
      cliVersion: "codex-cli 1",
      schemaSha256: "schema-hash",
      isolationPolicy: "seatbelt-v2",
    },
  };
  const validCache = {
    id: expected.id,
    model: expected.model,
    reasoningEffort: expected.reasoningEffort,
    promptHash: expected.promptHash,
    cliVersion: expected.provenance.cliVersion,
    schemaSha256: expected.provenance.schemaSha256,
    isolationPolicy: expected.provenance.isolationPolicy,
    nodeGeneratedAt: "2026-08-15T12:00:00.000Z",
    forecasts: [],
  };

  it("accepts an exact cache identity", () => {
    expect(cacheMatchesProvenance(validCache, expected)).toBe(true);
  });

  it.each([
    "id",
    "model",
    "reasoningEffort",
    "promptHash",
    "cliVersion",
    "schemaSha256",
    "isolationPolicy",
  ] as const)("invalidates a cache when %s changes", (field) => {
    expect(
      cacheMatchesProvenance({ ...validCache, [field]: "changed" }, expected),
    ).toBe(false);
  });

  it("rejects malformed and timestamp-less cache values", () => {
    expect(cacheMatchesProvenance(null, expected)).toBe(false);
    const timestampLess: Record<string, unknown> = { ...validCache };
    delete timestampLess.nodeGeneratedAt;
    expect(cacheMatchesProvenance(timestampLess, expected)).toBe(false);
  });
});

describe("frozen artifact controls", () => {
  it("requires exact hashes unless an optional predecessor is absent", () => {
    expect(() => assertArtifactHash("abc", "abc", "Ledger")).not.toThrow();
    expect(() => assertArtifactHash("abc", "def", "Ledger")).toThrow(
      "Ledger does not match its manifest.",
    );
    expect(() => assertArtifactHash("abc", undefined, "Ledger")).toThrow();
    expect(() =>
      assertArtifactHash("abc", undefined, "Ledger", {
        allowMissingExpected: true,
      }),
    ).not.toThrow();
  });

  it("rejects duplicate ledger IDs", () => {
    expect(() => assertUniqueValues(["a", "b"], "Ledger")).not.toThrow();
    expect(() => assertUniqueValues(["a", "a"], "Ledger")).toThrow(
      "Ledger contains duplicate IDs.",
    );
  });

  it("requires duplicate-free, exact coverage on both sides", () => {
    expect(() =>
      assertExactCoverage(["b", "a"], ["a", "b"], "Forecast"),
    ).not.toThrow();
    for (const [actual, expected] of [
      [["a"], ["a", "b"]],
      [
        ["a", "c"],
        ["a", "b"],
      ],
      [["a", "a"], ["a"]],
      [["a"], ["a", "a"]],
    ] as const) {
      expect(() => assertExactCoverage(actual, expected, "Forecast")).toThrow(
        "Forecast coverage or uniqueness check failed.",
      );
    }
  });
});

describe("macOS Seatbelt profile", () => {
  it("escapes literals and preserves the deny-first isolation rules", () => {
    const profile = buildMacOsSeatbeltProfile({
      originalHome: '/Users/test/quoted"home',
      temporaryDirectory: "/private/tmp/eval",
      allowedExecutable: "/usr/bin/codex",
    });

    expect(profile).toContain(
      '(deny file-read* file-write* (subpath "/Users/test/quoted\\"home"))',
    );
    expect(profile).toContain(
      '(allow file-read* file-write* (subpath "/private/tmp/eval"))',
    );
    expect(profile).toContain("(deny process-exec)");
    expect(profile).toContain(
      '(allow process-exec (literal "/usr/bin/codex"))',
    );
  });

  it.skipIf(process.platform !== "darwin")(
    "allows reads in the evaluation directory and denies reads in the original home",
    async () => {
      const originalHome = process.env.HOME;
      if (originalHome === undefined) throw new Error("HOME is required.");
      const protectedPath = resolve(process.cwd(), "package.json");
      expect(protectedPath.startsWith(`${originalHome}/`)).toBe(true);
      const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "event-edge-seatbelt-test-"),
      );
      const allowedPath = join(temporaryDirectory, "allowed.txt");
      await writeFile(allowedPath, "allowed", "utf8");
      const catExecutable = await realpath("/bin/cat");
      const profile = buildMacOsSeatbeltProfile({
        originalHome,
        temporaryDirectory,
        allowedExecutable: catExecutable,
      });

      try {
        const allowed = spawnSync(
          "/usr/bin/sandbox-exec",
          ["-p", profile, catExecutable, allowedPath],
          { encoding: "utf8" },
        );
        expect(allowed.status, allowed.stderr).toBe(0);
        expect(allowed.stdout).toBe("allowed");

        const denied = spawnSync(
          "/usr/bin/sandbox-exec",
          ["-p", profile, catExecutable, protectedPath],
          { encoding: "utf8" },
        );
        expect(denied.status).not.toBe(0);
        expect(await readFile(allowedPath, "utf8")).toBe("allowed");
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    },
  );
});
