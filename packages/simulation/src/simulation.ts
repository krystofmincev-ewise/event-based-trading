import { capitalFromLog, updateLogCapital } from "./bankroll.js";
import { calculateKelly } from "./kelly.js";
import { createWeeklyReturnAccumulator } from "./metrics.js";
import { hashSeed, randomAt } from "./prng.js";
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
  quantiles:
    "R-7 linear interpolation across paths at a common trade checkpoint.",
  maximumDrawdown:
    "Pathwise maximum of 1 − capital/running peak, including starting capital and the threshold-crossing observation.",
  sharpe:
    "Pooled simulated end-of-week return minus the geometrically converted weekly risk-free return, divided by weekly sample volatility and annualized by √52. IID square-root-of-time annualization assumes no serial correlation.",
  sortino:
    "Pooled simulated end-of-week excess return divided by full-sample downside deviation relative to the weekly risk-free return, annualized by √52.",
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

const safePower = (
  base: number,
  exponent: number,
): { capital: number; overflowed: boolean } => {
  const logValue = exponent * Math.log(base);
  return capitalFromLog(logValue);
};

const impliedCagr = (
  terminalCapital: number,
  startingCapital: number,
  years: number,
): number => {
  if (terminalCapital === 0) return -1;
  return Math.exp(Math.log(terminalCapital / startingCapital) / years) - 1;
};

