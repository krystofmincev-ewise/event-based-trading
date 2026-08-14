import type {
  ExplorationResult,
  KellyComparisonPoint,
  SimulationInput,
  SimulationResult,
} from "@event-lab/simulation";

export interface LabData {
  simulation: SimulationResult;
  exploration: ExplorationResult;
  comparison: KellyComparisonPoint[];
}

export type ApiErrorKind = "unavailable" | "malformed" | "rejected";

export interface LabFailure {
  message: string;
  kind: ApiErrorKind | "input" | "unknown";
  details: string[];
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const containsOnlyFiniteNumbers = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(containsOnlyFiniteNumbers);
  if (isRecord(value)) {
    return Object.values(value).every(containsOnlyFiniteNumbers);
  }
  return false;
};

const hasFiniteFields = (
  value: Record<string, unknown>,
  fields: string[],
): boolean => fields.every((field) => Number.isFinite(value[field]));

const hasStringFields = (
  value: Record<string, unknown>,
  fields: string[],
): boolean => fields.every((field) => typeof value[field] === "string");

const isNullableFinite = (value: unknown): boolean =>
  value === null || Number.isFinite(value);

const isQuantiles = (value: unknown): boolean =>
  isRecord(value) &&
  hasFiniteFields(value, ["p05", "p25", "median", "p75", "p95"]);

const isOrderedQuantiles = (
  value: unknown,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): boolean =>
  isQuantiles(value) &&
  isRecord(value) &&
  (value.p05 as number) >= minimum &&
  (value.p05 as number) <= (value.p25 as number) &&
  (value.p25 as number) <= (value.median as number) &&
  (value.median as number) <= (value.p75 as number) &&
  (value.p75 as number) <= (value.p95 as number) &&
  (value.p95 as number) <= maximum;

const isHistogram = (value: unknown): boolean =>
  isRecord(value) &&
  Array.isArray(value.domain) &&
  value.domain.length === 2 &&
  value.domain.every(Number.isFinite) &&
  Number.isFinite(value.sampleCount) &&
  Array.isArray(value.bins) &&
  value.bins.length > 0 &&
  value.bins.every(
    (bin) => isRecord(bin) && hasFiniteFields(bin, ["lower", "upper", "count"]),
  );

const isResearchScenarioManifest = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    value.kind === "empirical-research-proxy" &&
    typeof value.datasetVersion === "string" &&
    typeof value.profileId === "string" &&
    (value.capitalizationId === "small" ||
      value.capitalizationId === "mid" ||
      value.capitalizationId === "large") &&
    (value.horizonTradingDays === 1 || value.horizonTradingDays === 10) &&
    (value.direction === "up" ||
      value.direction === "down" ||
      value.direction === "absolute") &&
    (value.threshold === 0 ||
      value.threshold === 0.02 ||
      value.threshold === 0.05 ||
      value.threshold === 0.1) &&
    Number.isFinite(value.companyMoveMultiplier) &&
    Number.isFinite(value.modelProbabilityLift) &&
    value.termsExecutable === false &&
    value.sizingEligibility === "research-only");

const isSimulationInput = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.seed === "string" &&
  typeof value.calibrationUncertaintyEnabled === "boolean" &&
  (value.opportunityArrival === "fixed" ||
    value.opportunityArrival === "poisson") &&
  isResearchScenarioManifest(value.researchScenarioManifest) &&
  hasFiniteFields(value, [
    "winProbability",
    "probabilityHaircut",
    "positionFraction",
    "contractPurchasePrice",
    "settlementPayout",
    "roundTripCosts",
    "eventsPerWeek",
    "horizonWeeks",
    "startingCapital",
    "pathCount",
    "ruinThresholdFraction",
    "annualRiskFreeRate",
    "severeDrawdownFraction",
    "calibrationEffectiveSampleSize",
    "weeklyProbabilityLogitStdDev",
    "executionCostCoefficientVariation",
  ]);

const isContractEconomics = (value: unknown): boolean =>
  isRecord(value) &&
  hasFiniteFields(value, [
    "purchasePrice",
    "settlementPayout",
    "roundTripCosts",
    "allInCost",
    "netWinProfit",
    "netWinMultiple",
    "breakEvenProbability",
  ]);

const isKellyScenario = (value: unknown): boolean =>
  isRecord(value) &&
  hasFiniteFields(value, [
    "probability",
    "rawFraction",
    "actionableFraction",
    "expectedProfitPerContract",
    "expectedReturnOnCapitalAtRisk",
  ]) &&
  isNullableFinite(value.expectedLogGrowthPerEvent);

const isKelly = (value: unknown): boolean =>
  isRecord(value) &&
  Number.isFinite(value.probabilityHaircut) &&
  isContractEconomics(value.economics) &&
  isKellyScenario(value.estimated) &&
  isKellyScenario(value.conservative);

