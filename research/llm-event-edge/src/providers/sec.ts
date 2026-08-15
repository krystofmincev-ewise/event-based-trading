import type {
  HistoricalMetric,
  PreEventFundamentals,
  SecFiling,
  SourceReference,
} from "../domain.js";
import { fetchText, sha256 } from "../io.js";
import {
  asArray,
  asRecord,
  asString,
  optionalNumber,
  optionalRecord,
  optionalString,
} from "../parse.js";

const secHeaders = () => {
  const userAgent = process.env.SEC_USER_AGENT;
  if (userAgent === undefined || userAgent.trim().length === 0) {
    throw new Error(
      "SEC_USER_AGENT is required and must identify your application and contact address.",
    );
  }
  return { Accept: "application/json", "User-Agent": userAgent };
};

export interface SecResult<Value> {
  value: Value;
  body: string;
  source: SourceReference;
}

const buildSource = (url: string, body: string): SourceReference => ({
  provider: "sec",
  url,
  retrievedAt: new Date().toISOString(),
  sha256: sha256(body),
});

export const fetchSecTickerMap = async (): Promise<
  SecResult<Map<string, number>>
> => {
  const url = "https://www.sec.gov/files/company_tickers.json";
  const body = await fetchText(url, secHeaders());
  const root = asRecord(JSON.parse(body) as unknown, "SEC ticker map");
  const output = new Map<string, number>();
  for (const value of Object.values(root)) {
    const row = optionalRecord(value);
    const ticker = optionalString(row?.ticker)?.toUpperCase();
    const cik = optionalNumber(row?.cik_str);
    if (ticker !== undefined && cik !== null) output.set(ticker, cik);
  }
  return { value: output, body, source: buildSource(url, body) };
};

const column = (recent: Record<string, unknown>, name: string): unknown[] =>
  asArray(recent[name], `SEC recent.${name}`);

const parseSubmissions = (body: string): SecFiling[] => {
  const root = asRecord(JSON.parse(body) as unknown, "SEC submissions");
  const filings = asRecord(root.filings, "SEC filings");
  const recent = asRecord(filings.recent, "SEC recent filings");
  const accessions = column(recent, "accessionNumber");
  const accepted = column(recent, "acceptanceDateTime");
  const dates = column(recent, "filingDate");
  const forms = column(recent, "form");
  const items = column(recent, "items");
  const primaryDocuments = column(recent, "primaryDocument");
  return accessions.map((accession, index) => ({
    accessionNumber: asString(accession, "SEC accession number"),
    acceptedAt: asString(accepted[index], "SEC acceptance time"),
    filingDate: asString(dates[index], "SEC filing date"),
    form: asString(forms[index], "SEC form"),
    items: asString(items[index] ?? "", "SEC items"),
    primaryDocument: asString(primaryDocuments[index], "SEC primary document"),
  }));
};

export const fetchSecSubmissions = async (
  cik: number,
): Promise<SecResult<SecFiling[]>> => {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const body = await fetchText(url, secHeaders());
  return {
    value: parseSubmissions(body),
    body,
    source: buildSource(url, body),
  };
};

const METRIC_CONCEPTS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
  ],
  dilutedEps: ["EarningsPerShareDiluted"],
  netIncome: ["NetIncomeLoss"],
  researchAndDevelopment: ["ResearchAndDevelopmentExpense"],
} as const;

const parseMetric = (
  facts: Record<string, unknown>,
  concepts: readonly string[],
  cutoff: string,
): HistoricalMetric[] => {
  for (const concept of concepts) {
    const conceptRecord = optionalRecord(facts[concept]);
    const units = optionalRecord(conceptRecord?.units);
    if (units === null) continue;
    const output: HistoricalMetric[] = [];
    for (const [unit, entriesValue] of Object.entries(units)) {
      if (!Array.isArray(entriesValue)) continue;
      for (const entryValue of entriesValue) {
        const entry = optionalRecord(entryValue);
        const frame = optionalString(entry?.frame);
        const endDate = optionalString(entry?.end);
        const filedAt = optionalString(entry?.filed);
        const form = optionalString(entry?.form);
        const value = optionalNumber(entry?.val);
        if (
          frame === null ||
          !/^CY\d{4}Q[1-4]$/.test(frame) ||
          endDate === null ||
          filedAt === null ||
          // Company Facts exposes only a filing date, not an acceptance time.
          // Exclude the entire event date so current-quarter facts cannot leak.
          filedAt >= cutoff.slice(0, 10) ||
          form === null ||
          value === null
        ) {
          continue;
        }
        output.push({ period: frame, endDate, filedAt, value, unit, form });
      }
    }
    if (output.length > 0) {
      const byPeriod = new Map<string, HistoricalMetric>();
      for (const metric of output.sort((left, right) =>
        left.filedAt.localeCompare(right.filedAt),
      )) {
        byPeriod.set(metric.period, metric);
      }
      return [...byPeriod.values()]
        .sort((left, right) => left.period.localeCompare(right.period))
        .slice(-8);
    }
  }
  return [];
};

export const parseCompanyFacts = (
  body: string,
  cutoff: string,
): PreEventFundamentals => {
  const root = asRecord(JSON.parse(body) as unknown, "SEC company facts");
  const facts = asRecord(root.facts, "SEC facts");
  const usGaap = optionalRecord(facts["us-gaap"]) ?? {};
  return {
    revenue: parseMetric(usGaap, METRIC_CONCEPTS.revenue, cutoff),
    dilutedEps: parseMetric(usGaap, METRIC_CONCEPTS.dilutedEps, cutoff),
    netIncome: parseMetric(usGaap, METRIC_CONCEPTS.netIncome, cutoff),
    researchAndDevelopment: parseMetric(
      usGaap,
      METRIC_CONCEPTS.researchAndDevelopment,
      cutoff,
    ),
  };
};

export const fetchSecCompanyFacts = async (
  cik: number,
  cutoff: string,
): Promise<SecResult<PreEventFundamentals>> => {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
  const body = await fetchText(url, secHeaders());
  return {
    value: parseCompanyFacts(body, cutoff),
    body,
    source: buildSource(url, body),
  };
};

export const secFilingUrl = (cik: number, filing: SecFiling) => {
  const accession = filing.accessionNumber.replaceAll("-", "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${filing.primaryDocument}`;
};
