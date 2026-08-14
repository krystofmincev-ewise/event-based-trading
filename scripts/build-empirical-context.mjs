import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

/** @typedef {{ date: string; values: number[] }} ReturnRow */
/** @typedef {{ headers: string[]; rows: ReturnRow[] }} ReturnDataset */
/** @typedef {[string, string, ReturnDataset, string, string, string]} ProfileDefinition */
/** @typedef {[string, string, string]} CapitalizationDefinition */

const [industry12Path, industry49Path, sizePath] = process.argv.slice(2);

if (!industry12Path || !industry49Path || !sizePath) {
  throw new Error(
    "Usage: node scripts/build-empirical-context.mjs <FF12 CSV> <FF49 CSV> <size CSV>",
  );
}

/**
 * @param {string} path
 * @returns {ReturnDataset}
 */
const parseValueWeightedDaily = (path) => {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const marker = lines.findIndex((line) =>
    line.includes("Average Value Weighted Returns -- Daily"),
  );
  if (marker < 0)
    throw new Error(`Value-weighted daily section missing: ${path}`);
  const headers = lines[marker + 1]
    .split(",")
    .slice(1)
    .map((cell) => cell.trim());
  /** @type {ReturnRow[]} */
  const rows = [];
  const dataLines = lines.slice(marker + 2);
  for (let offset = 0; offset < dataLines.length; offset += 1) {
    const line = dataLines[offset];
    if (line === undefined) break;
    if (!/^\d{8},/.test(line)) break;
    const cells = line.split(",");
    if (cells.length !== headers.length + 1) {
      throw new Error(
        `Unexpected column count at ${path}:${marker + 3 + offset}.`,
      );
    }
    const date = cells[0].trim();
    if (date < "20000101" || date > "20251231") continue;
    if (rows.length > 0 && rows[rows.length - 1].date >= date) {
      throw new Error(
        `Dates must be unique and ascending in ${path}: ${date}.`,
      );
    }
    const values = cells.slice(1).map((cell, columnIndex) => {
      const text = cell.trim();
      const parsed = text === "" ? Number.NaN : Number(text);
      if (!Number.isFinite(parsed)) {
        throw new Error(
          `Invalid numeric value at ${path}:${marker + 3 + offset}, column ${columnIndex + 2}.`,
        );
      }
      return parsed / 100;
    });
    rows.push({ date, values });
  }
  return { headers, rows };
};

