import { expectedLogGrowth } from "./kelly.js";
import { runSimulation } from "./simulation.js";
import type {
  ExplorationResult,
  HeatmapCell,
  KellyComparisonPoint,
  SimulationInput,
  SweepPoint,
} from "./types.js";

const uniqueSorted = (values: number[]): number[] =>
  [...new Set(values.map((value) => Number(value.toFixed(6))))].sort(
    (left, right) => left - right,
  );

const fractionGrid = (
  userFraction: number,
  kellyFraction: number,
): number[] => {
  const regular = Array.from({ length: 16 }, (_, index) => index / 15);
  return uniqueSorted([
    ...regular,
    userFraction,
    kellyFraction,
    kellyFraction * 0.5,
    kellyFraction * 0.25,
  ]);
};

export const runExploration = (input: SimulationInput): ExplorationResult => {
  const baseline = runSimulation({
    ...input,
    pathCount: Math.min(input.pathCount, 800),
  });
  const fractions = fractionGrid(
    input.positionFraction,
    baseline.kelly.fullFraction,
  );
  const sweepPathCount = Math.min(input.pathCount, 800);
  const heatmapPathCount = Math.min(input.pathCount, 300);
  const heatmapProbabilities = uniqueSorted([
    0.35,
    0.45,
    0.5,
    input.winProbability,
    0.6,
    0.7,
    0.8,
  ]);
  const heatmapFractions = uniqueSorted([
    0,
    0.03,
    0.06,
    input.positionFraction,
    0.12,
    0.2,
    0.35,
    0.5,
  ]);

  const sweep: SweepPoint[] = fractions.map((fraction) => {
    const result = runSimulation({
      ...input,
      positionFraction: fraction,
      pathCount: sweepPathCount,
    });
    return {
      fraction,
      medianCagr: result.metrics.impliedCagrFromMedianTerminal,
      medianTerminalCapital: result.metrics.terminalCapital.median,
      probabilityOfPracticalRuin: result.metrics.probabilityOfPracticalRuin,
      probabilityOfSevereDrawdown: result.metrics.probabilityOfSevereDrawdown,
      p90MaxDrawdown: result.metrics.p90MaxDrawdown,
      expectedLogGrowthPerTrade: expectedLogGrowth(
        input.winProbability,
        input.netWinMultiple,
        fraction,
      ),
    };
  });

  const heatmap: HeatmapCell[] = heatmapProbabilities.flatMap(
    (winProbability) =>
      heatmapFractions.map((fraction) => {
        const result = runSimulation({
          ...input,
          winProbability,
          positionFraction: fraction,
          pathCount: heatmapPathCount,
        });
        return {
          winProbability,
          fraction,
          medianCagr: result.metrics.impliedCagrFromMedianTerminal,
          probabilityOfPracticalRuin: result.metrics.probabilityOfPracticalRuin,
        };
      }),
  );

  return {
    sweep,
    heatmap,
    sweepPathCount,
    heatmapPathCount,
    heatmapProbabilities,
    heatmapFractions,
  };
};

export const runKellyComparison = (
  input: SimulationInput,
): KellyComparisonPoint[] => {
  const { kelly } = runSimulation({
    ...input,
    pathCount: Math.min(input.pathCount, 500),
  });
  const variants: Array<{
    label: KellyComparisonPoint["label"];
    fraction: number;
  }> = [
    { label: "No stake", fraction: 0 },
    { label: "Quarter Kelly", fraction: kelly.quarterFraction },
    { label: "Half Kelly", fraction: kelly.halfFraction },
    { label: "Full Kelly", fraction: kelly.fullFraction },
  ];
  return variants.map(({ label, fraction }) => {
    const result = runSimulation({
      ...input,
      positionFraction: fraction,
      pathCount: Math.min(input.pathCount, 1_000),
    });
    return {
      label,
      fraction,
      medianTerminalCapital: result.metrics.terminalCapital.median,
      p05TerminalCapital: result.metrics.terminalCapital.p05,
      p95TerminalCapital: result.metrics.terminalCapital.p95,
      probabilityOfPracticalRuin: result.metrics.probabilityOfPracticalRuin,
      medianMaxDrawdown: result.metrics.medianMaxDrawdown,
    };
  });
};
