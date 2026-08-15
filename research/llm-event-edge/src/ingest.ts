import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CapitalizationId,
  DailyPrice,
  EarningsCandidate,
  EventCase,
  EventOutcome,
  EventSession,
  PreEventMarketFeatures,
  SecFiling,
  SectorId,
  SourceReference,
} from "./domain.js";
import { SECTOR_IDS } from "./domain.js";
import {
  DATA_ROOT,
  mapWithConcurrency,
  readStudyConfig,
  sha256,
  writeJson,
  writeJsonLines,
  writeText,
} from "./io.js";
import {
  capitalizationId,
  fetchNasdaqCalendar,
  fetchNasdaqPrices,
  fetchNasdaqScreener,
  sectorIdsForSecurity,
} from "./providers/nasdaq.js";
import {
  fetchSecCompanyFacts,
  fetchSecSubmissions,
  fetchSecTickerMap,
  secFilingUrl,
} from "./providers/sec.js";
import { marketCloseIso } from "./time.js";

interface CandidateWithFiling {
  candidate: EarningsCandidate;
  filing: SecFiling;
  session: EventSession;
  submissions: SecFiling[];
  submissionsSource: SourceReference;
}

const datesBetween = (startDate: string, endDate: string): string[] => {
  const output: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
};

const nyTimeParts = (acceptedAt: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(acceptedAt));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { hour, minute };
};

const eventSession = (acceptedAt: string): EventSession | null => {
  const { hour, minute } = nyTimeParts(acceptedAt);
  const minutes = hour * 60 + minute;
  if (minutes < 9 * 60 + 30) return "before-market";
  if (minutes >= 16 * 60) return "after-market";
  return null;
};

const matchingEarningsFiling = (
  filings: SecFiling[],
  eventDate: string,
): { filing: SecFiling; session: EventSession } | null => {
  for (const filing of filings) {
    if (
      filing.filingDate !== eventDate ||
      filing.form !== "8-K" ||
      !filing.items.split(",").includes("2.02")
    ) {
      continue;
    }
    const session = eventSession(filing.acceptedAt);
    if (session !== null) return { filing, session };
  }
  return null;
};

const selectStratified = (
  candidates: CandidateWithFiling[],
  target: number,
): CandidateWithFiling[] => {
  const buckets: Record<CapitalizationId, CandidateWithFiling[]> = {
    small: [],
    mid: [],
    large: [],
  };
  for (const candidate of candidates) {
    buckets[candidate.candidate.capitalizationId].push(candidate);
  }
  for (const bucket of Object.values(buckets)) {
    bucket.sort((left, right) =>
      `${left.candidate.eventDate}:${left.candidate.ticker}`.localeCompare(
        `${right.candidate.eventDate}:${right.candidate.ticker}`,
      ),
    );
  }
  const output: CandidateWithFiling[] = [];
  const order: CapitalizationId[] = ["small", "mid", "large"];
  while (output.length < target) {
    let added = false;
    for (const id of order) {
      const value = buckets[id].shift();
      if (value !== undefined) {
        output.push(value);
        added = true;
        if (output.length === target) break;
      }
    }
    if (!added) break;
  }
  return output;
};

const dailyReturns = (prices: DailyPrice[]) =>
  prices.slice(1).map((price, index) => {
    const previous = prices[index];
    if (previous === undefined) return 0;
    return price.close / previous.close - 1;
  });

const sampleStandardDeviation = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const trailingReturn = (
  prices: DailyPrice[],
  entryIndex: number,
  sessions: number,
): number | null => {
  const prior = prices[entryIndex - sessions];
  const entry = prices[entryIndex];
  return prior === undefined || entry === undefined
    ? null
    : entry.close / prior.close - 1;
};

const trailingVolatility = (
  prices: DailyPrice[],
  entryIndex: number,
  sessions: number,
): number | null => {
  if (entryIndex < sessions) return null;
  const window = prices.slice(entryIndex - sessions, entryIndex + 1);
  const standardDeviation = sampleStandardDeviation(dailyReturns(window));
  return standardDeviation === null ? null : standardDeviation * Math.sqrt(252);
};

