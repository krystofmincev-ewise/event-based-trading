import {
  capitalFromLog,
  drawdownFromLogCapital,
  updateLogCapital,
} from "./bankroll.js";
import {
  calculateKelly,
  deriveContractEconomics,
  wholeContractPosition,
} from "./kelly.js";
import { createWeeklyReturnAccumulator } from "./metrics.js";
import {
  hashSeed,
  poissonFromUniform,
  randomStreamAt,
  standardNormalAt,
} from "./prng.js";
import {
  createHistogram,
  mean,
  quantileSorted,
  sortedCopy,
  summarizeQuantiles,
} from "./statistics.js";
import {
  appendNumericalWarnings,
  impliedCagr,
  positionForLogCapital,
} from "./simulationHelpers.js";
import type {
  FanPoint,
  SamplePath,
  SimulationDefinitions,
  SimulationInput,
  SimulationResult,
} from "./types.js";

const CHECKPOINT_LIMIT = 65;
const SAMPLE_PATH_LIMIT = 6;

const DEFINITIONS: SimulationDefinitions = {
  winMultiplier: "Capital × (1 + executed f × event-specific net win odds).",
  lossMultiplier: "Capital × (1 − executed f).",
  practicalRuin:
    "First post-trade capital at or below the configured fraction of starting capital; the crossed positive value is retained and the path is then frozen.",
  expectedTerminal:
    "Arithmetic mean across simulated terminal capitals. It can be unstable when rare right-tail outcomes dominate.",
  continuousFractionExpectedTerminal:
    "Central-input continuous-fraction reference. Under Poisson arrivals it uses the Poisson probability-generating function and ignores estimation, regime, execution-cost, whole-contract, and ruin-stop effects.",
  quantiles:
    "R-7 linear interpolation across paths at a common week checkpoint.",
  maximumDrawdown:
    "Pathwise maximum of 1 − capital/running peak, including starting capital and the threshold-crossing observation.",
  sharpe:
    "Pooled simulated end-of-week return minus the geometrically converted weekly risk-free return, divided by weekly sample volatility and annualized by √52. Dependence is intentionally modeled, so this square-root annualization is only an approximation.",
  sortino:
    "Pooled simulated end-of-week excess return divided by full-sample downside deviation relative to the weekly risk-free return, annualized by √52.",
  wholeContractExecution:
    "Before each realized opportunity, floor(target fraction × current bankroll / sampled all-in contract cost) determines an integer contract count. Unused risk budget remains cash.",
};

const logistic = (value: number) => 1 / (1 + Math.exp(-value));
const logit = (probability: number) =>
  Math.log(probability / (1 - probability));
const clampProbability = (probability: number) =>
  Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, probability));

const sampleGamma = (
  shape: number,
  seedHash: number,
  pathIndex: number,
  streamBase: number,
): number => {
  if (shape < 1) {
    const uniform = randomStreamAt(seedHash, pathIndex, 0, streamBase);
    return (
      sampleGamma(shape + 1, seedHash, pathIndex, streamBase + 17) *
      uniform ** (1 / shape)
    );
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const normal = standardNormalAt(
      seedHash,
      pathIndex,
      attempt + 1,
      streamBase + 31,
    );
    const transformed = 1 + c * normal;
    if (transformed <= 0) continue;
    const candidate = d * transformed ** 3;
    const uniform = randomStreamAt(
      seedHash,
      pathIndex,
      attempt + 1,
      streamBase + 47,
    );
    if (
      uniform < 1 - 0.0331 * normal ** 4 ||
      Math.log(uniform) <
        0.5 * normal ** 2 + d * (1 - candidate / d + Math.log(candidate / d))
    ) {
      return candidate;
    }
  }
  throw new Error("Gamma sampler did not converge for a valid shape.");
};

const sampleBeta = (
  meanProbability: number,
  effectiveSampleSize: number,
  seedHash: number,
  pathIndex: number,
): number => {
  const alpha = meanProbability * effectiveSampleSize;
  const beta = (1 - meanProbability) * effectiveSampleSize;
  const left = sampleGamma(alpha, seedHash, pathIndex, 401);
  const right = sampleGamma(beta, seedHash, pathIndex, 809);
  const total = left + right;
  return total === 0 ? meanProbability : clampProbability(left / total);
};

