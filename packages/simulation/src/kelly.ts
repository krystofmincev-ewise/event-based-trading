import type { KellyResult } from "./types.js";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

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

export const calculateKelly = (
  winProbability: number,
  netWinMultiple: number,
): KellyResult => {
  if (
    winProbability < 0 ||
    winProbability > 1 ||
    !Number.isFinite(winProbability)
  ) {
    throw new Error("Win probability must be a finite number between 0 and 1.");
  }
  if (netWinMultiple <= 0 || !Number.isFinite(netWinMultiple)) {
    throw new Error("Net win multiple must be a positive finite number.");
  }

  const lossProbability = 1 - winProbability;
  const rawFraction =
    (netWinMultiple * winProbability - lossProbability) / netWinMultiple;
  const fullFraction = clamp(rawFraction, 0, 1);
  return {
    rawFraction,
    fullFraction,
    halfFraction: fullFraction * 0.5,
    quarterFraction: fullFraction * 0.25,
    edgePerUnitStaked: netWinMultiple * winProbability - lossProbability,
    expectedLogGrowthPerTrade: expectedLogGrowth(
      winProbability,
      netWinMultiple,
      fullFraction,
    ),
  };
};

export const contractPriceToNetWinMultiple = (allInPrice: number): number => {
  if (!Number.isFinite(allInPrice) || allInPrice <= 0 || allInPrice >= 1) {
    throw new Error("All-in contract price must be between 0 and 1.");
  }
  return (1 - allInPrice) / allInPrice;
};

export const netWinMultipleToContractPrice = (
  netWinMultiple: number,
): number => {
  if (!Number.isFinite(netWinMultiple) || netWinMultiple <= 0) {
    throw new Error("Net win multiple must be a positive finite number.");
  }
  return 1 / (netWinMultiple + 1);
};

export const payoutNotionalFraction = (
  bankrollFractionAtRisk: number,
  allInPrice: number,
): number => {
  if (!Number.isFinite(bankrollFractionAtRisk) || bankrollFractionAtRisk < 0) {
    throw new Error(
      "Bankroll fraction at risk must be a non-negative finite number.",
    );
  }
  contractPriceToNetWinMultiple(allInPrice);
  return bankrollFractionAtRisk / allInPrice;
};
