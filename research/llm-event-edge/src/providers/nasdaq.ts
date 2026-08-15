import type {
  DailyPrice,
  EarningsCandidate,
  SectorId,
  SourceReference,
} from "../domain.js";
import { fetchText, sha256 } from "../io.js";
import {
  asArray,
  asRecord,
  optionalNumber,
  optionalRecord,
  optionalString,
} from "../parse.js";

const NASDAQ_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 EventEdgeResearch/1.0",
};

export interface NasdaqCalendarRow {
  ticker: string;
  companyName: string;
  eventDate: string;
  marketCapUsd: number;
  consensusEps: number | null;
  estimateCount: number | null;
  actualEps: number | null;
  surprisePercent: number | null;
}

export interface NasdaqSecurity {
  ticker: string;
  companyName: string;
  marketCapUsd: number;
  country: string;
  sector: string;
  industry: string;
}

export interface NasdaqResult<Value> {
  value: Value;
  body: string;
  source: SourceReference;
}

const parseJson = (body: string, context: string): Record<string, unknown> =>
  asRecord(JSON.parse(body) as unknown, context);

const buildSource = (url: string, body: string): SourceReference => ({
  provider: "nasdaq",
  url,
  retrievedAt: new Date().toISOString(),
  sha256: sha256(body),
});

const parseCalendar = (body: string, date: string): NasdaqCalendarRow[] => {
  const root = parseJson(body, "Nasdaq calendar response");
  const data = optionalRecord(root.data);
  if (data === null) return [];
  const rows = data.rows;
  if (rows === null || rows === undefined) return [];
  return asArray(rows, "Nasdaq calendar rows").flatMap((rowValue) => {
    const row = optionalRecord(rowValue);
    if (row === null) return [];
    const ticker = optionalString(row.symbol)?.toUpperCase();
    const companyName = optionalString(row.name);
    const marketCapUsd = optionalNumber(row.marketCap);
    if (ticker === undefined || companyName === null || marketCapUsd === null) {
      return [];
    }
    return [
      {
        ticker,
        companyName,
        eventDate: date,
        marketCapUsd,
        consensusEps: optionalNumber(row.epsForecast),
        estimateCount: optionalNumber(row.noOfEsts),
        actualEps: optionalNumber(row.eps),
        surprisePercent: optionalNumber(row.surprise),
      },
    ];
  });
};

export const fetchNasdaqCalendar = async (
  date: string,
): Promise<NasdaqResult<NasdaqCalendarRow[]>> => {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;
  const body = await fetchText(url, NASDAQ_HEADERS);
  return {
    value: parseCalendar(body, date),
    body,
    source: buildSource(url, body),
  };
};

const parseScreener = (body: string): NasdaqSecurity[] => {
  const root = parseJson(body, "Nasdaq screener response");
  const data = asRecord(root.data, "Nasdaq screener data");
  const table = optionalRecord(data.table);
  const rows = table?.rows ?? data.rows;
  return asArray(rows, "Nasdaq screener rows").flatMap((rowValue) => {
    const row = optionalRecord(rowValue);
    if (row === null) return [];
    const ticker = optionalString(row.symbol)?.toUpperCase();
    const companyName = optionalString(row.name);
    const marketCapUsd = optionalNumber(row.marketCap);
    if (ticker === undefined || companyName === null || marketCapUsd === null) {
      return [];
    }
    return [
      {
        ticker,
        companyName,
        marketCapUsd,
        country: optionalString(row.country) ?? "",
        sector: optionalString(row.sector) ?? "",
        industry: optionalString(row.industry) ?? "",
      },
    ];
  });
};

export const fetchNasdaqScreener = async (): Promise<
  NasdaqResult<NasdaqSecurity[]>
> => {
  const url =
    "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true";
  const body = await fetchText(url, NASDAQ_HEADERS);
  return {
    value: parseScreener(body),
    body,
    source: buildSource(url, body),
  };
};

const parseNasdaqDate = (value: string): string => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match === null) throw new Error(`Unsupported Nasdaq date: ${value}`);
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
};

export const parsePrices = (body: string): DailyPrice[] => {
  const root = parseJson(body, "Nasdaq historical response");
  const data = optionalRecord(root.data);
  const table = data === null ? null : optionalRecord(data.tradesTable);
  const rows = table?.rows;
  if (!Array.isArray(rows)) return [];
  return rows
    .flatMap((rowValue) => {
      const row = optionalRecord(rowValue);
      if (row === null) return [];
      const date = optionalString(row.date);
      const close = optionalNumber(row.close);
      const open = optionalNumber(row.open);
      const high = optionalNumber(row.high);
      const low = optionalNumber(row.low);
      const volume = optionalNumber(row.volume);
      if (
        date === null ||
        close === null ||
        open === null ||
        high === null ||
        low === null ||
        volume === null
      ) {
        return [];
      }
      return [
        {
          date: parseNasdaqDate(date),
          close,
          open,
          high,
          low,
          volume,
        },
      ];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
};

export const fetchNasdaqPrices = async (
  symbol: string,
  assetClass: "stocks" | "etf",
  fromDate: string,
  toDate: string,
): Promise<NasdaqResult<DailyPrice[]>> => {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=${assetClass}&fromdate=${fromDate}&todate=${toDate}&limit=5000`;
  const body = await fetchText(url, NASDAQ_HEADERS);
  return {
    value: parsePrices(body),
    body,
    source: buildSource(url, body),
  };
};

const SECTOR_MAP: Record<string, SectorId> = {
  "Basic Materials": "materials",
  "Consumer Discretionary": "consumer-discretionary",
  "Consumer Staples": "consumer-staples",
  Energy: "energy",
  Finance: "financials",
  "Health Care": "health-care",
  Industrials: "industrials",
  "Real Estate": "real-estate",
  Technology: "information-technology",
  Telecommunications: "communication-services",
  Utilities: "utilities",
};

const PHARMA_PATTERN =
  /biotech|biotechnology|pharma|pharmaceutical|medicinal|drug manufacturer/i;

export const sectorIdsForSecurity = (
  sector: string,
  industry: string,
): SectorId[] => {
  const primary = SECTOR_MAP[sector];
  if (primary === undefined) return [];
  return primary === "health-care" && PHARMA_PATTERN.test(industry)
    ? [primary, "pharma-biotech"]
    : [primary];
};

export const capitalizationId = (
  marketCapUsd: number,
): EarningsCandidate["capitalizationId"] => {
  if (marketCapUsd < 8_000_000_000) return "small";
  if (marketCapUsd < 22_700_000_000) return "mid";
  return "large";
};