const HERMITE_NODES = [
  -3.436159118837738, -2.53273167423279, -1.756683649299882, -1.036610829789514,
  -0.342901327223705, 0.342901327223705, 1.036610829789514, 1.756683649299882,
  2.53273167423279, 3.436159118837738,
] as const;
const HERMITE_WEIGHTS = [
  0.000007640432856, 0.001343645746781, 0.033874394455482, 0.240138611082315,
  0.610862633735326, 0.610862633735326, 0.240138611082315, 0.033874394455482,
  0.001343645746781, 0.000007640432856,
] as const;

const logisticNormalMean = (intercept: number, standardDeviation: number) => {
  let weighted = 0;
  for (let index = 0; index < HERMITE_NODES.length; index += 1) {
    weighted +=
      HERMITE_WEIGHTS[index]! *
      logistic(
        intercept + Math.SQRT2 * standardDeviation * HERMITE_NODES[index]!,
      );
  }
  return weighted / Math.sqrt(Math.PI);
};

const meanPreservingLogitIntercept = (
  probability: number,
  standardDeviation: number,
) => {
  if (standardDeviation === 0) return logit(probability);
  let lower = -40;
  let upper = 40;
  for (let iteration = 0; iteration < 45; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (logisticNormalMean(midpoint, standardDeviation) < probability) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }
  return (lower + upper) / 2;
};

const checkpointWeeks = (horizonWeeks: number): number[] => {
  const count = Math.min(CHECKPOINT_LIMIT, horizonWeeks + 1);
  const values = new Set<number>([0, horizonWeeks]);
  for (let index = 0; index < count; index += 1) {
    values.add(Math.round((index / Math.max(1, count - 1)) * horizonWeeks));
  }
  return [...values].sort((left, right) => left - right);
};

const samplePathIndices = (pathCount: number): number[] => {
  const count = Math.min(SAMPLE_PATH_LIMIT, pathCount);
  return Array.from({ length: count }, (_, index) =>
    Math.round((index / Math.max(1, count - 1)) * (pathCount - 1)),
  );
};

const samplePathProbability = (
  input: SimulationInput,
  seedHash: number,
  pathIndex: number,
): number => {
  if (
    !input.calibrationUncertaintyEnabled ||
    input.winProbability === 0 ||
    input.winProbability === 1
  ) {
    return input.winProbability;
  }
  return sampleBeta(
    clampProbability(input.winProbability),
    input.calibrationEffectiveSampleSize,
    seedHash,
    pathIndex,
  );
};

const sampleCost = (
  input: SimulationInput,
  seedHash: number,
  pathIndex: number,
  tradeIndex: number,
): { cost: number | null; skipped: boolean } => {
  if (
    input.roundTripCosts === 0 ||
    input.executionCostCoefficientVariation === 0
  ) {
    return { cost: input.roundTripCosts, skipped: false };
  }
  const sigma = Math.sqrt(
    Math.log1p(input.executionCostCoefficientVariation ** 2),
  );
  const multiplier = Math.exp(
    -0.5 * sigma ** 2 +
      sigma * standardNormalAt(seedHash, pathIndex, tradeIndex, 211),
  );
  const sampled = input.roundTripCosts * multiplier;
  const remainingPayout = input.settlementPayout - input.contractPurchasePrice;
  return {
    cost: sampled < remainingPayout ? sampled : null,
    skipped: sampled >= remainingPayout,
  };
};

