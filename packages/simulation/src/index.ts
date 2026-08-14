export {
  calculateMaximumDrawdown,
  drawdownFromLogCapital,
  returnBetweenLogCapitals,
  simulateOutcomeSequence,
  updateLogCapital,
} from "./bankroll.js";
export { DEFAULT_SIMULATION_INPUT, INPUT_LIMITS } from "./defaults.js";
export { runExploration, runKellyComparison } from "./exploration.js";
export {
  calculateKelly,
  contractPriceToNetWinMultiple,
  expectedLogGrowth,
  netWinMultipleToContractPrice,
  payoutNotionalFraction,
} from "./kelly.js";
export { annualizedWeeklyMetrics } from "./metrics.js";
export { hashSeed, randomAt } from "./prng.js";
export { runSimulation } from "./simulation.js";
export {
  createHistogram,
  mean,
  quantileSorted,
  sortedCopy,
  summarizeQuantiles,
} from "./statistics.js";
export { validateSimulationInput } from "./validation.js";
export {
  estimateLabWork,
  HEATMAP_PATH_CAP,
  LAB_OPERATION_BUDGET,
  SWEEP_PATH_CAP,
} from "./workload.js";
export type * from "./types.js";
export type { ValidationResult } from "./validation.js";
export type { LabWorkEstimate } from "./workload.js";
