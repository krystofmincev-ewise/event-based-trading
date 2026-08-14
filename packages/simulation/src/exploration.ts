import { calculateKelly, expectedLogGrowth } from "./kelly.js";
import {
  buildHeatmapFractions,
  buildHeatmapProbabilities,
  buildSweepFractions,
} from "./explorationGrid.js";
import { runSimulation } from "./simulation.js";
import type {
  ExplorationResult,
  HeatmapCell,
  KellyComparisonPoint,
  SimulationInput,
  SweepPoint,
} from "./types.js";
import { HEATMAP_PATH_CAP, SWEEP_PATH_CAP } from "./workload.js";

export const runExploration = (input: SimulationInput): ExplorationResult => {
  const kelly = calculateKelly(input.winProbability, input.netWinMultiple);
  const fractions = buildSweepFractions(
    input.positionFraction,
    kelly.fullFraction,
  );
  const sweepPathCount = Math.min(input.pathCount, SWEEP_PATH_CAP);
  const heatmapPathCount = Math.min(input.pathCount, HEATMAP_PATH_CAP);
  const heatmapProbabilities = buildHeatmapProbabilities(input.winProbability);
  const heatmapFractions = buildHeatmapFractions(input.positionFraction);

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
  const kelly = calculateKelly(input.winProbability, input.netWinMultiple);
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
    if (label === "No stake") {
      return {
        label,
        fraction,
        pathCount: 0,
        medianTerminalCapital: input.startingCapital,
        p05TerminalCapital: input.startingCapital,
        p95TerminalCapital: input.startingCapital,
        probabilityOfPracticalRuin: 0,
        medianMaxDrawdown: 0,
      };
    }
    const result = runSimulation({
      ...input,
      positionFraction: fraction,
      pathCount: input.pathCount,
    });
    return {
      label,
      fraction,
      pathCount: result.metadata.pathCount,
      medianTerminalCapital: result.metrics.terminalCapital.median,
      p05TerminalCapital: result.metrics.terminalCapital.p05,
      p95TerminalCapital: result.metrics.terminalCapital.p95,
      probabilityOfPracticalRuin: result.metrics.probabilityOfPracticalRuin,
      medianMaxDrawdown: result.metrics.medianMaxDrawdown,
    };
  });
};