export const runStochasticSimulation = (
  input: SimulationInput,
): SimulationResult => {
  const horizonYears = input.horizonWeeks / 52;
  const expectedTradeCount = input.eventsPerWeek * input.horizonWeeks;
  const baselineEconomics = deriveContractEconomics(
    input.contractPurchasePrice,
    input.settlementPayout,
    input.roundTripCosts,
  );
  const initialPosition = wholeContractPosition(
    input.startingCapital,
    input.positionFraction,
    baselineEconomics.allInCost,
  );
  const checkpoints = checkpointWeeks(input.horizonWeeks);
  const checkpointIndexByWeek = new Map(
    checkpoints.map((week, index) => [week, index]),
  );
  const checkpointCapitals = checkpoints.map(
    () => new Float64Array(input.pathCount),
  );
  const sampleIndices = samplePathIndices(input.pathCount);
  const sampleSlotByPath = new Map(
    sampleIndices.map((path, index) => [path, index]),
  );
  const samplePaths: SamplePath[] = sampleIndices.map((id) => ({
    id,
    points: [],
  }));
  const terminals = new Float64Array(input.pathCount);
  const terminalReturns = new Float64Array(input.pathCount);
  const maxDrawdowns = new Float64Array(input.pathCount);
  const realizedTradeCounts = new Float64Array(input.pathCount);
  const latentProbabilities = new Float64Array(input.pathCount);
  const weeklyReturns = createWeeklyReturnAccumulator(input.annualRiskFreeRate);
  const seedHash = hashSeed(input.seed);
  const startLog = Math.log(input.startingCapital);
  const ruinLog = startLog + Math.log(input.ruinThresholdFraction);
  let practicalRuinCount = 0;
  let lossCount = 0;
  let severeDrawdownCount = 0;
  let cappedPathCount = 0;
  let approximatedLargeContractExecutions = 0;
  let zeroExecutableTerminalCount = 0;
  let executableOpportunityCount = 0;
  let zeroContractOpportunityCount = 0;
  let totalExecutedFraction = 0;
  let skippedInvalidCostOpportunityCount = 0;
  let weeklyProbabilitySum = 0;
  let weeklyProbabilityObservationCount = 0;

  for (let pathIndex = 0; pathIndex < input.pathCount; pathIndex += 1) {
    let logCapital = startLog;
    let capital = input.startingCapital;
    let peakLogCapital = startLog;
    let maxDrawdown = 0;
    let stopped = false;
    let pathCrossedDisplayRange = false;
    let pathTradeCount = 0;
    const pathProbability = samplePathProbability(input, seedHash, pathIndex);
    const weeklyProbabilityIntercept =
      pathProbability === 0 || pathProbability === 1
        ? 0
        : meanPreservingLogitIntercept(
            pathProbability,
            input.weeklyProbabilityLogitStdDev,
          );
    latentProbabilities[pathIndex] = pathProbability;
    const sampleSlot = sampleSlotByPath.get(pathIndex);
    checkpointCapitals[0]![pathIndex] = capital;
    if (sampleSlot !== undefined) {
      samplePaths[sampleSlot]!.points.push({ trade: 0, week: 0, capital });
    }

    for (let week = 1; week <= input.horizonWeeks; week += 1) {
      const opportunityCount =
        input.opportunityArrival === "fixed"
          ? input.eventsPerWeek
          : poissonFromUniform(
              input.eventsPerWeek,
              randomStreamAt(seedHash, pathIndex, week, 1),
            );
      const weeklyProbability =
        pathProbability === 0 || pathProbability === 1
          ? pathProbability
          : logistic(
              weeklyProbabilityIntercept +
                standardNormalAt(seedHash, pathIndex, week, 11) *
                  input.weeklyProbabilityLogitStdDev,
            );
      weeklyProbabilitySum += weeklyProbability;
      weeklyProbabilityObservationCount += 1;
      let weeklyLogReturn = 0;
      for (
        let opportunity = 0;
        opportunity < opportunityCount;
        opportunity += 1
      ) {
        pathTradeCount += 1;
        if (stopped || input.positionFraction === 0) continue;
        const sampledCost = sampleCost(
          input,
          seedHash,
          pathIndex,
          pathTradeCount,
        );
        if (sampledCost.skipped || sampledCost.cost === null) {
          skippedInvalidCostOpportunityCount += 1;
          continue;
        }
        const economics = deriveContractEconomics(
          input.contractPurchasePrice,
          input.settlementPayout,
          sampledCost.cost,
        );
        const execution = positionForLogCapital(
          logCapital,
          capital,
          input.positionFraction,
          economics.allInCost,
        );
        executableOpportunityCount += 1;
        totalExecutedFraction += execution.executedFraction;
        if (execution.executedFraction === 0) zeroContractOpportunityCount += 1;
        if (execution.approximated) approximatedLargeContractExecutions += 1;
        const won =
          randomStreamAt(seedHash, pathIndex, pathTradeCount, 31) <
          weeklyProbability;
        const executedFraction = execution.executedFraction;
        const logReturn =
          !won && executedFraction === 1
            ? Number.NEGATIVE_INFINITY
            : won
              ? Math.log1p(executedFraction * economics.netWinMultiple)
              : Math.log1p(-executedFraction);
        const step = updateLogCapital(
          logCapital,
          won,
          executedFraction,
          economics.netWinMultiple,
        );
        logCapital = step.logCapital;
        weeklyLogReturn += logReturn;
        capital = step.capital;
        pathCrossedDisplayRange ||= step.overflowed || step.underflowed;
        peakLogCapital = Math.max(peakLogCapital, logCapital);
        maxDrawdown = Math.max(
          maxDrawdown,
          drawdownFromLogCapital(logCapital, peakLogCapital),
        );
        if (logCapital <= ruinLog) {
          stopped = true;
          practicalRuinCount += 1;
        }
      }
      weeklyReturns.add(
        weeklyLogReturn === Number.NEGATIVE_INFINITY
          ? -1
          : Math.expm1(weeklyLogReturn),
      );
      const checkpointIndex = checkpointIndexByWeek.get(week);
      if (checkpointIndex !== undefined) {
        checkpointCapitals[checkpointIndex]![pathIndex] = capital;
        if (sampleSlot !== undefined) {
          samplePaths[sampleSlot]!.points.push({
            trade: pathTradeCount,
            week,
            capital,
          });
        }
      }
    }

    realizedTradeCounts[pathIndex] = pathTradeCount;
    terminals[pathIndex] = capital;
    terminalReturns[pathIndex] = capital / input.startingCapital - 1;
    maxDrawdowns[pathIndex] = maxDrawdown;
    if (capital < input.startingCapital) lossCount += 1;
    if (
      input.positionFraction > 0 &&
      wholeContractPosition(
        capital,
        input.positionFraction,
        baselineEconomics.allInCost,
      ).contractCount === 0
    ) {
      zeroExecutableTerminalCount += 1;
    }
    if (maxDrawdown >= input.severeDrawdownFraction) severeDrawdownCount += 1;
    if (pathCrossedDisplayRange) cappedPathCount += 1;
  }

  const terminalSummary = summarizeQuantiles(terminals);
  const expectedTerminalCapital = mean(terminals);
  const sortedDrawdowns = sortedCopy(maxDrawdowns);
  const centralGain =
    input.positionFraction *
    (baselineEconomics.netWinMultiple * input.winProbability -
      (1 - input.winProbability));
  const analyticalLog =
    input.opportunityArrival === "poisson"
      ? startLog + expectedTradeCount * centralGain
      : startLog + expectedTradeCount * Math.log1p(centralGain);
  const analyticalTerminal = capitalFromLog(analyticalLog);
  const annualized = weeklyReturns.finish();
  const kelly = calculateKelly(
    input.winProbability,
    input.probabilityHaircut,
    input.contractPurchasePrice,
    input.settlementPayout,
    input.roundTripCosts,
  );
  const expectedTerminalCagr = impliedCagr(
    expectedTerminalCapital,
    input.startingCapital,
    horizonYears,
  );
  const medianTerminalCagr = impliedCagr(
    terminalSummary.median,
    input.startingCapital,
    horizonYears,
  );
  const cagrOutputCapped =
    expectedTerminalCagr.capped || medianTerminalCagr.capped;
  const fan: FanPoint[] = checkpoints.map((week, index) => ({
    trade: Math.round(week * input.eventsPerWeek),
    week,
    ...summarizeQuantiles(checkpointCapitals[index]!),
  }));
  const warnings = [
    input.calibrationUncertaintyEnabled
      ? "The model samples a mean-preserving beta calibration state once per path; this creates persistent estimation risk."
      : "Path-level calibration uncertainty is disabled; every path starts from the visible central probability.",
    input.weeklyProbabilityLogitStdDev > 0
      ? "A shared weekly log-odds shock creates within-week outcome clustering."
      : "Weekly probability regime shocks are disabled.",
    input.opportunityArrival === "poisson"
      ? "Eligible opportunities follow a Poisson arrival model. Every realized weekly count is an integer; the mean opportunities input may be fractional."
      : "Eligible opportunities use an exact fixed integer schedule.",
    "Execution costs use a right-skewed lognormal stress distribution that is mean-preserving before invalid fills are skipped. Its coefficient of variation is a user policy input, not a sector-specific market estimate.",
    "Probability, opportunity, and execution-cost stresses are synthetic sensitivity models. They do not replace a timestamped event ledger or joint historical quote/outcome data.",
    "The sizing target uses the visible central estimate and never sees a path's hidden probability draw.",
    "Displayed Kelly fractions are plug-in central-probability calculations with the manual haircut; they do not optimize over the calibration, weekly-regime, or execution-cost distributions.",
    "A path-dependent one-touch barrier cannot be inferred from terminal return context; it requires matched intraday high/low or path data.",
  ];
  if (
    kelly.conservative.expectedProfitPerContract <= 0 &&
    input.positionFraction > 0
  ) {
    warnings.push(
      "The conservative central probability has non-positive expected value; conservative Kelly allocates zero under these inputs.",
    );
  }
  if (
    input.winProbability < 0.5 &&
    input.winProbability > baselineEconomics.breakEvenProbability
  ) {
    warnings.push(
      "The central hit rate is below 50% but positive-EV against the supplied all-in break-even probability.",
    );
  }
  if (input.positionFraction > 0 && initialPosition.contractCount === 0) {
    warnings.push(
      "The starting risk budget cannot purchase one whole contract at mean cost.",
    );
  }
  if (skippedInvalidCostOpportunityCount > 0) {
    warnings.push(
      `${skippedInvalidCostOpportunityCount.toLocaleString("en-US")} execution-cost draws would have made all-in cost meet or exceed payout, so those opportunities were treated as unexecutable and skipped.`,
    );
  }
  appendNumericalWarnings(warnings, {
    approximatedLargeContractExecutions,
    riskAdjustedRatioUndefined:
      annualized.sharpe === null || annualized.sortino === null,
    cappedPathCount,
    continuousFractionReferenceCapped:
      analyticalTerminal.overflowed || analyticalTerminal.underflowed,
    cagrOutputCapped,
    practicalRuinCount,
  });

  return {
    input,
    kelly,
    metrics: {
      expectedTerminalCapital,
      continuousFractionExpectedTerminalCapitalReference:
        analyticalTerminal.capital,
      terminalCapital: terminalSummary,
      expectedTotalReturn: expectedTerminalCapital / input.startingCapital - 1,
      medianTotalReturn: terminalSummary.median / input.startingCapital - 1,
      impliedCagrFromExpectedTerminal: expectedTerminalCagr.value,
      impliedCagrFromMedianTerminal: medianTerminalCagr.value,
      probabilityOfLoss: lossCount / input.pathCount,
      probabilityOfPracticalRuin: practicalRuinCount / input.pathCount,
      medianMaxDrawdown: quantileSorted(sortedDrawdowns, 0.5),
      p90MaxDrawdown: quantileSorted(sortedDrawdowns, 0.9),
      probabilityOfSevereDrawdown: severeDrawdownCount / input.pathCount,
      probabilityOfZeroExecutablePositionAtEnd:
        zeroExecutableTerminalCount / input.pathCount,
      annualized,
    },
    fan,
    samplePaths,
    terminalReturnHistogram: createHistogram(terminalReturns),
    maxDrawdownHistogram: createHistogram(maxDrawdowns),
    metadata: {
      expectedOpportunityCount: expectedTradeCount,
      effectiveOpportunitiesPerWeek:
        mean(realizedTradeCounts) / input.horizonWeeks,
      horizonYears,
      pathCount: input.pathCount,
      seed: input.seed,
      checkpointCount: checkpoints.length,
      retainedSamplePathCount: samplePaths.length,
      practicalRuinCapital: input.startingCapital * input.ruinThresholdFraction,
      severeDrawdownFraction: input.severeDrawdownFraction,
      cappedPathCount,
      continuousFractionReferenceCapped:
        analyticalTerminal.overflowed || analyticalTerminal.underflowed,
      cagrOutputCapped,
      initialWholeContractCount: initialPosition.contractCount,
      initialCapitalAtRisk: initialPosition.capitalAtRisk,
      initialExecutedFraction: initialPosition.executedFraction,
      eligiblePositionAttemptCount: executableOpportunityCount,
      meanExecutedFractionPerEligibleAttempt:
        executableOpportunityCount === 0
          ? null
          : totalExecutedFraction / executableOpportunityCount,
      zeroContractRatePerEligibleAttempt:
        executableOpportunityCount === 0
          ? null
          : zeroContractOpportunityCount / executableOpportunityCount,
      approximatedLargeContractExecutions,
      skippedInvalidCostOpportunityCount,
      continuousFractionReferenceIgnoresWholeContractRounding: true,
      realizedOpportunityCount: summarizeQuantiles(realizedTradeCounts),
      latentWinProbability: summarizeQuantiles(latentProbabilities),
      meanLatentWinProbability: mean(latentProbabilities),
      meanWeeklyWinProbability:
        weeklyProbabilityObservationCount === 0
          ? input.winProbability
          : weeklyProbabilitySum / weeklyProbabilityObservationCount,
      simulationModel: "stochastic binary whole-contract target-fraction",
    },
    definitions: DEFINITIONS,
    warnings,
  };
};
