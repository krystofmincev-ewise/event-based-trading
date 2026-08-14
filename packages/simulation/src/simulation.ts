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
import { hashSeed, randomAt } from "./prng.js";
import {
  appendNumericalWarnings,
  impliedCagr,
  positionForLogCapital,
} from "./simulationHelpers.js";
import {
  createHistogram,
  mean,
  quantileSorted,
  sortedCopy,
  summarizeQuantiles,
} from "./statistics.js";
import type {
  FanPoint,
  SamplePath,
  SimulationDefinitions,
  SimulationInput,
  SimulationResult,
} from "./types.js";
import { runStochasticSimulation } from "./stochasticSimulation.js";

const FAN_POINT_LIMIT = 65;
const SAMPLE_PATH_LIMIT = 6;

const DEFINITIONS: SimulationDefinitions = {
  winMultiplier: "Capital × (1 + f × b), where b is NET profit per unit stake.",
  lossMultiplier:
    "Capital × (1 − f). The stake is a fraction f of current capital.",
  practicalRuin:
    "First post-trade capital at or below the configured fraction of starting capital; the crossed positive value is retained and the path is then frozen.",
  expectedTerminal:
    "Arithmetic mean across simulated terminal capitals. It can be unstable when rare right-tail outcomes dominate.",
  continuousFractionExpectedTerminal:
    "Closed-form B₀[1 + f(bp − (1 − p))]^N as a continuous-fraction, unstopped reference. It is not an exact whole-contract expectation because contract flooring is path-dependent.",
  quantiles:
    "R-7 linear interpolation across paths at a common trade checkpoint.",
  maximumDrawdown:
    "Pathwise maximum of 1 − capital/running peak, including starting capital and the threshold-crossing observation.",
  sharpe:
    "Pooled simulated end-of-week return minus the geometrically converted weekly risk-free return, divided by weekly sample volatility and annualized by √52. IID square-root-of-time annualization assumes no serial correlation.",
  sortino:
    "Pooled simulated end-of-week excess return divided by full-sample downside deviation relative to the weekly risk-free return, annualized by √52.",
  wholeContractExecution:
    "Before each event, floor(target fraction × current bankroll / all-in contract cost) determines an integer contract count. Unused risk budget remains cash.",
};

const checkpointTrades = (tradeCount: number): number[] => {
  const count = Math.min(FAN_POINT_LIMIT, tradeCount + 1);
  const values = new Set<number>([0, tradeCount]);
  for (let index = 0; index < count; index += 1) {
    values.add(Math.round((index / Math.max(1, count - 1)) * tradeCount));
  }
  return [...values].sort((left, right) => left - right);
};

const samplePathIndices = (pathCount: number): number[] => {
  const count = Math.min(SAMPLE_PATH_LIMIT, pathCount);
  return Array.from({ length: count }, (_, index) =>
    Math.round((index / Math.max(1, count - 1)) * (pathCount - 1)),
  );
};

