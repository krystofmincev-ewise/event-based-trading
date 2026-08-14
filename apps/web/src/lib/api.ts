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

const isSimulationInput = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.seed === "string" &&
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
    "tradeCount",
    "effectiveTradesPerWeek",
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
    "approximatedLargeContractExecutions",
  ]) &&
  hasStringFields(value, ["seed", "simulationModel"]) &&
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

const isKellyResponse = (
  body: unknown,
): body is { comparison: KellyComparisonPoint[] } =>
  isRecord(body) &&
  Array.isArray(body.comparison) &&
  body.comparison.length === 4 &&
  body.comparison.every(
    (point) =>
      isRecord(point) &&
      hasFiniteFields(point, [
        "fraction",
        "pathCount",
        "medianTerminalCapital",
        "p05TerminalCapital",
        "p95TerminalCapital",
        "probabilityOfPracticalRuin",
        "medianMaxDrawdown",
      ]),
  ) &&
  containsOnlyFiniteNumbers(body);

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
