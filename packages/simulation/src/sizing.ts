import { calculateKelly, wholeContractPosition } from "./kelly.js";
import type { PositionSizingDecision, PositionSizingInput } from "./types.js";

export const calculatePositionSizing = (
  input: PositionSizingInput,
): PositionSizingDecision => {
  if (
    input.sizingPolicy !== "conservative-kelly" &&
    input.sizingPolicy !== "estimated-kelly" &&
    input.sizingPolicy !== "custom"
  ) {
    throw new Error("Sizing policy is not supported.");
  }
  if (!Number.isFinite(input.bankroll) || input.bankroll <= 0) {
    throw new Error("Bankroll must be a positive finite number.");
  }
  if (
    !Number.isFinite(input.maximumPositionFraction) ||
    input.maximumPositionFraction < 0 ||
    input.maximumPositionFraction > 1
  ) {
    throw new Error("Maximum position fraction must be between 0 and 1.");
  }
  if (
    !Number.isFinite(input.customFraction) ||
    input.customFraction < 0 ||
    input.customFraction > 1
  ) {
    throw new Error("Custom fraction must be between 0 and 1.");
  }
  const kelly = calculateKelly(
    input.winProbability,
    input.probabilityHaircut,
    input.contractPurchasePrice,
    input.settlementPayout,
    input.roundTripCosts,
  );
  const unconstrainedTargetFraction =
    input.sizingPolicy === "estimated-kelly"
      ? kelly.estimated.actionableFraction
      : input.sizingPolicy === "conservative-kelly"
        ? kelly.conservative.actionableFraction
        : input.customFraction;
  const targetFractionAfterPolicyCap = Math.min(
    unconstrainedTargetFraction,
    input.maximumPositionFraction,
  );
  const position = wholeContractPosition(
    input.bankroll,
    targetFractionAfterPolicyCap,
    kelly.economics.allInCost,
  );
  const dollarRiskBudget = input.bankroll * targetFractionAfterPolicyCap;
  const bindingReason =
    unconstrainedTargetFraction === 0
      ? input.sizingPolicy === "custom"
        ? "custom-zero"
        : "non-positive-edge"
      : targetFractionAfterPolicyCap < unconstrainedTargetFraction
        ? "position-cap"
        : position.capitalAtRisk < dollarRiskBudget
          ? "whole-contract-rounding"
          : "none";
  return {
    input,
    economics: kelly.economics,
    kelly,
    selectedProbability:
      input.sizingPolicy === "conservative-kelly"
        ? kelly.conservative.probability
        : kelly.estimated.probability,
    unconstrainedTargetFraction,
    targetFractionAfterPolicyCap,
    dollarRiskBudget,
    wholeContractCount: position.contractCount,
    actualCapitalAtRisk: position.capitalAtRisk,
    actualDeployedRiskFraction: position.executedFraction,
    maximumLoss: position.capitalAtRisk,
    maximumProfit: position.contractCount * kelly.economics.netWinProfit,
    estimatedExpectedProfit:
      position.contractCount * kelly.estimated.expectedProfitPerContract,
    conservativeExpectedProfit:
      position.contractCount * kelly.conservative.expectedProfitPerContract,
    bindingReason,
  };
};
