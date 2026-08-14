import type { SimulationInput } from "./types.js";
import {
  BASE_HEATMAP_FRACTIONS,
  BASE_HEATMAP_PROBABILITIES,
  REGULAR_SWEEP_FRACTIONS,
} from "./explorationGrid.js";

export const SWEEP_PATH_CAP = 250;
export const HEATMAP_PATH_CAP = 100;
export const LAB_OPERATION_BUDGET = 4_000_000;

const MAX_SWEEP_FRACTION_COUNT = REGULAR_SWEEP_FRACTIONS.length + 4;
const MAX_HEATMAP_CELL_COUNT =
  (BASE_HEATMAP_PROBABILITIES.length + 1) * (BASE_HEATMAP_FRACTIONS.length + 1);
const SIMULATED_KELLY_VARIANT_COUNT = 3;

export interface LabWorkEstimate {
  tradeCount: number;
  simulationPathTrades: number;
  explorationPathTrades: number;
  kellyPathTrades: number;
  totalPathTrades: number;
}

export const estimateLabWork = (input: SimulationInput): LabWorkEstimate => {
  const tradeCount = Math.max(
    1,
    Math.round(input.tradesPerWeek * input.horizonWeeks),
  );
  const simulationPathTrades = input.pathCount * tradeCount;
  const explorationPathTrades =
    (MAX_SWEEP_FRACTION_COUNT * Math.min(input.pathCount, SWEEP_PATH_CAP) +
      MAX_HEATMAP_CELL_COUNT * Math.min(input.pathCount, HEATMAP_PATH_CAP)) *
    tradeCount;
  const kellyPathTrades =
    SIMULATED_KELLY_VARIANT_COUNT * input.pathCount * tradeCount;
  return {
    tradeCount,
    simulationPathTrades,
    explorationPathTrades,
    kellyPathTrades,
    totalPathTrades:
      simulationPathTrades + explorationPathTrades + kellyPathTrades,
  };
};
