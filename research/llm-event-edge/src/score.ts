import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  EventCase,
  ForecastPacket,
  LockedForecast,
  SectorId,
} from "./domain.js";
import {
  assertArtifactHash,
  assertExactCoverage,
  assertUniqueValues,
} from "./artifactControls.js";
import { SECTOR_IDS } from "./domain.js";
import {
  DATA_ROOT,
  STUDY_ROOT,
  readJsonLines,
  readStudyConfig,
  sha256,
  writeJson,
  writeJsonLines,
  writeText,
} from "./io.js";
import { parseForecastBatch } from "./forecastValidation.js";
import { asArray, asRecord, asString } from "./parse.js";
import { secFilingUrl } from "./providers/sec.js";
import {
  bootstrapMeanInterval,
  brierScore,
  logLoss,
  mean,
  wilsonInterval,
} from "./statistics.js";

interface OutcomeDefinition {
  id:
    | "up-1d"
    | "up-10d"
    | "absolute-2pct-1d"
    | "absolute-5pct-1d"
    | "absolute-5pct-10d"
    | "up-40d"
    | "absolute-10pct-40d";
  probability: (forecast: LockedForecast) => number;
  returnValue: (eventCase: EventCase) => number | null;
  settlementDate: (eventCase: EventCase) => string | null;
  outcome: (value: number) => boolean;
  expectedReturn: (forecast: LockedForecast) => number | null;
}

const OUTCOMES: OutcomeDefinition[] = [
  {
    id: "up-1d",
    probability: (forecast) => forecast.probabilityUp1d,
    returnValue: (eventCase) => eventCase.outcome.return1d,
    settlementDate: (eventCase) => eventCase.outcome.settlement1dDate,
    outcome: (value) => value > 0,
    expectedReturn: (forecast) => forecast.expectedReturn1d,
  },
  {
    id: "up-10d",
    probability: (forecast) => forecast.probabilityUp10d,
    returnValue: (eventCase) => eventCase.outcome.return10d,
    settlementDate: (eventCase) => eventCase.outcome.settlement10dDate,
    outcome: (value) => value > 0,
    expectedReturn: (forecast) => forecast.expectedReturn10d,
  },
  {
    id: "absolute-2pct-1d",
    probability: (forecast) => forecast.probabilityAbsolute2Percent1d,
    returnValue: (eventCase) => eventCase.outcome.return1d,
    settlementDate: (eventCase) => eventCase.outcome.settlement1dDate,
    outcome: (value) => Math.abs(value) >= 0.02,
    expectedReturn: () => null,
  },
  {
    id: "absolute-5pct-1d",
    probability: (forecast) => forecast.probabilityAbsolute5Percent1d,
    returnValue: (eventCase) => eventCase.outcome.return1d,
    settlementDate: (eventCase) => eventCase.outcome.settlement1dDate,
    outcome: (value) => Math.abs(value) >= 0.05,
    expectedReturn: () => null,
  },
  {
    id: "absolute-5pct-10d",
    probability: (forecast) => forecast.probabilityAbsolute5Percent10d,
    returnValue: (eventCase) => eventCase.outcome.return10d,
    settlementDate: (eventCase) => eventCase.outcome.settlement10dDate,
    outcome: (value) => Math.abs(value) >= 0.05,
    expectedReturn: () => null,
  },
  {
    id: "up-40d",
    probability: (forecast) => forecast.probabilityUp40d,
    returnValue: (eventCase) => eventCase.outcome.return40d,
    settlementDate: (eventCase) => eventCase.outcome.settlement40dDate,
    outcome: (value) => value > 0,
    expectedReturn: (forecast) => forecast.expectedReturn40d,
  },
  {
    id: "absolute-10pct-40d",
    probability: (forecast) => forecast.probabilityAbsolute10Percent40d,
    returnValue: (eventCase) => eventCase.outcome.return40d,
    settlementDate: (eventCase) => eventCase.outcome.settlement40dDate,
    outcome: (value) => Math.abs(value) >= 0.1,
    expectedReturn: () => null,
  },
];

