import type { SimulationInput } from "./types.js";

export const DEFAULT_SIMULATION_INPUT: SimulationInput = {
  winProbability: 0.54,
  probabilityHaircut: 0.03,
  positionFraction: 0.02,
  contractPurchasePrice: 0.49,
  settlementPayout: 1,
  roundTripCosts: 0.01,
  eventsPerWeek: 2,
  horizonWeeks: 52,
  startingCapital: 100_000,
  pathCount: 5_000,
  seed: "event-edge-2026",
  ruinThresholdFraction: 0.01,
  annualRiskFreeRate: 0.04,
  severeDrawdownFraction: 0.5,
};

export const INPUT_LIMITS = {
  contractPurchasePrice: { min: 0.01, max: 10_000 },
  settlementPayout: { min: 0.02, max: 100_000 },
  roundTripCosts: { min: 0, max: 1_000 },
  eventsPerWeek: { min: 1, max: 20 },
  probabilityHaircut: { min: 0, max: 0.25 },
  horizonWeeks: { min: 1, max: 104 },
  startingCapital: { min: 100, max: 1_000_000_000 },
  pathCount: { min: 100, max: 25_000 },
} as const;
