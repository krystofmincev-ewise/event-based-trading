import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { StudyConfig } from "./domain.js";
import { asRecord, asString, isoDate } from "./parse.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const STUDY_ROOT = resolve(moduleDirectory, "..");
export const DATA_ROOT = resolve(STUDY_ROOT, "data");

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const ensureDirectory = async (path: string) => {
  await mkdir(path, { recursive: true });
};

const positiveInteger = (value: unknown, context: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${context} must be a positive integer.`);
  }
  return value;
};

const positiveNumber = (value: unknown, context: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${context} must be a positive finite number.`);
  }
  return value;
};

export const parseStudyConfig = (value: unknown): StudyConfig => {
  const source = asRecord(value, "Study config");
  const startDate = isoDate(
    asString(source.startDate, "startDate"),
    "startDate",
  );
  const endDate = isoDate(asString(source.endDate, "endDate"), "endDate");
  if (startDate > endDate)
    throw new Error("startDate must not follow endDate.");
  const outcomeObservationDate = isoDate(
    asString(source.outcomeObservationDate, "outcomeObservationDate"),
    "outcomeObservationDate",
  );
  if (outcomeObservationDate < endDate) {
    throw new Error("outcomeObservationDate must not precede endDate.");
  }
  const analystReplicates = positiveInteger(
    source.analystReplicates,
    "analystReplicates",
  );
  if (analystReplicates !== 2) {
    throw new Error(
      "analystReplicates must be 2 for the locked synthesis graph.",
    );
  }
  const targetCasesPerSector = positiveInteger(
    source.targetCasesPerSector,
    "targetCasesPerSector",
  );
  const maximumCandidatesPerSector = positiveInteger(
    source.maximumCandidatesPerSector,
    "maximumCandidatesPerSector",
  );
  if (maximumCandidatesPerSector < targetCasesPerSector) {
    throw new Error(
      "maximumCandidatesPerSector must be at least targetCasesPerSector.",
    );
  }
  return {
    studyId: asString(source.studyId, "studyId"),
    startDate,
    endDate,
    outcomeObservationDate,
    targetCasesPerSector,
    minimumMarketCapUsd: positiveNumber(
      source.minimumMarketCapUsd,
      "minimumMarketCapUsd",
    ),
    maximumCandidatesPerSector,
    benchmarkSymbol: asString(source.benchmarkSymbol, "benchmarkSymbol"),
    model: asString(source.model, "model"),
    reasoningEffort: asString(source.reasoningEffort, "reasoningEffort"),
    analystReplicates,
    forecastBatchSize: positiveInteger(
      source.forecastBatchSize,
      "forecastBatchSize",
    ),
    maximumConcurrentModelCalls: positiveInteger(
      source.maximumConcurrentModelCalls,
      "maximumConcurrentModelCalls",
    ),
  };
};

export const readStudyConfig = async (): Promise<StudyConfig> => {
  const value: unknown = JSON.parse(
    await readFile(resolve(STUDY_ROOT, "config.json"), "utf8"),
  );
  return parseStudyConfig(value);
};

export const writeJson = async (path: string, value: unknown) => {
  await ensureDirectory(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const writeText = async (path: string, value: string) => {
  await ensureDirectory(dirname(path));
  await writeFile(path, value, "utf8");
};

export const writeJsonLines = async (path: string, values: unknown[]) => {
  await ensureDirectory(dirname(path));
  const body = values.map((value) => JSON.stringify(value)).join("\n");
  await writeFile(path, body.length > 0 ? `${body}\n` : "", "utf8");
};

export const readJsonLines = async <Value>(path: string): Promise<Value[]> => {
  const body = await readFile(path, "utf8");
  return body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Value);
};

export const fetchText = async (
  url: string,
  headers: Record<string, string>,
  retries = 3,
): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, 400 * 2 ** attempt),
      );
    }
  }
  throw lastError;
};

export const mapWithConcurrency = async <Input, Output>(
  values: Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> => {
  const output = new Array<Output>(values.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      const value = values[index];
      if (value === undefined) return;
      output[index] = await mapper(value, index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return output;
};