const numberText = (value: number, digits = 3) =>
  Number.isFinite(value) ? value.toFixed(digits) : "n/a";

const percentText = (value: number, digits = 1) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "n/a";

const parseLockedForecast = (value: unknown): LockedForecast => {
  const row = asRecord(value, "Locked forecast");
  const parsed = parseForecastBatch({ forecasts: [row] }).forecasts[0];
  if (parsed === undefined) throw new Error("Locked forecast is empty.");
  const sectorId = asString(row.sectorId, "sectorId");
  if (!SECTOR_IDS.some((candidate) => candidate === sectorId)) {
    throw new Error(`Unsupported locked forecast sector: ${sectorId}`);
  }
  const graphNode = asString(row.graphNode, "graphNode");
  const informationPolicy = asString(
    row.informationPolicy,
    "informationPolicy",
  );
  if (graphNode !== "synthesis") {
    throw new Error("Only synthesis-node forecasts may be scored.");
  }
  if (informationPolicy !== "packet-only-no-web") {
    throw new Error("Locked forecast information policy is invalid.");
  }
  return {
    ...parsed,
    studyId: asString(row.studyId, "studyId"),
    sectorId: sectorId as SectorId,
    model: asString(row.model, "model"),
    reasoningEffort: asString(row.reasoningEffort, "reasoningEffort"),
    graphNode,
    generatedAt: asString(row.generatedAt, "generatedAt"),
    informationPolicy,
  };
};

const prequentialBaseRates = (
  observations: Array<{
    eventCase: EventCase;
    actual: boolean;
    settlementDate: string;
  }>,
): number[] =>
  observations.map(({ eventCase }, index) => {
    const availablePrior = observations
      .slice(0, index)
      .filter(
        ({ settlementDate }) =>
          settlementDate < eventCase.marketFeatures.entryDate,
      );
    const positives = availablePrior.filter(({ actual }) => actual).length;
    return (positives + 0.5) / (availablePrior.length + 1);
  });

