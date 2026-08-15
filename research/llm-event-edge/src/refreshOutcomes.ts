import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { EventCase } from "./domain.js";
import { assertArtifactHash, assertUniqueValues } from "./artifactControls.js";
import {
  DATA_ROOT,
  mapWithConcurrency,
  readJsonLines,
  readStudyConfig,
  sha256,
  writeJson,
  writeJsonLines,
  writeText,
} from "./io.js";
import { marketAndOutcome } from "./ingest.js";
import { asRecord } from "./parse.js";
import { fetchNasdaqPrices } from "./providers/nasdaq.js";
import { secFilingUrl } from "./providers/sec.js";

const run = async () => {
  const config = await readStudyConfig();
  const ledgerPath = resolve(DATA_ROOT, "private", "cases.jsonl");
  const predecessorLedgerBody = await readFile(ledgerPath, "utf8");
  const predecessorLedgerSha256 = sha256(predecessorLedgerBody);
  const manifestPath = resolve(DATA_ROOT, "pilot-manifest.json");
  const manifest = asRecord(
    JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
    "Pilot manifest",
  );
  if (manifest.studyId !== config.studyId) {
    throw new Error(
      "Refusing to refresh a ledger that does not match its manifest.",
    );
  }
  assertArtifactHash(
    predecessorLedgerSha256,
    manifest.privateCaseLedgerSha256,
    "Refusing to refresh a ledger that",
  );
  if (
    typeof manifest.outcomeObservationDate === "string" &&
    config.outcomeObservationDate < manifest.outcomeObservationDate
  ) {
    throw new Error("outcomeObservationDate cannot move backwards.");
  }
  const cases = await readJsonLines<EventCase>(ledgerPath);
  assertUniqueValues(
    cases.map(({ id }) => id),
    "Ledger to refresh",
  );
  const rawRoot = resolve(
    DATA_ROOT,
    "raw",
    config.studyId,
    "outcome-refresh",
    config.outcomeObservationDate,
  );
  const benchmark = await fetchNasdaqPrices(
    config.benchmarkSymbol,
    "etf",
    "2026-03-01",
    config.outcomeObservationDate,
  );
  await writeText(
    resolve(rawRoot, `nasdaq-prices-${config.benchmarkSymbol}.json`),
    benchmark.body,
  );
  const refreshed = await mapWithConcurrency(cases, 3, async (eventCase) => {
    const prices = await fetchNasdaqPrices(
      eventCase.ticker,
      "stocks",
      "2026-03-01",
      config.outcomeObservationDate,
    );
    await writeText(
      resolve(rawRoot, "nasdaq-prices", `${eventCase.ticker}.json`),
      prices.body,
    );
    const derived = marketAndOutcome(
      prices.value,
      benchmark.value,
      eventCase.eventDate,
      eventCase.eventSession,
    );
    if (derived === null) {
      throw new Error(`Could not refresh outcome for ${eventCase.id}.`);
    }
    return {
      ...eventCase,
      outcome: derived.outcome,
      outcomeSources: [prices.source, benchmark.source],
    };
  });
  await writeJsonLines(ledgerPath, refreshed);
  await writeJsonLines(
    resolve(DATA_ROOT, "pilot-case-index.jsonl"),
    refreshed.map((eventCase) => ({
      id: eventCase.id,
      ticker: eventCase.ticker,
      companyName: eventCase.companyName,
      eventDate: eventCase.eventDate,
      acceptedAt: eventCase.acceptedAt,
      eventSession: eventCase.eventSession,
      sectorIds: eventCase.sectorIds,
      capitalizationId: eventCase.capitalizationId,
      secFilingUrl: secFilingUrl(eventCase.cik, eventCase.filing),
      return1d: eventCase.outcome.return1d,
      return10d: eventCase.outcome.return10d,
      return40d: eventCase.outcome.return40d,
      marketAdjustedReturn1d: eventCase.outcome.marketAdjustedReturn1d,
      marketAdjustedReturn10d: eventCase.outcome.marketAdjustedReturn10d,
      marketAdjustedReturn40d: eventCase.outcome.marketAdjustedReturn40d,
      retrospectiveQuality: eventCase.retrospectiveQuality,
    })),
  );
  await writeJson(manifestPath, {
    ...manifest,
    outcomeObservationDate: config.outcomeObservationDate,
    outcomeRefreshedAt: new Date().toISOString(),
    predecessorLedgerSha256,
    predecessorOutcomeObservationDate: manifest.outcomeObservationDate ?? null,
    privateCaseLedgerSha256: sha256(await readFile(ledgerPath, "utf8")),
    matureOutcomeCounts: {
      oneDay: refreshed.filter(({ outcome }) => outcome.return1d !== null)
        .length,
      tenDay: refreshed.filter(({ outcome }) => outcome.return10d !== null)
        .length,
      fortyDay: refreshed.filter(({ outcome }) => outcome.return40d !== null)
        .length,
    },
    outcomeSourceHashes: {
      benchmark: benchmark.source,
      securities: Object.fromEntries(
        refreshed.map((eventCase) => [
          eventCase.ticker,
          eventCase.outcomeSources[0],
        ]),
      ),
    },
  });
  console.log(`Refreshed outcomes for ${refreshed.length} frozen cases.`);
};

await run();