export const runFixedSimulation = (
  input: SimulationInput,
): SimulationResult => {
  const tradeCount = input.eventsPerWeek * input.horizonWeeks;
  const horizonYears = input.horizonWeeks / 52;
  const effectiveTradesPerWeek = input.eventsPerWeek;
  const economics = deriveContractEconomics(
    input.contractPurchasePrice,
    input.settlementPayout,
    input.roundTripCosts,
  );
  const initialPosition = wholeContractPosition(
    input.startingCapital,
    input.positionFraction,
    economics.allInCost,
  );
  const checkpointTradeValues = checkpointTrades(tradeCount);
  const checkpointIndexByTrade = new Map(
    checkpointTradeValues.map((trade, index) => [trade, index]),
  );
  const checkpointCapitals = checkpointTradeValues.map(
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
  const maxDrawdowns = new Float64Array(input.pathCount);
  const terminalReturns = new Float64Array(input.pathCount);
  const seedHash = hashSeed(input.seed);
  const weeklyEndTrades = new Map<number, number>();
  for (let week = 1; week <= input.horizonWeeks; week += 1) {
    const endTrade = Math.max(
      1,
      Math.round((week * tradeCount) / input.horizonWeeks),
    );
    weeklyEndTrades.set(endTrade, (weeklyEndTrades.get(endTrade) ?? 0) + 1);
  }
  const weeklyReturns = createWeeklyReturnAccumulator(input.annualRiskFreeRate);
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

  for (let pathIndex = 0; pathIndex < input.pathCount; pathIndex += 1) {
    let logCapital = startLog;
    let capital = input.startingCapital;
    let peakLogCapital = startLog;
    let maxDrawdown = 0;
    let stopped = false;
    let weeklyLogReturn = 0;
    let pathCrossedDisplayRange = false;

    checkpointCapitals[0]![pathIndex] = capital;
    const sampleSlot = sampleSlotByPath.get(pathIndex);
    if (sampleSlot !== undefined) {
      samplePaths[sampleSlot]!.points.push({ trade: 0, week: 0, capital });
    }

    for (let trade = 1; trade <= tradeCount; trade += 1) {
      if (!stopped && input.positionFraction > 0) {
        const won =
          randomAt(seedHash, pathIndex, trade - 1) < input.winProbability;
        const execution = positionForLogCapital(
          logCapital,
          capital,
          input.positionFraction,
          economics.allInCost,
        );
        executableOpportunityCount += 1;
        totalExecutedFraction += execution.executedFraction;
        if (execution.executedFraction === 0) {
          zeroContractOpportunityCount += 1;
        }
        if (execution.approximated) approximatedLargeContractExecutions += 1;
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

      const weeksEndingHere = weeklyEndTrades.get(trade) ?? 0;
      for (let weekOffset = 0; weekOffset < weeksEndingHere; weekOffset += 1) {
        const weeklyReturn =
          weeklyLogReturn === Number.NEGATIVE_INFINITY
            ? -1
            : Math.expm1(weeklyLogReturn);
        weeklyReturns.add(weeklyReturn);
        weeklyLogReturn = 0;
      }

      const checkpointIndex = checkpointIndexByTrade.get(trade);
      if (checkpointIndex !== undefined) {
        checkpointCapitals[checkpointIndex]![pathIndex] = capital;
        if (sampleSlot !== undefined) {
          samplePaths[sampleSlot]!.points.push({
            trade,
            week: (trade / tradeCount) * input.horizonWeeks,
            capital,
          });
        }
      }
    }

    terminals[pathIndex] = capital;
    terminalReturns[pathIndex] = capital / input.startingCapital - 1;
    maxDrawdowns[pathIndex] = maxDrawdown;
    if (capital < input.startingCapital) lossCount += 1;
    if (
      input.positionFraction > 0 &&
      wholeContractPosition(
        capital,
        input.positionFraction,
        economics.allInCost,
      ).contractCount === 0
    ) {
      zeroExecutableTerminalCount += 1;
    }
    if (maxDrawdown >= input.severeDrawdownFraction) severeDrawdownCount += 1;
    if (pathCrossedDisplayRange) cappedPathCount += 1;
  }

  const terminalSummary = summarizeQuantiles(terminals);
  const sortedDrawdowns = sortedCopy(maxDrawdowns);
  const expectedTerminalCapital = mean(terminals);
  const meanMultiplier =
    1 +
    input.positionFraction *
      (economics.netWinMultiple * input.winProbability -
        (1 - input.winProbability));
  const analyticalTerminal = capitalFromLog(
    startLog + tradeCount * Math.log(meanMultiplier),
  );
  const continuousFractionExpectedTerminalCapitalReference =
    analyticalTerminal.capital;
  const continuousFractionReferenceCapped =
    analyticalTerminal.overflowed || analyticalTerminal.underflowed;

  const fan: FanPoint[] = checkpointTradeValues.map((trade, index) => ({
    trade,
    week: (trade / tradeCount) * input.horizonWeeks,
    ...summarizeQuantiles(checkpointCapitals[index]!),
  }));
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
  const warnings: string[] = [
    "Outcomes are iid with stationary probability and contract terms; clustering, correlation, liquidity limits, taxes, market impact, and regime shifts are not modeled.",
    "The probability haircut is a user-chosen uncertainty allowance, not a confidence interval or proof of calibration.",
    "This model accepts an abstract user-supplied event or one-touch barrier-hit probability. A path-dependent barrier option cannot be priced from hit rate alone.",
    "The closed-form expected-terminal figure is a continuous-fraction reference; path-dependent whole-contract flooring means it is not an exact expectation for the executable simulation.",
  ];
  if (
    kelly.conservative.expectedProfitPerContract <= 0 &&
    input.positionFraction > 0
  ) {
    warnings.push(
      "The conservative probability has non-positive expected value; conservative Kelly allocates zero under these inputs.",
    );
  }
  if (
    input.winProbability < 0.5 &&
    input.winProbability > economics.breakEvenProbability
  ) {
    warnings.push(
      "The estimated hit rate is below 50% but still positive-EV because it exceeds the all-in contract break-even probability.",
    );
  }
  if (input.positionFraction > 0 && initialPosition.contractCount === 0) {
    warnings.push(
      "The starting risk budget cannot purchase one whole contract, so no position is initially executable.",
    );
  }
  appendNumericalWarnings(warnings, {
    approximatedLargeContractExecutions,
    riskAdjustedRatioUndefined:
      annualized.sharpe === null || annualized.sortino === null,
    cappedPathCount,
    continuousFractionReferenceCapped,
    cagrOutputCapped,
    practicalRuinCount,
  });

  return {
    input,
    kelly,
    metrics: {
      expectedTerminalCapital,
      continuousFractionExpectedTerminalCapitalReference,
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
      expectedOpportunityCount: tradeCount,
      effectiveOpportunitiesPerWeek: effectiveTradesPerWeek,
      horizonYears,
      pathCount: input.pathCount,
      seed: input.seed,
      checkpointCount: checkpointTradeValues.length,
      retainedSamplePathCount: samplePaths.length,
      practicalRuinCapital: input.startingCapital * input.ruinThresholdFraction,
      severeDrawdownFraction: input.severeDrawdownFraction,
      cappedPathCount,
      continuousFractionReferenceCapped,
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
      skippedInvalidCostOpportunityCount: 0,
      continuousFractionReferenceIgnoresWholeContractRounding: true,
      realizedOpportunityCount: {
        p05: tradeCount,
        p25: tradeCount,
        median: tradeCount,
        p75: tradeCount,
        p95: tradeCount,
      },
      latentWinProbability: {
        p05: input.winProbability,
        p25: input.winProbability,
        median: input.winProbability,
        p75: input.winProbability,
        p95: input.winProbability,
      },
      meanLatentWinProbability: input.winProbability,
      meanWeeklyWinProbability: input.winProbability,
      simulationModel: "iid binary whole-contract target-fraction",
    },
    definitions: DEFINITIONS,
    warnings,
  };
};

export const runSimulation = (input: SimulationInput): SimulationResult =>
  input.opportunityArrival === "poisson" ||
  input.calibrationUncertaintyEnabled ||
  input.weeklyProbabilityLogitStdDev > 0 ||
  input.executionCostCoefficientVariation > 0
    ? runStochasticSimulation(input)
    : runFixedSimulation(input);
