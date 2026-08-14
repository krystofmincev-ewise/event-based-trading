export interface SimulationInput {
  winProbability: number;
  probabilityHaircut: number;
  positionFraction: number;
  contractPurchasePrice: number;
  settlementPayout: number;
  roundTripCosts: number;
  eventsPerWeek: number;
  horizonWeeks: number;
  startingCapital: number;
  pathCount: number;
  seed: string;
  ruinThresholdFraction: number;
  annualRiskFreeRate: number;
  severeDrawdownFraction: number;
}

export interface ContractEconomics {
  purchasePrice: number;
  settlementPayout: number;
  roundTripCosts: number;
  allInCost: number;
  netWinProfit: number;
  netWinMultiple: number;
  breakEvenProbability: number;
}

export interface KellyScenario {
  probability: number;
  rawFraction: number;
  actionableFraction: number;
  expectedProfitPerContract: number;
  expectedReturnOnCapitalAtRisk: number;
  expectedLogGrowthPerEvent: number | null;
}

export interface KellyResult {
  economics: ContractEconomics;
  estimated: KellyScenario;
  conservative: KellyScenario;
  probabilityHaircut: number;
}

export type SizingPolicy = "conservative-kelly" | "estimated-kelly" | "custom";

export interface PositionSizingInput {
  bankroll: number;
  winProbability: number;
  probabilityHaircut: number;
  contractPurchasePrice: number;
  settlementPayout: number;
  roundTripCosts: number;
  sizingPolicy: SizingPolicy;
  customFraction: number;
  maximumPositionFraction: number;
}

export interface PositionSizingDecision {
  input: PositionSizingInput;
  economics: ContractEconomics;
  kelly: KellyResult;
  selectedProbability: number;
  unconstrainedTargetFraction: number;
  targetFractionAfterPolicyCap: number;
  dollarRiskBudget: number;
  wholeContractCount: number;
  actualCapitalAtRisk: number;
  actualDeployedRiskFraction: number;
  maximumLoss: number;
  maximumProfit: number;
  estimatedExpectedProfit: number;
  conservativeExpectedProfit: number;
  bindingConstraint: "none" | "position-cap" | "whole-contract-rounding";
}

export interface QuantileSummary {
  p05: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export interface FanPoint extends QuantileSummary {
  trade: number;
  week: number;
}

export interface SamplePath {
  id: number;
  points: Array<{ trade: number; week: number; capital: number }>;
}

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
}

export interface Histogram {
  bins: HistogramBin[];
  domain: [number, number];
  sampleCount: number;
}

export interface AnnualizedMetrics {
  observationFrequency: "weekly end-of-week (pooled simulated path-weeks)";
  observationsPerYear: 52;
  sampleObservationCount: number;
  meanPeriodicReturn: number;
  periodicRiskFreeReturn: number;
  annualizedVolatility: number;
  sharpe: number | null;
  sortino: number | null;
}

export interface SimulationMetrics {
  expectedTerminalCapital: number;
  continuousFractionExpectedTerminalCapitalReference: number;
  terminalCapital: QuantileSummary;
  expectedTotalReturn: number;
  medianTotalReturn: number;
  impliedCagrFromExpectedTerminal: number;
  impliedCagrFromMedianTerminal: number;
  probabilityOfLoss: number;
  probabilityOfPracticalRuin: number;
  medianMaxDrawdown: number;
  p90MaxDrawdown: number;
  probabilityOfSevereDrawdown: number;
  probabilityOfZeroExecutablePositionAtEnd: number;
  annualized: AnnualizedMetrics;
}

export interface SimulationDefinitions {
  winMultiplier: string;
  lossMultiplier: string;
  practicalRuin: string;
  expectedTerminal: string;
  continuousFractionExpectedTerminal: string;
  quantiles: string;
  maximumDrawdown: string;
  sharpe: string;
  sortino: string;
  wholeContractExecution: string;
}

export interface SimulationMetadata {
  tradeCount: number;
  effectiveTradesPerWeek: number;
  horizonYears: number;
  pathCount: number;
  seed: string;
  checkpointCount: number;
  retainedSamplePathCount: number;
  practicalRuinCapital: number;
  severeDrawdownFraction: number;
  cappedPathCount: number;
  continuousFractionReferenceCapped: boolean;
  cagrOutputCapped: boolean;
  initialWholeContractCount: number;
  initialCapitalAtRisk: number;
  initialExecutedFraction: number;
  approximatedLargeContractExecutions: number;
  continuousFractionReferenceIgnoresWholeContractRounding: true;
  simulationModel: "iid binary whole-contract target-fraction";
}

export interface SimulationResult {
  input: SimulationInput;
  kelly: KellyResult;
  metrics: SimulationMetrics;
  fan: FanPoint[];
  samplePaths: SamplePath[];
  terminalReturnHistogram: Histogram;
  maxDrawdownHistogram: Histogram;
  metadata: SimulationMetadata;
  definitions: SimulationDefinitions;
  warnings: string[];
}

export interface SweepPoint {
  fraction: number;
  medianCagr: number;
  medianTerminalCapital: number;
  probabilityOfPracticalRuin: number;
  probabilityOfSevereDrawdown: number;
  p90MaxDrawdown: number;
  expectedLogGrowthPerTrade: number | null;
}

export interface HeatmapCell {
  winProbability: number;
  fraction: number;
  medianCagr: number;
  probabilityOfPracticalRuin: number;
}

export interface ExplorationResult {
  sweep: SweepPoint[];
  heatmap: HeatmapCell[];
  sweepPathCount: number;
  heatmapPathCount: number;
  heatmapProbabilities: number[];
  heatmapFractions: number[];
}

export interface KellyComparisonPoint {
  label: "No stake" | "Current size" | "Conservative Kelly" | "Raw Kelly";
  fraction: number;
  pathCount: number;
  medianTerminalCapital: number;
  p05TerminalCapital: number;
  p95TerminalCapital: number;
  probabilityOfPracticalRuin: number;
  medianMaxDrawdown: number;
}

export interface DrawdownSummary {
  fraction: number;
  nominal: number;
}

export interface OutcomeSequenceResult {
  capitals: number[];
  maximumDrawdown: DrawdownSummary;
}
