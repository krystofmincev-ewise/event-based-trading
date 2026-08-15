import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { STUDY_ROOT, writeJson } from "./io.js";
import { asArray, asRecord, asString } from "./parse.js";
import { fetchNasdaqPrices } from "./providers/nasdaq.js";

const run = async () => {
  const sourcePath = resolve(STUDY_ROOT, "hypotheses", "user-seed-cases.json");
  const source = asRecord(
    JSON.parse(await readFile(sourcePath, "utf8")) as unknown,
    "Seed cases",
  );
  const startDate = asString(
    source.recoveredForecastIssuedAt,
    "recoveredForecastIssuedAt",
  ).slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(
    asArray(source.cases, "cases").map(async (value) => {
      const seed = asRecord(value, "seed case");
      const ticker = asString(seed.ticker, "ticker");
      if (!/^[A-Z]+$/.test(ticker)) {
        return { ticker, status: "unsupported-non-us-symbol" };
      }
      try {
        const prices = await fetchNasdaqPrices(
          ticker,
          "stocks",
          startDate,
          endDate,
        );
        const first = prices.value[0];
        const last = prices.value.at(-1);
        if (first === undefined || last === undefined) {
          return { ticker, status: "no-price-observations" };
        }
        return {
          ticker,
          status: "descriptive-only",
          startDate: first.date,
          startClose: first.close,
          endDate: last.date,
          endClose: last.close,
          rawReturn: last.close / first.close - 1,
        };
      } catch (error) {
        return {
          ticker,
          status: "fetch-failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );
  await writeJson(resolve(STUDY_ROOT, "hypotheses", "seed-audit-latest.json"), {
    generatedAt: new Date().toISOString(),
    status: "selected-anecdotes-not-validation",
    selectionBiasWarning:
      "These names were supplied after favorable perceived performance; no aggregate edge inference is permitted.",
    results,
  });
  console.log(`Audited ${results.length} private seed cases.`);
};

await run();
