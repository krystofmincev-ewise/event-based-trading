import { INPUT_LIMITS } from "./defaults.js";
import {
  EMPIRICAL_CONTEXT,
  resolveEmpiricalScenario,
  validateEmpiricalScenarioSelection,
} from "./empiricalContext.js";
import type {
  PositionSizingInput,
  ResearchScenarioManifest,
  SimulationInput,
  SizingPolicy,
} from "./types.js";
import { estimateLabWork, LAB_OPERATION_BUDGET } from "./workload.js";

export type ValidationResult =
  | { success: true; data: SimulationInput }
  | { success: false; errors: string[] };

export type PositionSizingValidationResult =
  | { success: true; data: PositionSizingInput }
  | { success: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readResearchScenarioManifest = (
  value: unknown,
  errors: string[],
): ResearchScenarioManifest | null => {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.kind !== "empirical-research-proxy" ||
    typeof value.datasetVersion !== "string" ||
    typeof value.profileId !== "string" ||
    (value.capitalizationId !== "small" &&
      value.capitalizationId !== "mid" &&
      value.capitalizationId !== "large") ||
    (value.horizonTradingDays !== 1 && value.horizonTradingDays !== 10) ||
    (value.direction !== "up" &&
      value.direction !== "down" &&
      value.direction !== "absolute") ||
    (value.threshold !== 0 &&
      value.threshold !== 0.02 &&
      value.threshold !== 0.05 &&
      value.threshold !== 0.1) ||
    typeof value.companyMoveMultiplier !== "number" ||
    !Number.isFinite(value.companyMoveMultiplier) ||
    typeof value.modelProbabilityLift !== "number" ||
    !Number.isFinite(value.modelProbabilityLift) ||
    value.termsExecutable !== false ||
    value.sizingEligibility !== "research-only"
  ) {
    errors.push(
      "researchScenarioManifest must be null or a valid empirical research-proxy manifest.",
    );
    return null;
  }
  return {
    kind: value.kind,
    datasetVersion: value.datasetVersion,
    profileId: value.profileId,
    capitalizationId: value.capitalizationId,
    horizonTradingDays: value.horizonTradingDays,
    direction: value.direction,
    threshold: value.threshold,
    companyMoveMultiplier: value.companyMoveMultiplier,
    modelProbabilityLift: value.modelProbabilityLift,
    termsExecutable: false,
    sizingEligibility: "research-only",
  };
};

