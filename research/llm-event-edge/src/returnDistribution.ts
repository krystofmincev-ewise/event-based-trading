import { asRecord, asString, optionalNumber } from "./parse.js";

export const RETURN_CDF_POINTS = [
  { field: "pLeMinus10", threshold: -0.1 },
  { field: "pLeMinus5", threshold: -0.05 },
  { field: "pLeMinus2", threshold: -0.02 },
  { field: "pLeZero", threshold: 0 },
  { field: "pLePlus2", threshold: 0.02 },
  { field: "pLePlus5", threshold: 0.05 },
  { field: "pLePlus10", threshold: 0.1 },
] as const;

export type ReturnCdfField = (typeof RETURN_CDF_POINTS)[number]["field"];

export interface ReturnDistributionForecast {
  caseId: string;
  horizonSessions: 1 | 5 | 10 | 20 | 40;
  cdf: Record<ReturnCdfField, number>;
  expectedReturn: number;
  abstain: boolean;
}

const probability = (
  row: Record<string, unknown>,
  field: ReturnCdfField,
): number => {
  const value = optionalNumber(row[field]);
  if (value === null || value < 0.02 || value > 0.98) {
    throw new Error(`${field} must be between 0.02 and 0.98.`);
  }
  return value;
};

export const parseReturnDistributionForecast = (
  value: unknown,
): ReturnDistributionForecast => {
  const row = asRecord(value, "Return distribution forecast");
  const cdfRow = asRecord(row.cdf, "cdf");
  const cdf = Object.fromEntries(
    RETURN_CDF_POINTS.map(({ field }) => [field, probability(cdfRow, field)]),
  ) as Record<ReturnCdfField, number>;
  const values = RETURN_CDF_POINTS.map(({ field }) => cdf[field]);
  if (
    values.some((probability, index) => probability < (values[index - 1] ?? 0))
  ) {
    throw new Error("Return CDF probabilities must be monotone nondecreasing.");
  }
  const horizonSessions = optionalNumber(row.horizonSessions);
  if (![1, 5, 10, 20, 40].includes(horizonSessions ?? -1)) {
    throw new Error("horizonSessions is unsupported.");
  }
  const expectedReturn = optionalNumber(row.expectedReturn);
  if (expectedReturn === null || Math.abs(expectedReturn) > 0.5) {
    throw new Error("expectedReturn must be between -0.5 and 0.5.");
  }
  if (typeof row.abstain !== "boolean") {
    throw new Error("abstain must be boolean.");
  }
  return {
    caseId: asString(row.caseId, "caseId"),
    horizonSessions: horizonSessions as 1 | 5 | 10 | 20 | 40,
    cdf,
    expectedReturn,
    abstain: row.abstain,
  };
};

export const terminalTailProbabilities = (
  forecast: ReturnDistributionForecast,
) => ({
  down10: forecast.cdf.pLeMinus10,
  down5: forecast.cdf.pLeMinus5,
  down2: forecast.cdf.pLeMinus2,
  up2: 1 - forecast.cdf.pLePlus2,
  up5: 1 - forecast.cdf.pLePlus5,
  up10: 1 - forecast.cdf.pLePlus10,
});
