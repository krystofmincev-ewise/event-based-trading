import type { ContractEconomics, KellyResult, KellyScenario } from "./types.js";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const assertFinitePositive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
};

export const deriveContractEconomics = (
  purchasePrice: number,
  settlementPayout: number,
  roundTripCosts: number,
): ContractEconomics => {
  assertFinitePositive(purchasePrice, "Contract purchase price");
  assertFinitePositive(settlementPayout, "Settlement payout");
  if (!Number.isFinite(roundTripCosts) || roundTripCosts < 0) {
    throw new Error("Round-trip costs must be a non-negative finite number.");
  }
  const allInCost = purchasePrice + roundTripCosts;
  if (allInCost >= settlementPayout) {
    throw new Error(
      "Contract purchase price plus round-trip costs must be below settlement payout.",
    );
  }
  const netWinProfit = settlementPayout - allInCost;
  return {
    purchasePrice,
    settlementPayout,
    roundTripCosts,
    allInCost,
    netWinProfit,
    netWinMultiple: netWinProfit / allInCost,
    breakEvenProbability: allInCost / settlementPayout,
  };
};

export const expectedLogGrowth = (
  winProbability: number,
  netWinMultiple: number,
  fraction: number,
): number | null => {
  if (fraction === 1 && winProbability < 1) return null;
  const winTerm = winProbability * Math.log1p(fraction * netWinMultiple);
  const lossProbability = 1 - winProbability;
  const lossTerm =
    lossProbability === 0 ? 0 : lossProbability * Math.log1p(-fraction);
  return winTerm + lossTerm;
};

const calculateScenario = (
  probability: number,
  economics: ContractEconomics,
): KellyScenario => {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("Win probability must be a finite number between 0 and 1.");
  }
  const lossProbability = 1 - probability;
  const rawFraction =
    (economics.netWinMultiple * probability - lossProbability) /
    economics.netWinMultiple;
  const actionableFraction = clamp(rawFraction, 0, 1);
  const expectedProfitPerContract =
    probability * economics.settlementPayout - economics.allInCost;
  return {
    probability,
    rawFraction,
    actionableFraction,
    expectedProfitPerContract,
    expectedReturnOnCapitalAtRisk:
      expectedProfitPerContract / economics.allInCost,
    expectedLogGrowthPerEvent: expectedLogGrowth(
      probability,
      economics.netWinMultiple,
      actionableFraction,
    ),
  };
};

export const calculateKelly = (
  winProbability: number,
  probabilityHaircut: number,
  purchasePrice: number,
  settlementPayout: number,
  roundTripCosts: number,
): KellyResult => {
  if (
    !Number.isFinite(probabilityHaircut) ||
    probabilityHaircut < 0 ||
    probabilityHaircut > 1
  ) {
    throw new Error(
      "Probability haircut must be a finite number between 0 and 1.",
    );
  }
  const economics = deriveContractEconomics(
    purchasePrice,
    settlementPayout,
    roundTripCosts,
  );
  return {
    economics,
    estimated: calculateScenario(winProbability, economics),
    conservative: calculateScenario(
      Math.max(0, winProbability - probabilityHaircut),
      economics,
    ),
    probabilityHaircut,
  };
};

export const wholeContractPosition = (
  bankroll: number,
  targetFraction: number,
  allInCost: number,
): {
  contractCount: number;
  capitalAtRisk: number;
  executedFraction: number;
} => {
  if (!Number.isFinite(bankroll) || bankroll < 0) {
    throw new Error("Bankroll must be a non-negative finite number.");
  }
  if (
    !Number.isFinite(targetFraction) ||
    targetFraction < 0 ||
    targetFraction > 1
  ) {
    throw new Error("Target fraction must be between 0 and 1.");
  }
  assertFinitePositive(allInCost, "All-in contract cost");
  const contractCount = Math.floor((bankroll * targetFraction) / allInCost);
  const capitalAtRisk = contractCount * allInCost;
  return {
    contractCount,
    capitalAtRisk,
    executedFraction: bankroll === 0 ? 0 : capitalAtRisk / bankroll,
  };
};