const readFiniteNumber = (
  source: Record<string, unknown>,
  key: keyof SimulationInput,
  errors: string[],
): number | undefined => {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${key} must be a finite number.`);
    return undefined;
  }
  return value;
};

const inRange = (
  value: number | undefined,
  key: keyof SimulationInput,
  minimum: number,
  maximum: number,
  errors: string[],
  inclusiveMinimum = true,
): void => {
  if (value === undefined) return;
  const below = inclusiveMinimum ? value < minimum : value <= minimum;
  if (below || value > maximum) {
    const lower = inclusiveMinimum ? "[" : "(";
    errors.push(`${key} must be in ${lower}${minimum}, ${maximum}].`);
  }
};

export const validateSimulationInput = (value: unknown): ValidationResult => {
  if (!isRecord(value))
    return { success: false, errors: ["Request body must be an object."] };

  const errors: string[] = [];
  const winProbability = readFiniteNumber(value, "winProbability", errors);
  const probabilityHaircut = readFiniteNumber(
    value,
    "probabilityHaircut",
    errors,
  );
  const positionFraction = readFiniteNumber(value, "positionFraction", errors);
  const contractPurchasePrice = readFiniteNumber(
    value,
    "contractPurchasePrice",
    errors,
  );
  const settlementPayout = readFiniteNumber(value, "settlementPayout", errors);
  const roundTripCosts = readFiniteNumber(value, "roundTripCosts", errors);
  const eventsPerWeek = readFiniteNumber(value, "eventsPerWeek", errors);
  const horizonWeeks = readFiniteNumber(value, "horizonWeeks", errors);
  const startingCapital = readFiniteNumber(value, "startingCapital", errors);
  const pathCount = readFiniteNumber(value, "pathCount", errors);
  const ruinThresholdFraction = readFiniteNumber(
    value,
    "ruinThresholdFraction",
    errors,
  );
  const annualRiskFreeRate = readFiniteNumber(
    value,
    "annualRiskFreeRate",
    errors,
  );
  const severeDrawdownFraction = readFiniteNumber(
    value,
    "severeDrawdownFraction",
    errors,
  );
  const calibrationEffectiveSampleSize = readFiniteNumber(
    value,
    "calibrationEffectiveSampleSize",
    errors,
  );
  const weeklyProbabilityLogitStdDev = readFiniteNumber(
    value,
    "weeklyProbabilityLogitStdDev",
    errors,
  );
  const executionCostCoefficientVariation = readFiniteNumber(
    value,
    "executionCostCoefficientVariation",
    errors,
  );
  const seed = value.seed;
  const opportunityArrival = value.opportunityArrival;
  const calibrationUncertaintyEnabled = value.calibrationUncertaintyEnabled;
  const researchScenarioManifest = readResearchScenarioManifest(
    value.researchScenarioManifest,
    errors,
  );

  inRange(winProbability, "winProbability", 0, 1, errors);
  inRange(
    probabilityHaircut,
    "probabilityHaircut",
    INPUT_LIMITS.probabilityHaircut.min,
    INPUT_LIMITS.probabilityHaircut.max,
    errors,
  );
  inRange(positionFraction, "positionFraction", 0, 1, errors);
  inRange(
    contractPurchasePrice,
    "contractPurchasePrice",
    INPUT_LIMITS.contractPurchasePrice.min,
    INPUT_LIMITS.contractPurchasePrice.max,
    errors,
  );
  inRange(
    settlementPayout,
    "settlementPayout",
    INPUT_LIMITS.settlementPayout.min,
    INPUT_LIMITS.settlementPayout.max,
    errors,
  );
  inRange(
    roundTripCosts,
    "roundTripCosts",
    INPUT_LIMITS.roundTripCosts.min,
    INPUT_LIMITS.roundTripCosts.max,
    errors,
  );
  inRange(
    eventsPerWeek,
    "eventsPerWeek",
    INPUT_LIMITS.eventsPerWeek.min,
    INPUT_LIMITS.eventsPerWeek.max,
    errors,
  );
  inRange(
    horizonWeeks,
    "horizonWeeks",
    INPUT_LIMITS.horizonWeeks.min,
    INPUT_LIMITS.horizonWeeks.max,
    errors,
  );
  inRange(
    startingCapital,
    "startingCapital",
    INPUT_LIMITS.startingCapital.min,
    INPUT_LIMITS.startingCapital.max,
    errors,
  );
  inRange(
    pathCount,
    "pathCount",
    INPUT_LIMITS.pathCount.min,
    INPUT_LIMITS.pathCount.max,
    errors,
  );
  inRange(ruinThresholdFraction, "ruinThresholdFraction", 0, 1, errors, false);
  inRange(annualRiskFreeRate, "annualRiskFreeRate", -1, 1, errors, false);
  inRange(
    severeDrawdownFraction,
    "severeDrawdownFraction",
    0,
    1,
    errors,
    false,
  );
  inRange(
    calibrationEffectiveSampleSize,
    "calibrationEffectiveSampleSize",
    INPUT_LIMITS.calibrationEffectiveSampleSize.min,
    INPUT_LIMITS.calibrationEffectiveSampleSize.max,
    errors,
  );
  inRange(
    weeklyProbabilityLogitStdDev,
    "weeklyProbabilityLogitStdDev",
    INPUT_LIMITS.weeklyProbabilityLogitStdDev.min,
    INPUT_LIMITS.weeklyProbabilityLogitStdDev.max,
    errors,
  );
  inRange(
    executionCostCoefficientVariation,
    "executionCostCoefficientVariation",
    INPUT_LIMITS.executionCostCoefficientVariation.min,
    INPUT_LIMITS.executionCostCoefficientVariation.max,
    errors,
  );

  if (pathCount !== undefined && !Number.isInteger(pathCount)) {
    errors.push("pathCount must be an integer.");
  }
  if (horizonWeeks !== undefined && !Number.isInteger(horizonWeeks)) {
    errors.push("horizonWeeks must be an integer.");
  }
  if (
    eventsPerWeek !== undefined &&
    opportunityArrival === "fixed" &&
    !Number.isInteger(eventsPerWeek)
  ) {
    errors.push(
      "eventsPerWeek must be an integer for a fixed schedule; partial trades are not modeled.",
    );
  }
  if (opportunityArrival !== "fixed" && opportunityArrival !== "poisson") {
    errors.push("opportunityArrival must be fixed or poisson.");
  }
  if (typeof calibrationUncertaintyEnabled !== "boolean") {
    errors.push("calibrationUncertaintyEnabled must be a boolean.");
  }
  if (
    contractPurchasePrice !== undefined &&
    settlementPayout !== undefined &&
    roundTripCosts !== undefined &&
    contractPurchasePrice + roundTripCosts >= settlementPayout
  ) {
    errors.push(
      "contractPurchasePrice + roundTripCosts must be below settlementPayout.",
    );
  }
  if (ruinThresholdFraction !== undefined && ruinThresholdFraction >= 1) {
    errors.push("ruinThresholdFraction must be less than 1.");
  }
  if (severeDrawdownFraction !== undefined && severeDrawdownFraction >= 1) {
    errors.push("severeDrawdownFraction must be less than 1.");
  }
  if (
    typeof seed !== "string" ||
    seed.trim().length === 0 ||
    seed.length > 100
  ) {
    errors.push("seed must be a non-empty string of at most 100 characters.");
  }
  if (researchScenarioManifest !== null) {
    if (researchScenarioManifest.datasetVersion !== EMPIRICAL_CONTEXT.version) {
      errors.push(
        "researchScenarioManifest.datasetVersion must match the bundled empirical catalog.",
      );
    }
    const selection = validateEmpiricalScenarioSelection({
      profileId: researchScenarioManifest.profileId,
      capitalizationId: researchScenarioManifest.capitalizationId,
      horizon: researchScenarioManifest.horizonTradingDays,
      direction: researchScenarioManifest.direction,
      threshold: researchScenarioManifest.threshold,
      companyMoveMultiplier: researchScenarioManifest.companyMoveMultiplier,
      modelProbabilityLift: researchScenarioManifest.modelProbabilityLift,
    });
    if (!selection.success) {
      errors.push(...selection.errors.map((error) => `manifest: ${error}`));
    } else {
      const expected = resolveEmpiricalScenario(selection.data).simulationPatch;
      const numericPairs: Array<
        [number | undefined, number | undefined, string]
      > = [
        [winProbability, expected.winProbability, "winProbability"],
        [probabilityHaircut, expected.probabilityHaircut, "probabilityHaircut"],
        [
          contractPurchasePrice,
          expected.contractPurchasePrice,
          "contractPurchasePrice",
        ],
        [settlementPayout, expected.settlementPayout, "settlementPayout"],
        [roundTripCosts, expected.roundTripCosts, "roundTripCosts"],
        [eventsPerWeek, expected.eventsPerWeek, "eventsPerWeek"],
        [
          calibrationEffectiveSampleSize,
          expected.calibrationEffectiveSampleSize,
          "calibrationEffectiveSampleSize",
        ],
        [
          weeklyProbabilityLogitStdDev,
          expected.weeklyProbabilityLogitStdDev,
          "weeklyProbabilityLogitStdDev",
        ],
        [
          executionCostCoefficientVariation,
          expected.executionCostCoefficientVariation,
          "executionCostCoefficientVariation",
        ],
      ];
      for (const [actual, reference, key] of numericPairs) {
        if (
          actual !== undefined &&
          reference !== undefined &&
          Math.abs(actual - reference) >
            1e-12 * Math.max(1, Math.abs(actual), Math.abs(reference))
        ) {
          errors.push(
            `${key} does not match the attached researchScenarioManifest.`,
          );
        }
      }
      if (opportunityArrival !== expected.opportunityArrival) {
        errors.push(
          "opportunityArrival does not match the attached researchScenarioManifest.",
        );
      }
      if (
        calibrationUncertaintyEnabled !== expected.calibrationUncertaintyEnabled
      ) {
        errors.push(
          "calibrationUncertaintyEnabled does not match the attached researchScenarioManifest.",
        );
      }
    }
  }

  if (errors.length > 0) return { success: false, errors };

  const data: SimulationInput = {
    winProbability: winProbability!,
    probabilityHaircut: probabilityHaircut!,
    positionFraction: positionFraction!,
    contractPurchasePrice: contractPurchasePrice!,
    settlementPayout: settlementPayout!,
    roundTripCosts: roundTripCosts!,
    eventsPerWeek: eventsPerWeek!,
    horizonWeeks: horizonWeeks!,
    startingCapital: startingCapital!,
    pathCount: pathCount!,
    seed: (seed as string).trim(),
    ruinThresholdFraction: ruinThresholdFraction!,
    annualRiskFreeRate: annualRiskFreeRate!,
    severeDrawdownFraction: severeDrawdownFraction!,
    opportunityArrival:
      opportunityArrival as SimulationInput["opportunityArrival"],
    calibrationUncertaintyEnabled: calibrationUncertaintyEnabled as boolean,
    calibrationEffectiveSampleSize: calibrationEffectiveSampleSize!,
    weeklyProbabilityLogitStdDev: weeklyProbabilityLogitStdDev!,
    executionCostCoefficientVariation: executionCostCoefficientVariation!,
    researchScenarioManifest,
  };
  const work = estimateLabWork(data);
  if (work.totalPathTrades > LAB_OPERATION_BUDGET) {
    return {
      success: false,
      errors: [
        `Estimated lab workload ${work.totalPathTrades.toLocaleString("en-US")} path-events exceeds the local limit of ${LAB_OPERATION_BUDGET.toLocaleString("en-US")}; reduce pathCount, eventsPerWeek, or horizonWeeks.`,
      ],
    };
  }

  return { success: true, data };
};

const SIZING_POLICIES = new Set<SizingPolicy>([
  "conservative-kelly",
  "estimated-kelly",
  "custom",
]);

export const validatePositionSizingInput = (
  value: unknown,
): PositionSizingValidationResult => {
  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be an object."] };
  }
  const errors: string[] = [];
  const read = (key: keyof PositionSizingInput): number | undefined => {
    const candidate = value[key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      errors.push(`${key} must be a finite number.`);
      return undefined;
    }
    return candidate;
  };
  const bankroll = read("bankroll");
  const winProbability = read("winProbability");
  const probabilityHaircut = read("probabilityHaircut");
  const contractPurchasePrice = read("contractPurchasePrice");
  const settlementPayout = read("settlementPayout");
  const roundTripCosts = read("roundTripCosts");
  const customFraction = read("customFraction");
  const maximumPositionFraction = read("maximumPositionFraction");
  const sizingPolicy = value.sizingPolicy;

  const range = (
    candidate: number | undefined,
    key: keyof PositionSizingInput,
    minimum: number,
    maximum: number,
    minimumExclusive = false,
  ): void => {
    if (candidate === undefined) return;
    if (
      (minimumExclusive ? candidate <= minimum : candidate < minimum) ||
      candidate > maximum
    ) {
      errors.push(
        `${key} must be ${minimumExclusive ? "greater than" : "at least"} ${minimum} and at most ${maximum}.`,
      );
    }
  };
  range(bankroll, "bankroll", 0, INPUT_LIMITS.startingCapital.max, true);
  range(winProbability, "winProbability", 0, 1);
  range(
    probabilityHaircut,
    "probabilityHaircut",
    INPUT_LIMITS.probabilityHaircut.min,
    INPUT_LIMITS.probabilityHaircut.max,
  );
  range(
    contractPurchasePrice,
    "contractPurchasePrice",
    INPUT_LIMITS.contractPurchasePrice.min,
    INPUT_LIMITS.contractPurchasePrice.max,
  );
  range(
    settlementPayout,
    "settlementPayout",
    INPUT_LIMITS.settlementPayout.min,
    INPUT_LIMITS.settlementPayout.max,
  );
  range(
    roundTripCosts,
    "roundTripCosts",
    INPUT_LIMITS.roundTripCosts.min,
    INPUT_LIMITS.roundTripCosts.max,
  );
  range(customFraction, "customFraction", 0, 1);
  range(maximumPositionFraction, "maximumPositionFraction", 0, 1);
  if (
    typeof sizingPolicy !== "string" ||
    !SIZING_POLICIES.has(sizingPolicy as SizingPolicy)
  ) {
    errors.push(
      "sizingPolicy must be conservative-kelly, estimated-kelly, or custom.",
    );
  }
  if (
    contractPurchasePrice !== undefined &&
    settlementPayout !== undefined &&
    roundTripCosts !== undefined &&
    contractPurchasePrice + roundTripCosts >= settlementPayout
  ) {
    errors.push(
      "contractPurchasePrice + roundTripCosts must be below settlementPayout.",
    );
  }
  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      bankroll: bankroll!,
      winProbability: winProbability!,
      probabilityHaircut: probabilityHaircut!,
      contractPurchasePrice: contractPurchasePrice!,
      settlementPayout: settlementPayout!,
      roundTripCosts: roundTripCosts!,
      sizingPolicy: sizingPolicy as SizingPolicy,
      customFraction: customFraction!,
      maximumPositionFraction: maximumPositionFraction!,
    },
  };
};
