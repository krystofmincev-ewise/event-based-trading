import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  DailyPrice,
  EventOutcome,
  EventSession,
  PreEventMarketFeatures,
  SectorId,
  SourceReference,
} from "./domain.js";
import { SECTOR_IDS } from "./domain.js";
import { marketAndOutcome } from "./ingest.js";
import {
  DATA_ROOT,
  mapWithConcurrency,
  sha256,
  writeJson,
  writeText,
} from "./io.js";
import { asRecord, asString, optionalNumber } from "./parse.js";
import { fetchNasdaqPrices, parsePrices } from "./providers/nasdaq.js";
import { brierScore, mean, rocAuc } from "./statistics.js";
import {
  prequentialVolatilityProbabilities,
  probabilityAbsoluteNormalMove,
  purgedCrossFittedVolatilityProbabilities,
} from "./volatilityBaseline.js";

type OutcomeId =
  | "up-1d"
  | "up-10d"
  | "absolute-2pct-1d"
  | "absolute-5pct-1d"
  | "absolute-5pct-10d"
  | "up-40d"
  | "absolute-10pct-40d";

interface PublicCase {
  id: string;
  ticker: string;
  eventDate: string;
  eventSession: EventSession;
  sectorIds: SectorId[];
  return1d: number;
  return10d: number | null;
  return40d: number | null;
}

interface PublicForecast {
  caseId: string;
  sectorId: SectorId;
  probabilities: Record<OutcomeId, number>;
}

interface FeatureResult {
  eventCase: PublicCase;
  market: PreEventMarketFeatures;
  outcome: EventOutcome;
  source: PriceSourceReference;
}

interface FeatureError {
  eventCase: PublicCase;
  error: string;
}

interface PriceSourceReference extends SourceReference {
  retrievalTimestampQuality: "fetch-completion" | "cache-file-mtime";
}

interface TargetDefinition {
  id: OutcomeId;
  actual: (eventCase: PublicCase) => boolean | null;
}

const TARGETS: TargetDefinition[] = [
  {
    id: "up-1d",
    actual: ({ return1d }) => return1d > 0,
  },
  {
    id: "up-10d",
    actual: ({ return10d }) => (return10d === null ? null : return10d > 0),
  },
  {
    id: "absolute-2pct-1d",
    actual: ({ return1d }) => Math.abs(return1d) >= 0.02,
  },
  {
    id: "absolute-5pct-1d",
    actual: ({ return1d }) => Math.abs(return1d) >= 0.05,
  },
  {
    id: "absolute-5pct-10d",
    actual: ({ return10d }) =>
      return10d === null ? null : Math.abs(return10d) >= 0.05,
  },
  {
    id: "up-40d",
    actual: ({ return40d }) => (return40d === null ? null : return40d > 0),
  },
  {
    id: "absolute-10pct-40d",
    actual: ({ return40d }) =>
      return40d === null ? null : Math.abs(return40d) >= 0.1,
  },
];

const numberField = (
  row: Record<string, unknown>,
  field: string,
  context: string,
): number => {
  const value = optionalNumber(row[field]);
  if (value === null) throw new Error(`${context}.${field} must be numeric.`);
  return value;
};

const nullableNumberField = (
  row: Record<string, unknown>,
  field: string,
): number | null => optionalNumber(row[field]);

const parseCase = (value: unknown): PublicCase => {
  const row = asRecord(value, "Public case");
  const eventSession = asString(row.eventSession, "eventSession");
  if (eventSession !== "before-market" && eventSession !== "after-market") {
    throw new Error(`Unsupported event session: ${eventSession}`);
  }
  if (!Array.isArray(row.sectorIds)) {
    throw new Error("sectorIds must be an array.");
  }
  const sectorIds = row.sectorIds.map((sector) => {
    const candidate = asString(sector, "sectorId");
    if (!SECTOR_IDS.some((sectorId) => sectorId === candidate)) {
      throw new Error(`Unsupported sector: ${candidate}`);
    }
    return candidate as SectorId;
  });
  return {
    id: asString(row.id, "id"),
    ticker: asString(row.ticker, "ticker"),
    eventDate: asString(row.eventDate, "eventDate"),
    eventSession,
    sectorIds,
    return1d: numberField(row, "return1d", "Public case"),
    return10d: nullableNumberField(row, "return10d"),
    return40d: nullableNumberField(row, "return40d"),
  };
};

