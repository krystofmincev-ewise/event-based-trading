import { wholeContractPosition } from "./kelly.js";

const MAX_FINITE_LOG = Math.log(Number.MAX_VALUE);
const MAX_EXACT_CONTRACT_LOG = Math.log(Number.MAX_SAFE_INTEGER);

export const positionForLogCapital = (
  logCapital: number,
  displayCapital: number,
  targetFraction: number,
  allInCost: number,
): { executedFraction: number; approximated: boolean } => {
  if (targetFraction === 0 || logCapital === Number.NEGATIVE_INFINITY) {
    return { executedFraction: 0, approximated: false };
  }
  const logDesiredContracts =
    logCapital + Math.log(targetFraction) - Math.log(allInCost);
  if (logDesiredContracts > MAX_EXACT_CONTRACT_LOG) {
    return { executedFraction: targetFraction, approximated: true };
  }
  return {
    executedFraction: wholeContractPosition(
      displayCapital,
      targetFraction,
      allInCost,
    ).executedFraction,
    approximated: false,
  };
};

export const impliedCagr = (
  terminalCapital: number,
  startingCapital: number,
  years: number,
): { value: number; capped: boolean } => {
  if (terminalCapital === 0) return { value: -1, capped: false };
  const annualLogGrowth =
    (Math.log(terminalCapital) - Math.log(startingCapital)) / years;
  if (annualLogGrowth >= MAX_FINITE_LOG) {
    return { value: Number.MAX_VALUE, capped: true };
  }
  const value = Math.expm1(annualLogGrowth);
  return Number.isFinite(value)
    ? { value, capped: false }
    : { value: Number.MAX_VALUE, capped: true };
};

export const appendNumericalWarnings = (
  warnings: string[],
  state: {
    approximatedLargeContractExecutions: number;
    riskAdjustedRatioUndefined: boolean;
    cappedPathCount: number;
    continuousFractionReferenceCapped: boolean;
    cagrOutputCapped: boolean;
    practicalRuinCount: number;
  },
): void => {
  if (state.approximatedLargeContractExecutions > 0) {
    warnings.push(
      `${state.approximatedLargeContractExecutions.toLocaleString("en-US")} extreme-scale executions exceeded JavaScript's exact integer range; target-fraction dynamics were used because one-contract rounding was immaterial at that scale.`,
    );
  }
  if (state.riskAdjustedRatioUndefined) {
    warnings.push(
      "A zero return or downside denominator makes one or more risk-adjusted ratios undefined.",
    );
  }
  if (state.cappedPathCount > 0) {
    warnings.push(
      `${state.cappedPathCount} simulated paths crossed finite capital display range; log wealth remained canonical for drawdown and weekly risk metrics.`,
    );
  }
  if (state.continuousFractionReferenceCapped) {
    warnings.push(
      "The unstopped continuous-fraction expected-terminal reference exceeded finite display range and was capped.",
    );
  }
  if (state.cagrOutputCapped) {
    warnings.push(
      "One or more implied CAGR outputs exceeded finite numeric range and were capped at Number.MAX_VALUE; interpret this as overflow, not a forecast.",
    );
  }
  if (state.practicalRuinCount > 0) {
    warnings.push(
      "The continuous-fraction expected-terminal reference ignores the practical-ruin stop and is not directly comparable when that stop binds.",
    );
  }
};
