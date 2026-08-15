import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { EventCase, HistoricalMetric } from "./domain.js";
import { assertArtifactHash, assertUniqueValues } from "./artifactControls.js";
import {
  DATA_ROOT,
  readJsonLines,
  readStudyConfig,
  sha256,
  writeJson,
  writeJsonLines,
} from "./io.js";
import { asRecord } from "./parse.js";
import { marketCloseIso } from "./time.js";

const beforeEventDate = (cutoff: string) => (metric: HistoricalMetric) =>
  metric.filedAt < cutoff.slice(0, 10);

const run = async () => {
  const config = await readStudyConfig();
  const ledgerPath = resolve(DATA_ROOT, "private", "cases.jsonl");
  const ledgerBody = await readFile(ledgerPath, "utf8");
  const predecessorLedgerSha256 = sha256(ledgerBody);
  const manifestPath = resolve(DATA_ROOT, "pilot-manifest.json");
  const manifest = asRecord(
    JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
    "Pilot manifest",
  );
  assertArtifactHash(
    predecessorLedgerSha256,
    manifest.privateCaseLedgerSha256,
    "Refusing to sanitize a ledger that",
    { allowMissingExpected: true },
  );
  const cases = await readJsonLines<EventCase>(ledgerPath);
  assertUniqueValues(
    cases.map(({ id }) => id),
    "Ledger to sanitize",
  );
  let removed = 0;
  const sanitized = cases.map((eventCase) => {
    const informationCutoff = marketCloseIso(
      eventCase.marketFeatures.entryDate,
    );
    const keep = beforeEventDate(informationCutoff);
    const fundamentals = {
      revenue: eventCase.fundamentals.revenue.filter(keep),
      dilutedEps: eventCase.fundamentals.dilutedEps.filter(keep),
      netIncome: eventCase.fundamentals.netIncome.filter(keep),
      researchAndDevelopment:
        eventCase.fundamentals.researchAndDevelopment.filter(keep),
    };
    removed +=
      eventCase.fundamentals.revenue.length - fundamentals.revenue.length;
    removed +=
      eventCase.fundamentals.dilutedEps.length - fundamentals.dilutedEps.length;
    removed +=
      eventCase.fundamentals.netIncome.length - fundamentals.netIncome.length;
    removed +=
      eventCase.fundamentals.researchAndDevelopment.length -
      fundamentals.researchAndDevelopment.length;
    const priorFilings = eventCase.priorFilings.filter(
      ({ acceptedAt }) => acceptedAt < informationCutoff,
    );
    removed += eventCase.priorFilings.length - priorFilings.length;
    const outcomeSources =
      eventCase.outcomeSources ??
      eventCase.sources.filter(
        ({ provider, url }) =>
          provider === "nasdaq" && url.includes("/historical?"),
      );
    return {
      ...eventCase,
      informationCutoff,
      fundamentals,
      priorFilings,
      outcomeSources,
    };
  });
  await writeJsonLines(ledgerPath, sanitized);
  const sourceHashes = asRecord(manifest.sourceHashes, "sourceHashes");
  const clearPlannedTimestamp = (value: unknown) => {
    const source = asRecord(value, "source hash");
    return { ...source, retrievedAt: null };
  };
  const calendars = Array.isArray(sourceHashes.calendars)
    ? sourceHashes.calendars.map(clearPlannedTimestamp)
    : [];
  const limitations = Array.isArray(manifest.limitations)
    ? manifest.limitations.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const priorRemediation =
    typeof manifest.remediation === "object" &&
    manifest.remediation !== null &&
    !Array.isArray(manifest.remediation)
      ? (manifest.remediation as Record<string, unknown>)
      : {};
  const priorRemoved =
    typeof priorRemediation.removedSameDayOrLaterObservations === "number"
      ? priorRemediation.removedSameDayOrLaterObservations
      : 0;
  await writeJson(manifestPath, {
    ...manifest,
    privateCaseLedgerSha256: sha256(await readFile(ledgerPath, "utf8")),
    outcomeObservationDate: config.outcomeObservationDate,
    matureOutcomeCounts: {
      oneDay: sanitized.filter(({ outcome }) => outcome.return1d !== null)
        .length,
      tenDay: sanitized.filter(({ outcome }) => outcome.return10d !== null)
        .length,
      fortyDay: sanitized.filter(({ outcome }) => outcome.return40d !== null)
        .length,
    },
    remediation: {
      appliedAt: new Date().toISOString(),
      predecessorLedgerSha256,
      removedSameDayOrLaterObservations: priorRemoved + removed,
      decisionCutoff: "last regular-session close at the outcome anchor",
    },
    sourceHashes: {
      ...sourceHashes,
      calendars,
      screener: clearPlannedTimestamp(sourceHashes.screener),
      secTickerMap: clearPlannedTimestamp(sourceHashes.secTickerMap),
    },
    sourceRetrievalTimestampQuality:
      "Per-response timestamps were not retained in v1; planned timestamps were removed. Future ingests record completion time.",
    limitations: [
      ...new Set([
        ...limitations.filter(
          (value) =>
            !value.startsWith(
              "Nasdaq consensus fields were retrieved after the event",
            ),
        ),
        "Nasdaq consensus fields were retrieved after the event and are retained only in the private audit ledger; they are excluded from forecast packets.",
        "Sampling used post-event reconstructed market capitalization; capitalization is omitted from forecast packets and subgroup results remain selection-biased near size thresholds.",
        "The completed anchor close is an outcome boundary, not an executable fill; retrospective trading returns are deliberately not computed.",
        "Version-one stratification selects the earliest eligible rows within each reconstructed capitalization bucket, overweighting the earlier part of the event window.",
        "V1 raw snapshots retain source URL and response hash but not reliable per-response retrieval timestamps.",
      ]),
    ],
  });
  console.log(
    `Sanitized ${sanitized.length} cases; removed ${removed} same-day or later fundamental observations.`,
  );
};

await run();
