import type { EventForecast, ForecastBatch } from "./domain.js";
import { asArray, asRecord, asString } from "./parse.js";

const boundedProbability = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be finite.`);
  }
  if (value < 0.02 || value > 0.98) {
    throw new Error(`${field} must be within [0.02, 0.98].`);
  }
  return value;
};

const boundedReturn = (
  value: unknown,
  field: string,
  maximum: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < -1 ||
    value > maximum
  ) {
    throw new Error(`${field} is outside its supported range.`);
  }
  return value;
};

const parseForecast = (value: unknown): EventForecast => {
  const row = asRecord(value, "Forecast");
  const confidence = asString(row.confidence, "confidence");
  if (!(["low", "medium", "high"] as const).some((x) => x === confidence)) {
    throw new Error(`Unsupported confidence: ${confidence}`);
  }
  if (typeof row.abstain !== "boolean") {
    throw new Error("abstain must be boolean.");
  }
  const forecast: EventForecast = {
    caseId: asString(row.caseId, "caseId"),
    probabilityUp1d: boundedProbability(row.probabilityUp1d, "probabilityUp1d"),
    probabilityUp10d: boundedProbability(
      row.probabilityUp10d,
      "probabilityUp10d",
    ),
    probabilityAbsolute2Percent1d: boundedProbability(
      row.probabilityAbsolute2Percent1d,
      "probabilityAbsolute2Percent1d",
    ),
    probabilityAbsolute5Percent1d: boundedProbability(
      row.probabilityAbsolute5Percent1d,
      "probabilityAbsolute5Percent1d",
    ),
    probabilityAbsolute5Percent10d: boundedProbability(
      row.probabilityAbsolute5Percent10d,
      "probabilityAbsolute5Percent10d",
    ),
    probabilityUp40d: boundedProbability(
      row.probabilityUp40d,
      "probabilityUp40d",
    ),
    probabilityAbsolute10Percent40d: boundedProbability(
      row.probabilityAbsolute10Percent40d,
      "probabilityAbsolute10Percent40d",
    ),
    expectedReturn1d: boundedReturn(
      row.expectedReturn1d,
      "expectedReturn1d",
      3,
    ),
    expectedReturn10d: boundedReturn(
      row.expectedReturn10d,
      "expectedReturn10d",
      5,
    ),
    expectedReturn40d: boundedReturn(
      row.expectedReturn40d,
      "expectedReturn40d",
      10,
    ),
    confidence: confidence as EventForecast["confidence"],
    abstain: row.abstain,
    thesis: asString(row.thesis, "thesis"),
    disconfirmingEvidence: asString(
      row.disconfirmingEvidence,
      "disconfirmingEvidence",
    ),
  };
  if (
    forecast.probabilityAbsolute5Percent1d >
    forecast.probabilityAbsolute2Percent1d
  ) {
    throw new Error(
      "probabilityAbsolute5Percent1d cannot exceed probabilityAbsolute2Percent1d.",
    );
  }
  return forecast;
};

export const parseForecastBatch = (value: unknown): ForecastBatch => {
  const root = asRecord(value, "Forecast batch");
  return {
    forecasts: asArray(root.forecasts, "forecasts").map(parseForecast),
  };
};

export const assertForecastCoverage = (
  forecasts: EventForecast[],
  expectedIds: string[],
) => {
  const actualIds = forecasts.map(({ caseId }) => caseId);
  if (new Set(actualIds).size !== actualIds.length) {
    throw new Error("Forecast response contains duplicate case IDs.");
  }
  const actual = new Set(actualIds);
  const missing = expectedIds.filter((id) => !actual.has(id));
  const unexpected = actualIds.filter((id) => !expectedIds.includes(id));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Forecast coverage mismatch. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }
};
