import type { Histogram, QuantileSummary } from "./types.js";

export const quantileSorted = (
  sorted: ArrayLike<number>,
  probability: number,
): number => {
  if (sorted.length === 0)
    throw new Error("Cannot calculate a quantile of an empty sample.");
  if (probability < 0 || probability > 1) {
    throw new Error("Quantile probability must be between 0 and 1.");
  }

  const index = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;
  return lower + (upper - lower) * (index - lowerIndex);
};

export const sortedCopy = (values: ArrayLike<number>): number[] =>
  Array.from(values).sort((left, right) => left - right);

export const summarizeQuantiles = (
  values: ArrayLike<number>,
): QuantileSummary => {
  const sorted = sortedCopy(values);
  return {
    p05: quantileSorted(sorted, 0.05),
    p25: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p95: quantileSorted(sorted, 0.95),
  };
};

export const mean = (values: ArrayLike<number>): number => {
  if (values.length === 0)
    throw new Error("Cannot calculate a mean of an empty sample.");
  let result = 0;
  for (let index = 0; index < values.length; index += 1) {
    result += (values[index]! - result) / (index + 1);
  }
  return result;
};

export const createHistogram = (
  values: ArrayLike<number>,
  binCount = 24,
): Histogram => {
  if (values.length === 0)
    throw new Error("Cannot create a histogram from an empty sample.");
  if (!Number.isInteger(binCount) || binCount < 1) {
    throw new Error("Histogram bin count must be a positive integer.");
  }

  let minimum = values[0]!;
  let maximum = values[0]!;
  for (let index = 1; index < values.length; index += 1) {
    minimum = Math.min(minimum, values[index]!);
    maximum = Math.max(maximum, values[index]!);
  }

  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.01, 0.01);
    minimum -= padding;
    maximum += padding;
  }

  const width = (maximum - minimum) / binCount;
  const counts = Array.from({ length: binCount }, () => 0);
  for (let index = 0; index < values.length; index += 1) {
    const rawIndex = Math.floor((values[index]! - minimum) / width);
    const targetIndex = Math.min(binCount - 1, Math.max(0, rawIndex));
    counts[targetIndex]! += 1;
  }

  return {
    bins: counts.map((count, index) => ({
      lower: minimum + width * index,
      upper: minimum + width * (index + 1),
      count,
    })),
    domain: [minimum, maximum],
    sampleCount: values.length,
  };
};
