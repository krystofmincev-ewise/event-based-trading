const uniqueSorted = (values: number[]): number[] =>
  [...new Set(values.map((value) => Number(value.toFixed(6))))].sort(
    (left, right) => left - right,
  );

export const REGULAR_SWEEP_FRACTIONS = Array.from(
  { length: 16 },
  (_, index) => index / 15,
);
export const BASE_HEATMAP_PROBABILITIES = [0.35, 0.45, 0.5, 0.6, 0.7, 0.8];
export const BASE_HEATMAP_FRACTIONS = [0, 0.03, 0.06, 0.12, 0.2, 0.35, 0.5];

export const buildSweepFractions = (
  userFraction: number,
  kellyFraction: number,
): number[] =>
  uniqueSorted([
    ...REGULAR_SWEEP_FRACTIONS,
    userFraction,
    kellyFraction,
    kellyFraction * 0.5,
    kellyFraction * 0.25,
  ]);

export const buildHeatmapProbabilities = (userProbability: number): number[] =>
  uniqueSorted([...BASE_HEATMAP_PROBABILITIES, userProbability]);

export const buildHeatmapFractions = (userFraction: number): number[] =>
  uniqueSorted([...BASE_HEATMAP_FRACTIONS, userFraction]);
