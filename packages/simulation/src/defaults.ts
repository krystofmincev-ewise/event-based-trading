import type { SimulationInput } from "./types.js";

export const DEFAULT_SIMULATION_INPUT: SimulationInput = {
  winProbability: 0.58,
  positionFraction: 0.08,
  netWinMultiple: 1,
  tradesPerWeek: 1.5,
  horizonWeeks: 52,
  startingCapital: 100_000,
  pathCount: 5_000,
  seed: "event-edge-2026",
  ruinThresholdFraction: 0.01,
  annualRiskFreeRate: 0.04,
  severeDrawdownFraction: 0.5,
};

export const INPUT_LIMITS = {
  netWinMultiple: { min: 0.01, max: 20 },
  tradesPerWeek: { min: 0.25, max: 20 },
  horizonWeeks: { min: 1, max: 104 },
  startingCapital: { min: 100, max: 1_000_000_000 },
  pathCount: { min: 100, max: 25_000 },
} as const;