const parseForecast = (value: unknown): PublicForecast => {
  const row = asRecord(value, "Public forecast");
  const sectorId = asString(row.sectorId, "sectorId");
  if (!SECTOR_IDS.some((candidate) => candidate === sectorId)) {
    throw new Error(`Unsupported sector: ${sectorId}`);
  }
  return {
    caseId: asString(row.caseId, "caseId"),
    sectorId: sectorId as SectorId,
    probabilities: {
      "up-1d": numberField(row, "probabilityUp1d", "Public forecast"),
      "up-10d": numberField(row, "probabilityUp10d", "Public forecast"),
      "absolute-2pct-1d": numberField(
        row,
        "probabilityAbsolute2Percent1d",
        "Public forecast",
      ),
      "absolute-5pct-1d": numberField(
        row,
        "probabilityAbsolute5Percent1d",
        "Public forecast",
      ),
      "absolute-5pct-10d": numberField(
        row,
        "probabilityAbsolute5Percent10d",
        "Public forecast",
      ),
      "up-40d": numberField(row, "probabilityUp40d", "Public forecast"),
      "absolute-10pct-40d": numberField(
        row,
        "probabilityAbsolute10Percent40d",
        "Public forecast",
      ),
    },
  };
};

const parseJsonLines = <Value>(
  body: string,
  parser: (value: unknown) => Value,
): Value[] =>
  body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parser(JSON.parse(line) as unknown));

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isMissingFile = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const safeFileName = (value: string) => value.replaceAll(/[^A-Z0-9.-]/gi, "_");

const parseNasdaqSource = (value: unknown): PriceSourceReference => {
  const row = asRecord(value, "Nasdaq source reference");
  const provider = asString(row.provider, "provider");
  if (provider !== "nasdaq") {
    throw new Error(`Unsupported price source provider: ${provider}`);
  }
  const retrievalTimestampQuality = row.retrievalTimestampQuality;
  if (
    retrievalTimestampQuality !== undefined &&
    retrievalTimestampQuality !== "fetch-completion" &&
    retrievalTimestampQuality !== "cache-file-mtime"
  ) {
    throw new Error("retrievalTimestampQuality is unsupported.");
  }
  return {
    provider,
    url: asString(row.url, "url"),
    retrievedAt: asString(row.retrievedAt, "retrievedAt"),
    sha256: asString(row.sha256, "sha256"),
    retrievalTimestampQuality: retrievalTimestampQuality ?? "fetch-completion",
  };
};

const historicalPriceUrl = (
  symbol: string,
  assetClass: "stocks" | "etf",
  fromDate: string,
  toDate: string,
) =>
  `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=${assetClass}&fromdate=${fromDate}&todate=${toDate}&limit=5000`;