const drawdownFromHigh = (
  prices: DailyPrice[],
  entryIndex: number,
  sessions: number,
): number | null => {
  const entry = prices[entryIndex];
  if (entry === undefined || entryIndex < sessions) return null;
  const high = Math.max(
    ...prices
      .slice(entryIndex - sessions, entryIndex + 1)
      .map((price) => price.close),
  );
  return high <= 0 ? null : entry.close / high - 1;
};

const priceIndex = (prices: DailyPrice[], date: string) =>
  prices.findIndex((price) => price.date === date);

const returnBetween = (
  prices: DailyPrice[],
  startDate: string,
  endDate: string,
): number | null => {
  const start = prices.find((price) => price.date === startDate);
  const end = prices.find((price) => price.date === endDate);
  return start === undefined || end === undefined
    ? null
    : end.close / start.close - 1;
};

export const marketAndOutcome = (
  prices: DailyPrice[],
  benchmark: DailyPrice[],
  eventDate: string,
  session: EventSession,
): { market: PreEventMarketFeatures; outcome: EventOutcome } | null => {
  const eventIndex = priceIndex(prices, eventDate);
  if (eventIndex < 0) return null;
  const entryIndex = session === "after-market" ? eventIndex : eventIndex - 1;
  const entry = prices[entryIndex];
  const settlement1d = prices[entryIndex + 1];
  if (entry === undefined || settlement1d === undefined) return null;
  const settlement10d = prices[entryIndex + 10];
  const settlement40d = prices[entryIndex + 40];
  const benchmarkReturn1d = returnBetween(
    benchmark,
    entry.date,
    settlement1d.date,
  );
  if (benchmarkReturn1d === null) return null;
  const return1d = settlement1d.close / entry.close - 1;
  const return10d =
    settlement10d === undefined ? null : settlement10d.close / entry.close - 1;
  const benchmarkReturn10d =
    settlement10d === undefined
      ? null
      : returnBetween(benchmark, entry.date, settlement10d.date);
  const return40d =
    settlement40d === undefined ? null : settlement40d.close / entry.close - 1;
  const benchmarkReturn40d =
    settlement40d === undefined
      ? null
      : returnBetween(benchmark, entry.date, settlement40d.date);
  return {
    market: {
      entryDate: entry.date,
      entryClose: entry.close,
      trailingReturn5d: trailingReturn(prices, entryIndex, 5),
      trailingReturn20d: trailingReturn(prices, entryIndex, 20),
      trailingReturn60d: trailingReturn(prices, entryIndex, 60),
      realizedVolatility20d: trailingVolatility(prices, entryIndex, 20),
      realizedVolatility60d: trailingVolatility(prices, entryIndex, 60),
      drawdownFrom60dHigh: drawdownFromHigh(prices, entryIndex, 60),
      benchmarkTrailingReturn20d: (() => {
        const benchmarkEntry = priceIndex(benchmark, entry.date);
        return benchmarkEntry < 0
          ? null
          : trailingReturn(benchmark, benchmarkEntry, 20);
      })(),
    },
    outcome: {
      settlement1dDate: settlement1d.date,
      settlement1dClose: settlement1d.close,
      return1d,
      benchmarkReturn1d,
      marketAdjustedReturn1d: return1d - benchmarkReturn1d,
      settlement10dDate: settlement10d?.date ?? null,
      settlement10dClose: settlement10d?.close ?? null,
      return10d,
      benchmarkReturn10d,
      marketAdjustedReturn10d:
        return10d === null || benchmarkReturn10d === null
          ? null
          : return10d - benchmarkReturn10d,
      settlement40dDate: settlement40d?.date ?? null,
      settlement40dClose: settlement40d?.close ?? null,
      return40d,
      benchmarkReturn40d,
      marketAdjustedReturn40d:
        return40d === null || benchmarkReturn40d === null
          ? null
          : return40d - benchmarkReturn40d,
    },
  };
};

const priorFilings = (filings: SecFiling[], cutoff: string): SecFiling[] =>
  filings
    .filter(
      (filing) =>
        filing.acceptedAt < cutoff &&
        ["10-Q", "10-K", "8-K"].includes(filing.form),
    )
    .sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt))
    .slice(0, 12);

