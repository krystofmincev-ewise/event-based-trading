export {
  calculateMaximumDrawdown,
  drawdownFromLogCapital,
  returnBetweenLogCapitals,
  simulateOutcomeSequence,
  updateLogCapital,
} from "./bankroll.js";
export { DEFAULT_SIMULATION_INPUT, INPUT_LIMITS } from "./defaults.js";
export {
  DEFAULT_EMPIRICAL_SCENARIO,
  EMPIRICAL_CONTEXT,
  EVENT_EVIDENCE_SOURCES,
  capitalizationVolatilityMultiplierFor,
  effectiveThresholdFor,
  minimumSupportedCompanyMoveMultiplier,
  resolveEmpiricalScenario,
  validateEmpiricalScenarioSelection,
} from "./empiricalContext.js";
export type * from "./empiricalContext.js";
export { runExploration, runKellyComparison } from "./exploration.js";
export {
  calculateKelly,
  deriveContractEconomics,
  expectedLogGrowth,
  wholeContractPosition,
} from "./kelly.js";
export { annualizedWeeklyMetrics } from "./metrics.js";
export {
  hashSeed,
  poissonFromUniform,
  randomAt,
  randomStreamAt,
  standardNormalAt,
} from "./prng.js";
export { runSimulation } from "./simulation.js";
export { calculatePositionSizing } from "./sizing.js";
export {
  createHistogram,
  mean,
  quantileSorted,
  sortedCopy,
  summarizeQuantiles,
} from "./statistics.js";
export {
  validatePositionSizingInput,
  validateSimulationInput,
} from "./validation.js";
export {
  estimateLabWork,
  HEATMAP_PATH_CAP,
  LAB_OPERATION_BUDGET,
  SWEEP_PATH_CAP,
} from "./workload.js";
export type * from "./types.js";
export type { ValidationResult } from "./validation.js";
export type { PositionSizingValidationResult } from "./validation.js";
export type { LabWorkEstimate } from "./workload.js";