const isAnnualizedMetrics = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.observationFrequency === "string" &&
  hasFiniteFields(value, [
    "observationsPerYear",
    "sampleObservationCount",
    "meanPeriodicReturn",
    "periodicRiskFreeReturn",
    "annualizedVolatility",
  ]) &&
  isNullableFinite(value.sharpe) &&
  isNullableFinite(value.sortino);

const isSimulationMetrics = (value: unknown): boolean =>
  isRecord(value) &&
  hasFiniteFields(value, [
    "expectedTerminalCapital",
    "continuousFractionExpectedTerminalCapitalReference",
    "expectedTotalReturn",
    "medianTotalReturn",
    "impliedCagrFromExpectedTerminal",
    "impliedCagrFromMedianTerminal",
    "probabilityOfLoss",
    "probabilityOfPracticalRuin",
    "medianMaxDrawdown",
    "p90MaxDrawdown",
    "probabilityOfSevereDrawdown",
    "probabilityOfZeroExecutablePositionAtEnd",
  ]) &&
  isQuantiles(value.terminalCapital) &&
  isAnnualizedMetrics(value.annualized);

const isSimulationMetadata = (value: unknown): boolean =>
  isRecord(value) &&
  hasFiniteFields(value, [
    "expectedOpportunityCount",
    "effectiveOpportunitiesPerWeek",
    "horizonYears",
    "pathCount",
    "checkpointCount",
    "retainedSamplePathCount",
    "practicalRuinCapital",
    "severeDrawdownFraction",
    "cappedPathCount",
    "initialWholeContractCount",
    "initialCapitalAtRisk",
    "initialExecutedFraction",
    "eligiblePositionAttemptCount",
    "approximatedLargeContractExecutions",
    "skippedInvalidCostOpportunityCount",
    "meanLatentWinProbability",
    "meanWeeklyWinProbability",
  ]) &&
  isNullableFinite(value.meanExecutedFractionPerEligibleAttempt) &&
  isNullableFinite(value.zeroContractRatePerEligibleAttempt) &&
  typeof value.seed === "string" &&
  (value.simulationModel === "iid binary whole-contract target-fraction" ||
    value.simulationModel ===
      "stochastic binary whole-contract target-fraction") &&
  (value.expectedOpportunityCount as number) >= 0 &&
  (value.effectiveOpportunitiesPerWeek as number) >= 0 &&
  (value.skippedInvalidCostOpportunityCount as number) >= 0 &&
  (value.meanLatentWinProbability as number) >= 0 &&
  (value.meanLatentWinProbability as number) <= 1 &&
  (value.meanWeeklyWinProbability as number) >= 0 &&
  (value.meanWeeklyWinProbability as number) <= 1 &&
  isOrderedQuantiles(value.realizedOpportunityCount, 0) &&
  isOrderedQuantiles(value.latentWinProbability, 0, 1) &&
  typeof value.continuousFractionReferenceCapped === "boolean" &&
  typeof value.cagrOutputCapped === "boolean" &&
  value.continuousFractionReferenceIgnoresWholeContractRounding === true;

const isFan = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (point) =>
      isRecord(point) &&
      hasFiniteFields(point, [
        "trade",
        "week",
        "p05",
        "p25",
        "median",
        "p75",
        "p95",
      ]),
  );

const isSamplePaths = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every(
    (path) =>
      isRecord(path) &&
      Number.isFinite(path.id) &&
      Array.isArray(path.points) &&
      path.points.every(
        (point) =>
          isRecord(point) &&
          hasFiniteFields(point, ["trade", "week", "capital"]),
      ),
  );

const isSimulationResponse = (
  body: unknown,
): body is { simulation: SimulationResult } => {
  if (!isRecord(body) || !isRecord(body.simulation)) return false;
  const { simulation } = body;
  return (
    isSimulationInput(simulation.input) &&
    isKelly(simulation.kelly) &&
    isSimulationMetrics(simulation.metrics) &&
    isFan(simulation.fan) &&
    isSamplePaths(simulation.samplePaths) &&
    isHistogram(simulation.terminalReturnHistogram) &&
    isHistogram(simulation.maxDrawdownHistogram) &&
    isSimulationMetadata(simulation.metadata) &&
    isRecord(simulation.definitions) &&
    hasStringFields(simulation.definitions, [
      "winMultiplier",
      "lossMultiplier",
      "practicalRuin",
      "expectedTerminal",
      "continuousFractionExpectedTerminal",
      "quantiles",
      "maximumDrawdown",
      "sharpe",
      "sortino",
      "wholeContractExecution",
    ]) &&
    Array.isArray(simulation.warnings) &&
    simulation.warnings.every((warning) => typeof warning === "string") &&
    containsOnlyFiniteNumbers(body)
  );
};

const isSweepPoint = (point: unknown): boolean =>
  isRecord(point) &&
  hasFiniteFields(point, [
    "fraction",
    "medianCagr",
    "medianTerminalCapital",
    "probabilityOfPracticalRuin",
    "probabilityOfSevereDrawdown",
    "p90MaxDrawdown",
  ]) &&
  isNullableFinite(point.expectedLogGrowthPerTrade);