const run = async () => {
  const config = await readStudyConfig();
  const rawRoot = resolve(DATA_ROOT, "raw", config.studyId);
  const dates = datesBetween(config.startDate, config.endDate);
  console.log(`Fetching ${dates.length} Nasdaq earnings calendars…`);
  const calendarResults = await mapWithConcurrency(dates, 3, async (date) => {
    const result = await fetchNasdaqCalendar(date);
    await writeText(
      resolve(rawRoot, "nasdaq-calendar", `${date}.json`),
      result.body,
    );
    return result;
  });

  const [screener, tickerMap] = await Promise.all([
    fetchNasdaqScreener(),
    fetchSecTickerMap(),
  ]);
  await Promise.all([
    writeText(resolve(rawRoot, "nasdaq-screener.json"), screener.body),
    writeText(resolve(rawRoot, "sec-company-tickers.json"), tickerMap.body),
  ]);
  const securities = new Map(
    screener.value.map((security) => [security.ticker, security]),
  );
  const candidateByTicker = new Map<string, EarningsCandidate>();
  for (const result of calendarResults) {
    for (const row of result.value) {
      const security = securities.get(row.ticker);
      const cik = tickerMap.value.get(row.ticker);
      if (
        security === undefined ||
        cik === undefined ||
        security.marketCapUsd < config.minimumMarketCapUsd
      ) {
        continue;
      }
      const sectorIds = sectorIdsForSecurity(
        security.sector,
        security.industry,
      );
      if (sectorIds.length === 0) continue;
      candidateByTicker.set(row.ticker, {
        ...row,
        companyName: security.companyName,
        marketCapUsd: security.marketCapUsd,
        capitalizationId: capitalizationId(security.marketCapUsd),
        nasdaqSector: security.sector,
        industry: security.industry,
        sectorIds,
        cik,
        calendarSource: result.source,
      });
    }
  }

  const preselected = new Map<string, EarningsCandidate>();
  for (const sectorId of SECTOR_IDS) {
    const values = [...candidateByTicker.values()]
      .filter((candidate) => candidate.sectorIds.includes(sectorId))
      .sort((left, right) => right.marketCapUsd - left.marketCapUsd)
      .slice(0, config.maximumCandidatesPerSector);
    for (const candidate of values)
      preselected.set(candidate.ticker, candidate);
  }
  console.log(
    `Matching ${preselected.size} candidates to SEC Item 2.02 filings…`,
  );
  const submissionResults = await mapWithConcurrency(
    [...preselected.values()],
    4,
    async (candidate) => {
      const result = await fetchSecSubmissions(candidate.cik);
      await writeText(
        resolve(rawRoot, "sec-submissions", `${candidate.ticker}.json`),
        result.body,
      );
      const match = matchingEarningsFiling(result.value, candidate.eventDate);
      return match === null
        ? null
        : {
            candidate,
            filing: match.filing,
            session: match.session,
            submissions: result.value,
            submissionsSource: result.source,
          };
    },
  );
  const matched = submissionResults.filter(
    (value): value is CandidateWithFiling => value !== null,
  );
  const selectedBySector = new Map<SectorId, CandidateWithFiling[]>();
  for (const sectorId of SECTOR_IDS) {
    const selected = selectStratified(
      matched.filter(({ candidate }) => candidate.sectorIds.includes(sectorId)),
      config.targetCasesPerSector,
    );
    selectedBySector.set(sectorId, selected);
    console.log(`${sectorId}: selected ${selected.length}`);
  }
  const selected = new Map<string, CandidateWithFiling>();
  for (const values of selectedBySector.values()) {
    for (const value of values) selected.set(value.candidate.ticker, value);
  }

  console.log(
    `Fetching prices and pre-event fundamentals for ${selected.size} issuers…`,
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
  const cases = await mapWithConcurrency(
    [...selected.values()],
    3,
    async ({ candidate, filing, session, submissions, submissionsSource }) => {
      const prices = await fetchNasdaqPrices(
        candidate.ticker,
        "stocks",
        "2026-03-01",
        config.outcomeObservationDate,
      );
      const derived = marketAndOutcome(
        prices.value,
        benchmark.value,
        candidate.eventDate,
        session,
      );
      if (derived === null) return null;
      const informationCutoff = marketCloseIso(derived.market.entryDate);
      const fundamentals = await fetchSecCompanyFacts(
        candidate.cik,
        informationCutoff,
      );
      await Promise.all([
        writeText(
          resolve(rawRoot, "nasdaq-prices", `${candidate.ticker}.json`),
          prices.body,
        ),
        writeText(
          resolve(rawRoot, "sec-companyfacts", `${candidate.ticker}.json`),
          fundamentals.body,
        ),
      ]);
      const sources = [
        candidate.calendarSource,
        screener.source,
        tickerMap.source,
        submissionsSource,
        fundamentals.source,
        prices.source,
        benchmark.source,
      ];
      const eventCase: EventCase = {
        id: `${candidate.ticker}:${filing.accessionNumber}`,
        studyId: config.studyId,
        ticker: candidate.ticker,
        companyName: candidate.companyName,
        cik: candidate.cik,
        marketCapUsd: candidate.marketCapUsd,
        capitalizationId: candidate.capitalizationId,
        nasdaqSector: candidate.nasdaqSector,
        industry: candidate.industry,
        sectorIds: candidate.sectorIds,
        eventType: "earnings",
        eventDate: candidate.eventDate,
        acceptedAt: filing.acceptedAt,
        eventSession: session,
        informationCutoff,
        filing,
        consensusEps: candidate.consensusEps,
        estimateCount: candidate.estimateCount,
        actualEps: candidate.actualEps,
        surprisePercent: candidate.surprisePercent,
        fundamentals: fundamentals.value,
        priorFilings: priorFilings(submissions, informationCutoff),
        marketFeatures: derived.market,
        outcome: derived.outcome,
        sources,
        outcomeSources: [prices.source, benchmark.source],
        retrospectiveQuality: "reconstructed-point-in-time",
      };
      return eventCase;
    },
  );
  const completeCases = cases.filter(
    (value): value is EventCase => value !== null,
  );
  const ledgerPath = resolve(DATA_ROOT, "private", "cases.jsonl");
  await writeJsonLines(ledgerPath, completeCases);
  await writeJsonLines(
    resolve(DATA_ROOT, "pilot-case-index.jsonl"),
    completeCases.map((eventCase) => ({
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
  const sectorCounts = Object.fromEntries(
    SECTOR_IDS.map((sectorId) => [
      sectorId,
      completeCases.filter((eventCase) =>
        eventCase.sectorIds.includes(sectorId),
      ).length,
    ]),
  );
  await writeJson(resolve(DATA_ROOT, "pilot-manifest.json"), {
    studyId: config.studyId,
    generatedAt: new Date().toISOString(),
    methodology: "reconstructed retrospective pipeline-development sample",
    eventType: "earnings reported on Nasdaq and matched to SEC 8-K Item 2.02",
    eventWindow: { start: config.startDate, end: config.endDate },
    outcomeObservationDate: config.outcomeObservationDate,
    totalUniqueCases: completeCases.length,
    privateCaseLedgerSha256: sha256(await readFile(ledgerPath, "utf8")),
    sectorCounts,
    sourceHashes: {
      calendars: calendarResults.map(({ source }) => source),
      screener: screener.source,
      secTickerMap: tickerMap.source,
    },
    limitations: [
      "Current market-cap and sector labels are reconstructed, not point-in-time membership.",
      "Sampling used post-event reconstructed market capitalization; capitalization is omitted from forecast packets and subgroup results remain selection-biased near size thresholds.",
      "Nasdaq consensus fields were retrieved after the event and are assumed to preserve the historical consensus; this is not independently timestamp-verified.",
      "Retrospective forecasts from a current model are pipeline-development evidence, never capital-authorizing validation.",
      "The pharma-biotech profile is an overlapping subset of health care.",
      "Foreign-domiciled US listings are included when Nasdaq and SEC identifiers are available; listing, tax, currency, and option eligibility must be checked separately.",
    ],
  });
  console.log(`Wrote ${completeCases.length} complete cases.`);
};

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  await run();
}