const scoreDefinition = (
  definition: OutcomeDefinition,
  sectorId: SectorId | "pooled",
  forecasts: LockedForecast[],
  cases: Map<string, EventCase>,
) => {
  const observations = forecasts.flatMap((forecast) => {
    if (sectorId !== "pooled" && forecast.sectorId !== sectorId) return [];
    const eventCase = cases.get(forecast.caseId);
    const value = eventCase && definition.returnValue(eventCase);
    const settlementDate = eventCase && definition.settlementDate(eventCase);
    if (
      eventCase === undefined ||
      value === null ||
      value === undefined ||
      settlementDate === null ||
      settlementDate === undefined
    ) {
      return [];
    }
    const actual = definition.outcome(value);
    const probability = definition.probability(forecast);
    const predicted = probability >= 0.5;
    const expectedReturn = definition.expectedReturn(forecast);
    return [
      {
        forecast,
        eventCase,
        value,
        settlementDate,
        actual,
        probability,
        predicted,
        expectedReturn,
      },
    ];
  });
  observations.sort((left, right) =>
    `${left.eventCase.eventDate}:${left.eventCase.ticker}`.localeCompare(
      `${right.eventCase.eventDate}:${right.eventCase.ticker}`,
    ),
  );
  const successes = observations.filter(
    ({ actual, predicted }) => actual === predicted,
  ).length;
  const actualPositives = observations.filter(({ actual }) => actual).length;
  const brier = observations.map(({ probability, actual }) =>
    brierScore(probability, actual),
  );
  const baselineProbabilities = prequentialBaseRates(observations);
  const baselineBrier = observations.map(({ actual }, index) =>
    brierScore(baselineProbabilities[index] ?? 0.5, actual),
  );
  const losses = observations.map(({ probability, actual }) =>
    logLoss(probability, actual),
  );
  const baselineLosses = observations.map(({ actual }, index) =>
    logLoss(baselineProbabilities[index] ?? 0.5, actual),
  );
  const brierImprovements = brier.map(
    (value, index) => (baselineBrier[index] ?? 0) - value,
  );
  const fiftyPercentBrierImprovements = brier.map((value) => 0.25 - value);
  const accuracyInterval = wilsonInterval(successes, observations.length);
  const meanForecast = mean(observations.map(({ probability }) => probability));
  const expectedReturnErrors = observations.flatMap(
    ({ expectedReturn, value }) =>
      expectedReturn === null ? [] : [(expectedReturn - value) ** 2],
  );
  return {
    sectorId,
    outcomeId: definition.id,
    sampleSize: observations.length,
    observedFrequency:
      observations.length === 0
        ? Number.NaN
        : actualPositives / observations.length,
    meanForecast,
    forecastStandardDeviation: Math.sqrt(
      mean(
        observations.map(
          ({ probability }) => (probability - meanForecast) ** 2,
        ),
      ),
    ),
    predictedPositiveRate: mean(
      observations.map(({ predicted }) => Number(predicted)),
    ),
    brierScore: mean(brier),
    fiftyPercentBrierScore: observations.length === 0 ? Number.NaN : 0.25,
    brierImprovementVsFiftyPercent: mean(fiftyPercentBrierImprovements),
    brierImprovementVsFiftyPercent95: bootstrapMeanInterval(
      fiftyPercentBrierImprovements,
    ),
    prequentialBaseRateBrierScore: mean(baselineBrier),
    brierImprovement: mean(brierImprovements),
    brierImprovement95: bootstrapMeanInterval(brierImprovements),
    logLoss: mean(losses),
    fiftyPercentLogLoss: observations.length === 0 ? Number.NaN : Math.log(2),
    logLossImprovementVsFiftyPercent: mean(
      losses.map((loss) => Math.log(2) - loss),
    ),
    prequentialBaseRateLogLoss: mean(baselineLosses),
    logLossImprovement: mean(
      losses.map((loss, index) => (baselineLosses[index] ?? 0) - loss),
    ),
    classificationAccuracy:
      observations.length === 0 ? Number.NaN : successes / observations.length,
    classificationAccuracy95: accuracyInterval,
    abstentionRate: mean(
      observations.map(({ forecast }) => Number(forecast.abstain)),
    ),
    executionReturnStatus:
      "not-computed-same-close-anchor-is-not-an-executable-fill",
    expectedReturnRmse:
      expectedReturnErrors.length === 0
        ? Number.NaN
        : Math.sqrt(mean(expectedReturnErrors)),
    inferenceWarning:
      "Intervals are simple event-level bootstraps/Wilson intervals and do not correct overlapping horizons, date clusters, issuer repetition, or multiple comparisons.",
  };
};

const renderMarkdown = (
  generatedAt: string,
  results: ReturnType<typeof scoreDefinition>[],
) => {
  const primary = results.filter(({ outcomeId }) => outcomeId === "up-1d");
  const rows = primary
    .map(
      (result) =>
        `| ${result.sectorId} | ${result.sampleSize} | ${percentText(result.observedFrequency)} | ${percentText(result.predictedPositiveRate)} | ${numberText(result.brierScore)} | ${numberText(result.brierImprovementVsFiftyPercent)} | ${numberText(result.brierImprovement)} | ${percentText(result.classificationAccuracy)} | ${percentText(result.classificationAccuracy95[0])}–${percentText(result.classificationAccuracy95[1])} |`,
    )
    .join("\n");
  return `# GPT-5.6 Sol event-edge pilot results

Generated: ${generatedAt}

## Status

**Pipeline-development evidence only. Recommended live position: 0%.** These forecasts were generated retrospectively by a current model from reconstructed point-in-time packets. They are useful for finding failure modes and choosing prospective hypotheses, but they cannot authorize capital.

The primary table scores next-close direction against two no-skill references. The fixed 50% forecast is the transparent direction benchmark. The no-lookahead prequential base rate starts from a Jeffreys-smoothed 50% prior and updates only from outcomes that had settled before each later decision cutoff; it can be volatile in small, temporally clustered sectors, so it must not be read alone. The close anchor is not treated as an executable fill, so this report deliberately computes no trading return.

| Sector | n | Actual up | Model up call | Brier | Improvement vs 50% | Improvement vs settled-history base rate | Accuracy | Naive 95% interval |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

## Interpretation guardrails

- The pharma-biotech row overlaps health care.
- Sector counts of 20–41 are exploratory and carry very wide uncertainty.
- There are no historical executable option quotes, spreads, depth, or implied-volatility surfaces in this study. It cannot estimate option-strategy returns.
- Daily features include the completed anchor close. That supports a close-to-close forecast diagnostic, not a claim that the strategy could fill at the observed close.
- Ten-day returns overlap and 40-day outcomes are mostly not mature. Use the JSON report for availability by horizon.
- No sector receives a live Kelly allocation from this sample. Fifty events per sector is feasibility only. The first formal pooled test should normally include at least 400–600 events and 50 independent event dates, with final size determined from the locked baseline's variance and date/issuer design effect.
`;
};

