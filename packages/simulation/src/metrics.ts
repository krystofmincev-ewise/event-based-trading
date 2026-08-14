import type { AnnualizedMetrics } from "./types.js";

interface WeeklyReturnAggregates {
  count: number;
  mean: number;
  sumSquaredDeviations: number;
  downsideSquares: number;
}

export const annualizedWeeklyMetrics = (
  aggregates: WeeklyReturnAggregates,
  annualRiskFreeRate: number,
): AnnualizedMetrics => {
  const weeklyRiskFreeReturn = Math.pow(1 + annualRiskFreeRate, 1 / 52) - 1;
  const sampleVariance =
    aggregates.count > 1
      ? Math.max(0, aggregates.sumSquaredDeviations / (aggregates.count - 1))
      : 0;
  const sampleVolatility = Math.sqrt(sampleVariance);
  const downsideDeviation = Math.sqrt(
    aggregates.downsideSquares / aggregates.count,
  );
  const excessMean = aggregates.mean - weeklyRiskFreeReturn;

  return {
    observationFrequency: "weekly end-of-week (pooled simulated path-weeks)",
    observationsPerYear: 52,
    sampleObservationCount: aggregates.count,
    meanPeriodicReturn: aggregates.mean,
    periodicRiskFreeReturn: weeklyRiskFreeReturn,
    annualizedVolatility: sampleVolatility * Math.sqrt(52),
    sharpe:
      sampleVolatility === 0
        ? null
        : (excessMean / sampleVolatility) * Math.sqrt(52),
    sortino:
      downsideDeviation === 0
        ? null
        : (excessMean / downsideDeviation) * Math.sqrt(52),
  };
};

export const createWeeklyReturnAccumulator = (annualRiskFreeRate: number) => {
  const weeklyRiskFreeReturn = Math.pow(1 + annualRiskFreeRate, 1 / 52) - 1;
  const aggregates: WeeklyReturnAggregates = {
    count: 0,
    mean: 0,
    sumSquaredDeviations: 0,
    downsideSquares: 0,
  };

  return {
    add(periodReturn: number): void {
      const downside = Math.min(periodReturn - weeklyRiskFreeReturn, 0);
      aggregates.count += 1;
      const delta = periodReturn - aggregates.mean;
      aggregates.mean += delta / aggregates.count;
      const nextDelta = periodReturn - aggregates.mean;
      aggregates.sumSquaredDeviations += delta * nextDelta;
      aggregates.downsideSquares += downside * downside;
    },
    finish(): AnnualizedMetrics {
      return annualizedWeeklyMetrics(aggregates, annualRiskFreeRate);
    },
  };
};
