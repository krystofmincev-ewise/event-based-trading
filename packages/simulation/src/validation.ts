import { INPUT_LIMITS } from "./defaults.js";
import type { SimulationInput } from "./types.js";

export type ValidationResult =
  | { success: true; data: SimulationInput }
  | { success: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  const positionFraction = readFiniteNumber(value, "positionFraction", errors);
  const netWinMultiple = readFiniteNumber(value, "netWinMultiple", errors);
  const tradesPerWeek = readFiniteNumber(value, "tradesPerWeek", errors);
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
  const seed = value.seed;

  inRange(winProbability, "winProbability", 0, 1, errors);
  inRange(positionFraction, "positionFraction", 0, 1, errors);
  inRange(
    netWinMultiple,
    "netWinMultiple",
    INPUT_LIMITS.netWinMultiple.min,
    INPUT_LIMITS.netWinMultiple.max,
    errors,
  );
  inRange(
    tradesPerWeek,
    "tradesPerWeek",
    INPUT_LIMITS.tradesPerWeek.min,
    INPUT_LIMITS.tradesPerWeek.max,
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

  if (pathCount !== undefined && !Number.isInteger(pathCount)) {
    errors.push("pathCount must be an integer.");
  }
  if (horizonWeeks !== undefined && !Number.isInteger(horizonWeeks)) {
    errors.push("horizonWeeks must be an integer.");
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

  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      winProbability: winProbability!,
      positionFraction: positionFraction!,
      netWinMultiple: netWinMultiple!,
      tradesPerWeek: tradesPerWeek!,
      horizonWeeks: horizonWeeks!,
      startingCapital: startingCapital!,
      pathCount: pathCount!,
      seed: (seed as string).trim(),
      ruinThresholdFraction: ruinThresholdFraction!,
      annualRiskFreeRate: annualRiskFreeRate!,
      severeDrawdownFraction: severeDrawdownFraction!,
    },
  };
};