const run = async () => {
  const config = await readStudyConfig();
  const ledgerPath = resolve(DATA_ROOT, "private", "cases.jsonl");
  const ledgerBody = await readFile(ledgerPath, "utf8");
  const pilotManifest = asRecord(
    JSON.parse(
      await readFile(resolve(DATA_ROOT, "pilot-manifest.json"), "utf8"),
    ) as unknown,
    "Pilot manifest",
  );
  if (pilotManifest.studyId !== config.studyId) {
    throw new Error("Case ledger does not match the frozen pilot manifest.");
  }
  assertArtifactHash(
    sha256(ledgerBody),
    pilotManifest.privateCaseLedgerSha256,
    "Case ledger",
  );
  const cases = await readJsonLines<EventCase>(ledgerPath);
  const caseIds = cases.map(({ id }) => id);
  assertUniqueValues(caseIds, "Case ledger");
  const outputRoot = resolve(DATA_ROOT, "forecasts", config.studyId);
  const forecastPath = resolve(outputRoot, "locked-forecasts.jsonl");
  const forecastBody = await readFile(forecastPath, "utf8");
  const runManifest = asRecord(
    JSON.parse(
      await readFile(resolve(outputRoot, "run-manifest.json"), "utf8"),
    ) as unknown,
    "Run manifest",
  );
  if (
    runManifest.studyId !== config.studyId ||
    runManifest.model !== config.model ||
    runManifest.reasoningEffort !== config.reasoningEffort ||
    runManifest.webSearch !== "disabled" ||
    runManifest.sandbox !== "read-only" ||
    runManifest.ephemeral !== true ||
    runManifest.analystReplicates !== 2 ||
    runManifest.lockedForecastsSha256 !== sha256(forecastBody)
  ) {
    throw new Error("Forecast output does not match its locked run manifest.");
  }
  const analystCallRecords = asArray(
    runManifest.analystCalls,
    "analystCalls",
  ).map((value) => asRecord(value, "analyst call"));
  const synthesisCallRecords = asArray(
    runManifest.synthesisCalls,
    "synthesisCalls",
  ).map((value) => asRecord(value, "synthesis call"));
  const callRecords = [...analystCallRecords, ...synthesisCallRecords];
  if (
    callRecords.some(
      ({
        isolationPolicy,
        promptHash,
        stderrHash,
        nodeGeneratedAt,
        fromCache,
      }) =>
        isolationPolicy !== "macos-seatbelt-no-home-no-subprocess-v2" ||
        typeof promptHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(promptHash) ||
        typeof stderrHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(stderrHash) ||
        typeof nodeGeneratedAt !== "string" ||
        !Number.isFinite(Date.parse(nodeGeneratedAt)) ||
        typeof fromCache !== "boolean",
    )
  ) {
    throw new Error("Run manifest contains invalid model-call provenance.");
  }
  const manifestPacketHashes = asRecord(
    runManifest.packetHashes,
    "packetHashes",
  );
  const expectedForecastKeys: string[] = [];
  const expectedCaseIds = new Set<string>();
  const expectedAnalystCallIds: string[] = [];
  const expectedSynthesisCallIds: string[] = [];
  for (const sectorId of SECTOR_IDS) {
    const packetPath = resolve(
      DATA_ROOT,
      "private",
      "packets",
      `${sectorId}.jsonl`,
    );
    const packetBody = await readFile(packetPath, "utf8");
    if (manifestPacketHashes[sectorId] !== sha256(packetBody)) {
      throw new Error(`Packet hash mismatch for ${sectorId}.`);
    }
    const packets = await readJsonLines<ForecastPacket>(packetPath);
    expectedForecastKeys.push(
      ...packets.map(({ caseId }) => `${sectorId}:${caseId}`),
    );
    for (const { caseId } of packets) expectedCaseIds.add(caseId);
    const batchCount = Math.ceil(packets.length / config.forecastBatchSize);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      expectedAnalystCallIds.push(
        `${sectorId}:${batchIndex}:analyst-1`,
        `${sectorId}:${batchIndex}:analyst-2`,
      );
      expectedSynthesisCallIds.push(`${sectorId}:${batchIndex}:synthesis`);
    }
  }
  assertExactCoverage(
    analystCallRecords.map((record) => asString(record.id, "analyst call id")),
    expectedAnalystCallIds,
    "Analyst call",
  );
  assertExactCoverage(
    synthesisCallRecords.map((record) =>
      asString(record.id, "synthesis call id"),
    ),
    expectedSynthesisCallIds,
    "Synthesis call",
  );
  assertExactCoverage(caseIds, [...expectedCaseIds], "Case ledger");
  const schemaBody = await readFile(
    resolve(STUDY_ROOT, "schemas", "forecast.schema.json"),
    "utf8",
  );
  if (runManifest.schemaSha256 !== sha256(schemaBody)) {
    throw new Error("Forecast schema does not match the run manifest.");
  }
  const forecasts = (await readJsonLines<unknown>(forecastPath)).map(
    parseLockedForecast,
  );
  for (const forecast of forecasts) {
    if (
      forecast.studyId !== config.studyId ||
      forecast.model !== config.model ||
      forecast.reasoningEffort !== config.reasoningEffort
    ) {
      throw new Error("Locked forecast metadata does not match study config.");
    }
  }
  if (runManifest.forecastCount !== forecasts.length) {
    throw new Error("Run-manifest forecastCount does not match output.");
  }
  assertExactCoverage(
    forecasts.map(({ sectorId, caseId }) => `${sectorId}:${caseId}`),
    expectedForecastKeys,
    "Forecast",
  );
  const caseMap = new Map(cases.map((eventCase) => [eventCase.id, eventCase]));
  const canonicalPooledForecasts = [
    ...forecasts
      .reduce((byCase, forecast) => {
        // Health-care packets precede the overlapping pharma/biotech overlay.
        // The overlay remains separately scored but must not double-weight pooled results.
        if (!byCase.has(forecast.caseId)) byCase.set(forecast.caseId, forecast);
        return byCase;
      }, new Map<string, LockedForecast>())
      .values(),
  ];
  const results = OUTCOMES.flatMap((definition) => [
    scoreDefinition(definition, "pooled", canonicalPooledForecasts, caseMap),
    ...SECTOR_IDS.map((sectorId) =>
      scoreDefinition(definition, sectorId, forecasts, caseMap),
    ),
  ]);
  const generatedAt = new Date().toISOString();
  const publicCaseIndexPath = resolve(DATA_ROOT, "pilot-case-index.jsonl");
  await writeJsonLines(
    publicCaseIndexPath,
    cases.map((eventCase) => ({
      id: eventCase.id,
      ticker: eventCase.ticker,
      companyName: eventCase.companyName,
      eventDate: eventCase.eventDate,
      acceptedAt: eventCase.acceptedAt,
      eventSession: eventCase.eventSession,
      sectorIds: eventCase.sectorIds,
      capitalizationId: eventCase.capitalizationId,
      secFilingUrl: secFilingUrl(eventCase.cik, eventCase.filing),
      return1d: eventCase.outcome.return1d,
      return10d: eventCase.outcome.return10d,
      return40d: eventCase.outcome.return40d,
      marketAdjustedReturn1d: eventCase.outcome.marketAdjustedReturn1d,
      marketAdjustedReturn10d: eventCase.outcome.marketAdjustedReturn10d,
      marketAdjustedReturn40d: eventCase.outcome.marketAdjustedReturn40d,
      retrospectiveQuality: eventCase.retrospectiveQuality,
    })),
  );
  const publicForecastIndexPath = resolve(
    DATA_ROOT,
    "pilot-forecast-index.jsonl",
  );
  await writeJsonLines(
    publicForecastIndexPath,
    forecasts.map((forecast) => ({
      caseId: forecast.caseId,
      studyId: forecast.studyId,
      sectorId: forecast.sectorId,
      probabilityUp1d: forecast.probabilityUp1d,
      probabilityUp10d: forecast.probabilityUp10d,
      probabilityAbsolute2Percent1d: forecast.probabilityAbsolute2Percent1d,
      probabilityAbsolute5Percent1d: forecast.probabilityAbsolute5Percent1d,
      probabilityAbsolute5Percent10d: forecast.probabilityAbsolute5Percent10d,
      probabilityUp40d: forecast.probabilityUp40d,
      probabilityAbsolute10Percent40d: forecast.probabilityAbsolute10Percent40d,
      expectedReturn1d: forecast.expectedReturn1d,
      expectedReturn10d: forecast.expectedReturn10d,
      expectedReturn40d: forecast.expectedReturn40d,
      confidence: forecast.confidence,
      abstain: forecast.abstain,
      model: forecast.model,
      reasoningEffort: forecast.reasoningEffort,
      graphNode: forecast.graphNode,
      generatedAt: forecast.generatedAt,
      informationPolicy: forecast.informationPolicy,
    })),
  );
  const publicCaseIndexSha256 = sha256(
    await readFile(publicCaseIndexPath, "utf8"),
  );
  const publicForecastIndexSha256 = sha256(
    await readFile(publicForecastIndexPath, "utf8"),
  );
  await writeJson(resolve(DATA_ROOT, "pilot-results.json"), {
    studyId: config.studyId,
    generatedAt,
    decisionState: "continue-shadow",
    recommendedLivePositionFraction: 0,
    runProvenance: {
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      cliVersion: asString(runManifest.cliVersion, "cliVersion"),
      schemaSha256: asString(runManifest.schemaSha256, "schemaSha256"),
      lockedForecastsSha256: asString(
        runManifest.lockedForecastsSha256,
        "lockedForecastsSha256",
      ),
      publicCaseIndexSha256,
      publicForecastIndexSha256,
      analystCallCount: analystCallRecords.length,
      synthesisCallCount: synthesisCallRecords.length,
      allCallsLoadedFromProvenanceCheckedCache: callRecords.every(
        ({ fromCache }) => fromCache === true,
      ),
      informationPolicy: "packet-only-no-web",
      isolationPolicy: "macos-seatbelt-no-home-no-subprocess-v2",
    },
    prospectiveActivationPolicy: {
      firstPooledFeasibilityEvents: 240,
      minimumPooledConfirmatoryEvents: 600,
      minimumIndependentEventDates: 50,
      sectorActivationPolicy:
        "power-derived; 50 events is feasibility only and activation normally requires hundreds",
      minimumForecastCoverage: 0.9,
      minimumQuoteCoverage: 0.9,
      requiredMultiplicityAdjustedLower975ScoreImprovement: 0,
      requiredMultiplicityAdjustedLower975NetPnlPerEligibleEvent: 0,
      maximumRiskPerEventAfterActivation: 0.005,
      maximumSameSectorOpenRisk: 0.01,
      maximumAggregateEventRisk: 0.02,
    },
    results,
  });
  await writeText(
    resolve(DATA_ROOT, "PILOT_RESULTS.md"),
    renderMarkdown(generatedAt, results),
  );
  console.log(`Scored ${forecasts.length} locked sector-case forecasts.`);
};

await run();