const loadPrices = async (
  symbol: string,
  assetClass: "stocks" | "etf",
  fromDate: string,
  toDate: string,
): Promise<{
  prices: DailyPrice[];
  downloaded: boolean;
  source: PriceSourceReference;
}> => {
  const cachePath = resolve(
    DATA_ROOT,
    "raw",
    "volatility-baseline-v2",
    `${safeFileName(symbol)}_${fromDate}_${toDate}.json`,
  );
  const sourcePath = cachePath.replace(/\.json$/, ".source.json");
  try {
    const body = await readFile(cachePath, "utf8");
    const prices = parsePrices(body);
    try {
      const source = parseNasdaqSource(
        JSON.parse(await readFile(sourcePath, "utf8")) as unknown,
      );
      if (sha256(body) !== source.sha256) {
        throw new Error(`Cached body hash mismatch for ${symbol}.`);
      }
      return { prices, downloaded: false, source };
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      const source: PriceSourceReference = {
        provider: "nasdaq",
        url: historicalPriceUrl(symbol, assetClass, fromDate, toDate),
        retrievedAt: (await stat(cachePath)).mtime.toISOString(),
        sha256: sha256(body),
        retrievalTimestampQuality: "cache-file-mtime",
      };
      await writeJson(sourcePath, source);
      return { prices, downloaded: false, source };
    }
  } catch {
    const result = await fetchNasdaqPrices(
      symbol,
      assetClass,
      fromDate,
      toDate,
    );
    await writeText(cachePath, result.body);
    const source: PriceSourceReference = {
      ...result.source,
      retrievalTimestampQuality: "fetch-completion",
    };
    await writeJson(sourcePath, source);
    return {
      prices: result.value,
      downloaded: true,
      source,
    };
  }
};

const format = (value: number, digits = 4) =>
  Number.isFinite(value) ? value.toFixed(digits) : "n/a";

const renderMarkdown = (report: {
  generatedAt: string;
  coverage: {
    eligibleCases: number;
    featureCases: number;
    missingTickers: string[];
    sourceInputCount: number;
    exactFetchTimestampInputs: number;
    reconstructedFileMtimeInputs: number;
    sourceManifestSha256: string;
  };
  multiplicityAudit: Array<{
    outcomeId: OutcomeId;
    sampleSize: number;
    distinctEventDates: number;
    improvementVsFiftyPercent: number;
  }>;
  magnitude10d: {
    sampleSize: number;
    observedFrequency: number;
    distinctEventDates: number;
    llmBrier: number;
    llmAuc: number;
    normalRv20Brier: number;
    normalRv20Auc: number;
    prequentialRv20Brier: number;
    prequentialRv20Auc: number;
    purgedCrossFittedRv20Brier: number;
    purgedCrossFittedRv20Auc: number;
    llmImprovementVsNormalRv20: number;
    llmImprovementVsPrequentialRv20: number;
    llmImprovementVsPurgedCrossFittedRv20: number;
  };
}) => {
  const rows = report.multiplicityAudit
    .map(
      (row) =>
        `| ${row.outcomeId} | ${row.sampleSize} | ${row.distinctEventDates} | ${format(row.improvementVsFiftyPercent)} |`,
    )
    .join("\n");
  const magnitude = report.magnitude10d;
  return `# V1 volatility-baseline audit

Generated: ${report.generatedAt}

## Decision

**No demonstrated LLM-specific edge and no option-return claim.** The previously highlighted 10-session magnitude forecast was selected after inspecting several outcomes, is concentrated on a small number of event dates, and used realized volatility in the model packet. This audit compares it descriptively with deterministic point-in-time volatility rivals.

Feature reconstruction succeeded for ${report.coverage.featureCases}/${report.coverage.eligibleCases} mature cases. Missing tickers: ${report.coverage.missingTickers.length === 0 ? "none" : report.coverage.missingTickers.join(", ")}.

The public source manifest binds ${report.coverage.sourceInputCount} Nasdaq inputs with URL, timestamp provenance, and response hash. ${report.coverage.exactFetchTimestampInputs} timestamps were recorded at fetch completion; ${report.coverage.reconstructedFileMtimeInputs} older cache timestamps are explicitly labeled as filesystem-mtime reconstructions rather than exact retrieval times. Manifest SHA-256: ${report.coverage.sourceManifestSha256}.

**Inference is intentionally omitted.** Ten-session return windows overlap and the cohort spans only ${magnitude.distinctEventDates} event dates. Event-level or coarse calendar-block p-values and confidence intervals would overstate the effective sample size.

## Ten-session absolute move of at least 5%

| Metric | Value |
|---|---:|
| Events | ${magnitude.sampleSize} |
| Distinct event dates | ${magnitude.distinctEventDates} |
| Observed frequency | ${format(magnitude.observedFrequency)} |
| LLM Brier / AUC | ${format(magnitude.llmBrier)} / ${format(magnitude.llmAuc)} |
| Gaussian RV20 Brier / AUC | ${format(magnitude.normalRv20Brier)} / ${format(magnitude.normalRv20Auc)} |
| Walk-forward RV20 Brier / AUC | ${format(magnitude.prequentialRv20Brier)} / ${format(magnitude.prequentialRv20Auc)} |
| Purged return-window cross-fitted RV20 Brier / AUC | ${format(magnitude.purgedCrossFittedRv20Brier)} / ${format(magnitude.purgedCrossFittedRv20Auc)} |
| LLM minus Gaussian RV20 improvement | ${format(magnitude.llmImprovementVsNormalRv20)} |
| LLM minus walk-forward RV20 improvement | ${format(magnitude.llmImprovementVsPrequentialRv20)} |
| LLM minus purged cross-fitted RV20 improvement | ${format(magnitude.llmImprovementVsPurgedCrossFittedRv20)} |

The Gaussian rival is intentionally simple and omits the discrete earnings jump. The walk-forward rival learns only from outcomes that had settled before each later decision. The cross-fitted rival excludes every observation whose entry-to-settlement interval overlaps the target interval; because it can train on chronologically later, non-overlapping windows, it remains a retrospective explanatory diagnostic, not an executable forecast. None substitutes for an option-implied distribution.

## Seven-outcome selection audit versus a fixed 50% forecast

Fixed 50% is a useful direction reference but not a proper climatology for every magnitude event. These descriptive rows expose the seven pooled targets inspected before the magnitude hypothesis was highlighted; they do not correct retrospective selection or the larger sector-by-target search.

| Outcome | n | event dates | Brier improvement |
|---|---:|---:|---:|
${rows}

## Interpretation

- A probability-ranking result is not an executable OTM-option return. Vanilla options have variable payoff beyond the strike and require timestamped entry ask, exit bid, contract multiplier, size, open interest, fees, and corporate-action handling.
- With overlapping returns, repeated market dates, and this short cohort, the values above are descriptive falsification diagnostics rather than statistical confirmation.
- The next valid test must forecast a coherent return CDF and beat a locked volatility-only model plus the pre-event option surface on a later, immutable cohort.
`;
};