export const runSimulation = (input: SimulationInput): SimulationResult => {
  const tradeCount = Math.max(
    1,
    Math.round(input.tradesPerWeek * input.horizonWeeks),
  );
  const horizonYears = input.horizonWeeks / 52;
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
  let overflowedValueCount = 0;

  for (let pathIndex = 0; pathIndex < input.pathCount; pathIndex += 1) {
    let logCapital = startLog;
    let capital = input.startingCapital;
    let peakCapital = input.startingCapital;
    let maxDrawdown = 0;
    let stopped = false;
    let previousWeekCapital = input.startingCapital;

    checkpointCapitals[0]![pathIndex] = capital;
    const sampleSlot = sampleSlotByPath.get(pathIndex);
    if (sampleSlot !== undefined) {
      samplePaths[sampleSlot]!.points.push({ trade: 0, week: 0, capital });
    }

    for (let trade = 1; trade <= tradeCount; trade += 1) {
      if (!stopped && input.positionFraction > 0) {
        const won =
          randomAt(seedHash, pathIndex, trade - 1) < input.winProbability;
        const step = updateLogCapital(
          logCapital,
          won,
          input.positionFraction,
          input.netWinMultiple,
        );
        logCapital = step.logCapital;
        capital = step.capital;
        if (step.overflowed) overflowedValueCount += 1;
        peakCapital = Math.max(peakCapital, capital);
        maxDrawdown = Math.max(maxDrawdown, 1 - capital / peakCapital);
        if (logCapital <= ruinLog) {
          stopped = true;
          practicalRuinCount += 1;
        }
      }

      const weeksEndingHere = weeklyEndTrades.get(trade) ?? 0;
      for (let weekOffset = 0; weekOffset < weeksEndingHere; weekOffset += 1) {
        const weeklyReturn =
          previousWeekCapital === 0 ? 0 : capital / previousWeekCapital - 1;
        weeklyReturns.add(weeklyReturn);
        previousWeekCapital = capital;
      }

      const checkpointIndex = checkpointIndexByTrade.get(trade);
      if (checkpointIndex !== undefined) {
        checkpointCapitals[checkpointIndex]![pathIndex] = capital;
        if (sampleSlot !== undefined) {
          samplePaths[sampleSlot]!.points.push({
            trade,
            week: trade / input.tradesPerWeek,
            capital,
          });
        }
      }
    }

    terminals[pathIndex] = capital;
    terminalReturns[pathIndex] = capital / input.startingCapital - 1;
    maxDrawdowns[pathIndex] = maxDrawdown;
    if (capital < input.startingCapital) lossCount += 1;
    if (maxDrawdown >= input.severeDrawdownFraction) severeDrawdownCount += 1;
  }

  const terminalSummary = summarizeQuantiles(terminals);
  const sortedDrawdowns = sortedCopy(maxDrawdowns);
  const expectedTerminalCapital = mean(terminals);
  const meanMultiplier =
    1 +
    input.positionFraction *
      (input.netWinMultiple * input.winProbability -
        (1 - input.winProbability));
  const analyticalTerminal = safePower(meanMultiplier, tradeCount);
  if (analyticalTerminal.overflowed) overflowedValueCount += 1;
  const analyticalExpectedTerminalCapital = Math.min(
    Number.MAX_VALUE,
    input.startingCapital * analyticalTerminal.capital,
  );
  if (!Number.isFinite(input.startingCapital * analyticalTerminal.capital)) {
    overflowedValueCount += 1;
  }

  const fan: FanPoint[] = checkpointTradeValues.map((trade, index) => ({
    trade,
    week: trade / input.tradesPerWeek,
    ...summarizeQuantiles(checkpointCapitals[index]!),
  }));
  const annualized = weeklyReturns.finish();
  const kelly = calculateKelly(input.winProbability, input.netWinMultiple);
  const warnings: string[] = [
    "Outcomes are iid with stationary known probability and payout; probability error, clustering, correlation, slippage, liquidity, taxes, contract availability, market impact, and regime shifts are not modeled.",
    "This accepts an abstract event/barrier-hit probability and net payout. A barrier option cannot be priced from win rate alone.",
  ];
  if (kelly.edgePerUnitStaked <= 0 && input.positionFraction > 0) {
    warnings.push(
      "The assumed edge is non-positive; Kelly allocates zero under these inputs.",
    );
  }
  if (input.positionFraction === 1) {
    warnings.push(
      "At f = 100%, a single loss creates literal zero capital; smaller fractions do not.",
    );
  }
  if (annualized.sharpe === null || annualized.sortino === null) {
    warnings.push(
      "A zero return or downside denominator makes one or more risk-adjusted ratios undefined.",
    );
  }
  if (overflowedValueCount > 0) {
    warnings.push(
      `${overflowedValueCount} extreme values exceeded finite display range and were capped at Number.MAX_VALUE.`,
    );
  }

  return {
    input,
    kelly,
    metrics: {
      expectedTerminalCapital,
      analyticalExpectedTerminalCapital,
      terminalCapital: terminalSummary,
      expectedTotalReturn: expectedTerminalCapital / input.startingCapital - 1,
      medianTotalReturn: terminalSummary.median / input.startingCapital - 1,
      impliedCagrFromExpectedTerminal: impliedCagr(
        expectedTerminalCapital,
        input.startingCapital,
        horizonYears,
      ),
      impliedCagrFromMedianTerminal: impliedCagr(
        terminalSummary.median,
        input.startingCapital,
        horizonYears,
      ),
      probabilityOfLoss: lossCount / input.pathCount,
      probabilityOfPracticalRuin: practicalRuinCount / input.pathCount,
      medianMaxDrawdown: quantileSorted(sortedDrawdowns, 0.5),
      p90MaxDrawdown: quantileSorted(sortedDrawdowns, 0.9),
      probabilityOfSevereDrawdown: severeDrawdownCount / input.pathCount,
      annualized,
    },
    fan,
    samplePaths,
    terminalReturnHistogram: createHistogram(terminalReturns),
    maxDrawdownHistogram: createHistogram(maxDrawdowns),
    metadata: {
      tradeCount,
      horizonYears,
      pathCount: input.pathCount,
      seed: input.seed,
      checkpointCount: checkpointTradeValues.length,
      retainedSamplePathCount: samplePaths.length,
      practicalRuinCapital: input.startingCapital * input.ruinThresholdFraction,
      severeDrawdownFraction: input.severeDrawdownFraction,
      overflowedValueCount,
      simulationModel: "iid binary fixed-fraction",
    },
    definitions: DEFINITIONS,
    warnings,
  };
};