const isHeatmapCell = (cell: unknown): boolean =>
  isRecord(cell) &&
  hasFiniteFields(cell, [
    "winProbability",
    "fraction",
    "medianCagr",
    "probabilityOfPracticalRuin",
  ]);

const isExplorationResponse = (
  body: unknown,
): body is { exploration: ExplorationResult } =>
  (() => {
    if (!isRecord(body) || !isRecord(body.exploration)) return false;
    const exploration = body.exploration;
    if (
      !Array.isArray(exploration.sweep) ||
      exploration.sweep.length === 0 ||
      !exploration.sweep.every(isSweepPoint) ||
      !Array.isArray(exploration.heatmap) ||
      !exploration.heatmap.every(isHeatmapCell) ||
      !Array.isArray(exploration.heatmapProbabilities) ||
      !exploration.heatmapProbabilities.every(Number.isFinite) ||
      !Array.isArray(exploration.heatmapFractions) ||
      !exploration.heatmapFractions.every(Number.isFinite) ||
      !hasFiniteFields(exploration, ["sweepPathCount", "heatmapPathCount"])
    )
      return false;
    const heatmap = exploration.heatmap as Array<{
      winProbability: number;
      fraction: number;
    }>;
    const probabilities = exploration.heatmapProbabilities as number[];
    const fractions = exploration.heatmapFractions as number[];
    const coordinates = new Set(
      heatmap.map(
        (cell) =>
          `${cell.winProbability.toString()}:${cell.fraction.toString()}`,
      ),
    );
    return (
      probabilities.every((probability) =>
        fractions.every((fraction) =>
          coordinates.has(`${probability.toString()}:${fraction.toString()}`),
        ),
      ) && containsOnlyFiniteNumbers(body)
    );
  })();

const KELLY_COMPARISON_LABELS = new Set<string>([
  "No stake",
  "Current size",
  "Conservative Kelly",
  "Estimated-p Kelly",
]);

const isKellyResponse = (
  body: unknown,
): body is { comparison: KellyComparisonPoint[] } => {
  if (
    !isRecord(body) ||
    !Array.isArray(body.comparison) ||
    body.comparison.length !== KELLY_COMPARISON_LABELS.size
  ) {
    return false;
  }
  const labels = new Set<unknown>();
  const validPoints = body.comparison.every((point) => {
    if (!isRecord(point)) return false;
    labels.add(point.label);
    return (
      typeof point.label === "string" &&
      KELLY_COMPARISON_LABELS.has(point.label) &&
      hasFiniteFields(point, [
        "fraction",
        "pathCount",
        "medianTerminalCapital",
        "p05TerminalCapital",
        "p95TerminalCapital",
        "probabilityOfPracticalRuin",
        "medianMaxDrawdown",
      ])
    );
  });
  return (
    validPoints &&
    labels.size === KELLY_COMPARISON_LABELS.size &&
    containsOnlyFiniteNumbers(body)
  );
};

const request = async <ResponseBody>(
  path: string,
  input: SimulationInput,
  signal: AbortSignal,
  validate: (body: unknown) => body is ResponseBody,
): Promise<ResponseBody> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new ApiError(
      "Could not reach the local simulation API.",
      "unavailable",
    );
  }
  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new ApiError(
      "The local simulation API returned an unreadable response.",
      "malformed",
    );
  }
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The local simulation API rejected the request.";
    const details =
      isRecord(body) &&
      Array.isArray(body.details) &&
      body.details.every((detail) => typeof detail === "string")
        ? body.details
        : [];
    throw new ApiError(message, "rejected", details);
  }
  if (!validate(body)) {
    throw new ApiError(
      "The local simulation API returned a malformed result.",
      "malformed",
    );
  }
  return body;
};

export const describeLabFailure = (error: unknown): LabFailure =>
  error instanceof ApiError
    ? { message: error.message, kind: error.kind, details: error.details }
    : {
        message: error instanceof Error ? error.message : "Simulation failed.",
        kind: "unknown",
        details: [],
      };

export const loadLabData = async (
  input: SimulationInput,
  signal: AbortSignal,
): Promise<LabData> => {
  const [simulationBody, explorationBody, kellyBody] = await Promise.all([
    request<{ simulation: SimulationResult }>(
      "/api/simulate",
      input,
      signal,
      isSimulationResponse,
    ),
    request<{ exploration: ExplorationResult }>(
      "/api/explore",
      input,
      signal,
      isExplorationResponse,
    ),
    request<{ comparison: KellyComparisonPoint[] }>(
      "/api/kelly",
      input,
      signal,
      isKellyResponse,
    ),
  ]);
  return {
    simulation: simulationBody.simulation,
    exploration: explorationBody.exploration,
    comparison: kellyBody.comparison,
  };
};