const run = async () => {
  const cases = parseJsonLines(
    await readFile(resolve(DATA_ROOT, "pilot-case-index.jsonl"), "utf8"),
    parseCase,
  ).sort((left, right) =>
    `${left.eventDate}:${left.ticker}`.localeCompare(
      `${right.eventDate}:${right.ticker}`,
    ),
  );
  const forecasts = parseJsonLines(
    await readFile(resolve(DATA_ROOT, "pilot-forecast-index.jsonl"), "utf8"),
    parseForecast,
  );
  const forecastByKey = new Map(
    forecasts.map((forecast) => [
      `${forecast.caseId}:${forecast.sectorId}`,
      forecast,
    ]),
  );
  const canonicalForecast = (eventCase: PublicCase) => {
    const primarySector = eventCase.sectorIds[0];
    if (primarySector === undefined) return undefined;
    return forecastByKey.get(`${eventCase.id}:${primarySector}`);
  };
  if (cases.length === 0) throw new Error("Public case index is empty.");

  const multiplicityRows = TARGETS.map((target) => {
    const differences = cases.flatMap((eventCase) => {
      const forecast = canonicalForecast(eventCase);
      const actual = target.actual(eventCase);
      if (forecast === undefined || actual === null) return [];
      return [
        {
          eventDate: eventCase.eventDate,
          value: 0.25 - brierScore(forecast.probabilities[target.id], actual),
        },
      ];
    });
    return {
      outcomeId: target.id,
      sampleSize: differences.length,
      distinctEventDates: new Set(differences.map(({ eventDate }) => eventDate))
        .size,
      improvementVsFiftyPercent: mean(differences.map(({ value }) => value)),
    };
  });

  const matureCases = cases.filter(
    (eventCase) =>
      eventCase.return10d !== null &&
      canonicalForecast(eventCase) !== undefined,
  );
  const benchmark = await loadPrices("SPY", "etf", "2025-11-01", "2026-08-14");
  let downloads = Number(benchmark.downloaded);
  const featureResults = await mapWithConcurrency<
    PublicCase,
    FeatureResult | FeatureError
  >(matureCases, 4, async (eventCase, index) => {
    try {
      const result = await loadPrices(
        eventCase.ticker,
        "stocks",
        "2025-11-01",
        "2026-08-14",
      );
      downloads += Number(result.downloaded);
      const derived = marketAndOutcome(
        result.prices,
        benchmark.prices,
        eventCase.eventDate,
        eventCase.eventSession,
      );
      if (derived?.market.realizedVolatility20d === null || derived === null) {
        return { eventCase, error: "missing point-in-time RV20" };
      }
      if ((index + 1) % 50 === 0) {
        console.log(`Reconstructed ${index + 1}/${matureCases.length} cases…`);
      }
      return {
        eventCase,
        market: derived.market,
        outcome: derived.outcome,
        source: result.source,
      };
    } catch (error) {
      return { eventCase, error: errorMessage(error) };
    }
  });
  const complete = featureResults.filter(
    (result): result is FeatureResult => "market" in result,
  );
  const observations = complete.map(({ eventCase, market, outcome }) => {
    const forecast = canonicalForecast(eventCase);
    const return10d = eventCase.return10d;
    const volatility = market.realizedVolatility20d;
    if (
      forecast === undefined ||
      return10d === null ||
      volatility === null ||
      outcome.settlement10dDate === null
    ) {
      throw new Error(`Incomplete mature case: ${eventCase.id}`);
    }
    return {
      eventCase,
      actual: Math.abs(return10d) >= 0.05,
      entryDate: market.entryDate,
      settlementDate: outcome.settlement10dDate,
      volatility,
      llmProbability: forecast.probabilities["absolute-5pct-10d"],
      normalProbability: probabilityAbsoluteNormalMove(volatility, 10, 0.05),
    };
  });
  const prequentialProbabilities = prequentialVolatilityProbabilities(
    observations.map(({ actual, entryDate, settlementDate, volatility }) => ({
      actual,
      entryDate,
      settlementDate,
      volatility,
    })),
  );
  const purgedCrossFittedProbabilities =
    purgedCrossFittedVolatilityProbabilities(
      observations.map(({ actual, entryDate, settlementDate, volatility }) => ({
        actual,
        entryDate,
        settlementDate,
        volatility,
      })),
    );
  const scored = observations.map((observation, index) => ({
    ...observation,
    prequentialProbability: prequentialProbabilities[index] ?? 0.5,
    purgedCrossFittedProbability: purgedCrossFittedProbabilities[index] ?? 0.5,
  }));
  const pairedDifference = (
    baseline: (row: (typeof scored)[number]) => number,
  ) =>
    scored.map(
      (row) =>
        brierScore(baseline(row), row.actual) -
        brierScore(row.llmProbability, row.actual),
    );
  const versusNormal = pairedDifference(
    ({ normalProbability }) => normalProbability,
  );
  const versusPrequential = pairedDifference(
    ({ prequentialProbability }) => prequentialProbability,
  );
  const versusPurgedCrossFitted = pairedDifference(
    ({ purgedCrossFittedProbability }) => purgedCrossFittedProbability,
  );
  const meanBrier = (probability: (row: (typeof scored)[number]) => number) =>
    mean(scored.map((row) => brierScore(probability(row), row.actual)));
  const auc = (probability: (row: (typeof scored)[number]) => number) =>
    rocAuc(
      scored.map((row) => ({
        actual: row.actual,
        probability: probability(row),
      })),
    );
  const sourceInputs = [
    { symbol: "SPY", ...benchmark.source },
    ...complete.map(({ eventCase, source }) => ({
      symbol: eventCase.ticker,
      ...source,
    })),
  ].sort((left, right) => left.symbol.localeCompare(right.symbol));
  const sourceManifest = {
    studyId: "earnings-2026-06-15_2026-08-14-v1",
    inputs: sourceInputs,
  };
  const sourceManifestBody = `${JSON.stringify(sourceManifest, null, 2)}\n`;
  const sourceManifestSha256 = sha256(sourceManifestBody);
  await writeText(
    resolve(DATA_ROOT, "volatility-baseline-source-manifest.json"),
    sourceManifestBody,
  );

  const report = {
    studyId: "earnings-2026-06-15_2026-08-14-v1",
    generatedAt: new Date().toISOString(),
    evidenceState: "retrospective-falsification-diagnostic",
    recommendedLivePositionFraction: 0,
    coverage: {
      eligibleCases: matureCases.length,
      featureCases: scored.length,
      downloadedResponsesThisRun: downloads,
      sourceInputCount: sourceInputs.length,
      exactFetchTimestampInputs: sourceInputs.filter(
        ({ retrievalTimestampQuality }) =>
          retrievalTimestampQuality === "fetch-completion",
      ).length,
      reconstructedFileMtimeInputs: sourceInputs.filter(
        ({ retrievalTimestampQuality }) =>
          retrievalTimestampQuality === "cache-file-mtime",
      ).length,
      sourceManifestSha256,
      missingTickers: featureResults.flatMap((result) =>
        "error" in result ? [result.eventCase.ticker] : [],
      ),
    },
    multiplicityAudit: multiplicityRows,
    magnitude10d: {
      sampleSize: scored.length,
      observedFrequency: mean(scored.map(({ actual }) => Number(actual))),
      distinctEventDates: new Set(
        scored.map(({ eventCase }) => eventCase.eventDate),
      ).size,
      llmBrier: meanBrier(({ llmProbability }) => llmProbability),
      llmAuc: auc(({ llmProbability }) => llmProbability),
      normalRv20Brier: meanBrier(({ normalProbability }) => normalProbability),
      normalRv20Auc: auc(({ normalProbability }) => normalProbability),
      prequentialRv20Brier: meanBrier(
        ({ prequentialProbability }) => prequentialProbability,
      ),
      prequentialRv20Auc: auc(
        ({ prequentialProbability }) => prequentialProbability,
      ),
      purgedCrossFittedRv20Brier: meanBrier(
        ({ purgedCrossFittedProbability }) => purgedCrossFittedProbability,
      ),
      purgedCrossFittedRv20Auc: auc(
        ({ purgedCrossFittedProbability }) => purgedCrossFittedProbability,
      ),
      llmImprovementVsNormalRv20: mean(versusNormal),
      llmImprovementVsPrequentialRv20: mean(versusPrequential),
      llmImprovementVsPurgedCrossFittedRv20: mean(versusPurgedCrossFitted),
    },
    limitations: [
      "Retrospective current-model forecasts are not prospective validation.",
      "The fixed Gaussian baseline omits earnings jumps and fat tails.",
      "The walk-forward baseline uses only RV20 and settled labels; a richer tabular model may be stronger.",
      "Overlapping returns and only 23 distinct event dates make this audit descriptive; it reports no inferential p-values or confidence intervals.",
      "The purged cross-fit uses chronologically later non-overlapping labels and is explanatory, not executable.",
      "Fifty-seven older cache entries bind body hashes and filesystem modification times, not exact historical network-completion timestamps.",
      "No timestamped historical option quotes are present, so option P&L is not computed.",
    ],
  };
  await writeJson(resolve(DATA_ROOT, "volatility-baseline-audit.json"), report);
  await writeText(
    resolve(DATA_ROOT, "VOLATILITY_BASELINE_AUDIT.md"),
    renderMarkdown(report),
  );
  console.log(
    `Audited ${scored.length} mature cases; ${downloads} responses downloaded.`,
  );
};

await run();