/** @param {string} path */
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** @param {string} compact */
const isoDate = (compact) =>
  `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

/**
 * @param {number[]} values
 * @param {number} probability
 */
const quantile = (values, probability) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

/**
 * @param {ReturnDataset} dataset
 * @param {string} column
 * @param {1 | 10} horizon
 */
const summarize = (dataset, column, horizon) => {
  const columnIndex = dataset.headers.indexOf(column);
  if (columnIndex < 0) throw new Error(`Portfolio ${column} is unavailable.`);
  const daily = dataset.rows.map((row) => row.values[columnIndex]);
  if (daily.some((value) => value <= -0.99)) {
    throw new Error(`Portfolio ${column} contains missing return markers.`);
  }
  /** @type {number[]} */
  const returns = [];
  if (horizon === 1) {
    returns.push(...daily);
  } else {
    for (let end = horizon - 1; end < daily.length; end += 1) {
      let growth = 1;
      for (let index = end - horizon + 1; index <= end; index += 1) {
        growth *= 1 + daily[index];
      }
      returns.push(growth - 1);
    }
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const standardDeviation = Math.sqrt(
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (returns.length - 1),
  );
  const absolute = returns.map(Math.abs);
  /** @param {number} threshold */
  const thresholdRate = (threshold) => ({
    up: returns.filter((value) => value >= threshold).length / returns.length,
    down:
      returns.filter((value) => value <= -threshold).length / returns.length,
    absolute:
      returns.filter((value) => Math.abs(value) >= threshold).length /
      returns.length,
  });
  return {
    sampleSize: returns.length,
    upProbability: returns.filter((value) => value > 0).length / returns.length,
    downProbability:
      returns.filter((value) => value < 0).length / returns.length,
    tieProbability:
      returns.filter((value) => value === 0).length / returns.length,
    meanReturn: mean,
    standardDeviation,
    medianReturn: quantile(returns, 0.5),
    medianAbsoluteReturn: quantile(absolute, 0.5),
    p90AbsoluteReturn: quantile(absolute, 0.9),
    p95AbsoluteReturn: quantile(absolute, 0.95),
    thresholdRates: {
      2: thresholdRate(0.02),
      5: thresholdRate(0.05),
      10: thresholdRate(0.1),
    },
  };
};

const ff12 = parseValueWeightedDaily(industry12Path);
const ff49 = parseValueWeightedDaily(industry49Path);
const size = parseValueWeightedDaily(sizePath);
for (const candidate of [ff49, size]) {
  if (
    candidate.rows.length !== ff12.rows.length ||
    candidate.rows.some((row, index) => row.date !== ff12.rows[index].date)
  ) {
    throw new Error(
      "All empirical source files must share the same date index.",
    );
  }
}
/**
 * @param {ReturnDataset} dataset
 * @param {string} column
 */
const withHorizons = (dataset, column) => ({
  1: summarize(dataset, column, 1),
  10: summarize(dataset, column, 10),
});

/** @type {ProfileDefinition[]} */
const profileDefinitions = [
  [
    "communication-services",
    "Communication Services",
    ff12,
    "Telcm",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "consumer-discretionary",
    "Consumer Discretionary",
    ff12,
    "Shops",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "consumer-staples",
    "Consumer Staples",
    ff12,
    "NoDur",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "energy",
    "Energy",
    ff12,
    "Enrgy",
    "Fama-French 12 Industry",
    "closest-sic-proxy",
  ],
  [
    "financials",
    "Financials",
    ff12,
    "Money",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "health-care",
    "Health Care",
    ff12,
    "Hlth",
    "Fama-French 12 Industry",
    "closest-sic-proxy",
  ],
  [
    "industrials",
    "Industrials",
    ff12,
    "Manuf",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "information-technology",
    "Information Technology",
    ff12,
    "BusEq",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "materials",
    "Materials",
    ff12,
    "Chems",
    "Fama-French 12 Industry",
    "partial-sic-proxy",
  ],
  [
    "real-estate",
    "Real Estate",
    ff49,
    "RlEst",
    "Fama-French 49 Industry",
    "closest-sic-proxy",
  ],
  [
    "utilities",
    "Utilities",
    ff12,
    "Utils",
    "Fama-French 12 Industry",
    "closest-sic-proxy",
  ],
  [
    "pharma-biotech",
    "Pharma & Biotech",
    ff49,
    "Drugs",
    "Fama-French 49 Industry",
    "industry-overlay",
  ],
];

const profiles = profileDefinitions.map(
  ([id, label, dataset, proxyPortfolio, proxySystem, mappingQuality]) => ({
    id,
    label,
    proxyPortfolio,
    proxySystem,
    mappingQuality,
    horizons: withHorizons(dataset, proxyPortfolio),
  }),
);

/** @type {CapitalizationDefinition[]} */
const capitalizationProfiles = [
  ["small", "NYSE bottom-30% size-volatility proxy", "Lo 30"],
  ["mid", "NYSE middle-40% size-volatility proxy", "Med 40"],
  ["large", "NYSE top-30% size-volatility proxy", "Hi 30"],
].map(([id, label, proxyPortfolio]) => ({
  id,
  label,
  proxyPortfolio,
  horizons: withHorizons(size, proxyPortfolio),
}));

const firstObservation = ff12.rows[0];
const lastObservation = ff12.rows[ff12.rows.length - 1];
if (!firstObservation || !lastObservation) {
  throw new Error("The filtered return sample is empty.");
}

const dataset = {
  version: "ff-context-2026.08.14-v1",
  generatedAt: "2026-08-14",
  sampleStart: isoDate(firstObservation.date),
  sampleEnd: isoDate(lastObservation.date),
  returnType: "value-weighted daily portfolio total return",
  tenDayMethod: "overlapping compounded 10-trading-day return",
  sectorTaxonomy:
    "Fama-French SIC portfolios mapped approximately to GICS labels",
  source: {
    label: "Kenneth R. French Data Library",
    url: "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html",
    industry12Url:
      "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/12_Industry_Portfolios_daily_CSV.zip",
    industry49Url:
      "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/49_Industry_Portfolios_daily_CSV.zip",
    sizeUrl:
      "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Portfolios_Formed_on_ME_daily_CSV.zip",
    retrievalDate: "2026-08-14",
    databaseVintage: "202606 CRSP database",
    sha256: {
      industry12: sha256(industry12Path),
      industry49: sha256(industry49Path),
      size: sha256(sizePath),
    },
  },
  profiles,
  capitalizationProfiles,
};

const output = `// Generated by scripts/build-empirical-context.mjs. Do not edit by hand.\nimport type { EmpiricalContextDataset } from "./empiricalContext.types.js";\n\nexport const EMPIRICAL_CONTEXT_DATASET = ${JSON.stringify(dataset, null, 2)} as const satisfies EmpiricalContextDataset;\n`;
writeFileSync(
  resolve("packages/simulation/src/empiricalContext.generated.ts"),
  output,
);
