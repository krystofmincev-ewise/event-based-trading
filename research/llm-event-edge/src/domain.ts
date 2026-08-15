export const SECTOR_IDS = [
  "communication-services",
  "consumer-discretionary",
  "consumer-staples",
  "energy",
  "financials",
  "health-care",
  "industrials",
  "information-technology",
  "materials",
  "real-estate",
  "utilities",
  "pharma-biotech",
] as const;

export type SectorId = (typeof SECTOR_IDS)[number];
export type CapitalizationId = "small" | "mid" | "large";
export type EventSession = "before-market" | "after-market";

export interface StudyConfig {
  studyId: string;
  startDate: string;
  endDate: string;
  outcomeObservationDate: string;
  targetCasesPerSector: number;
  minimumMarketCapUsd: number;
  maximumCandidatesPerSector: number;
  benchmarkSymbol: string;
  model: string;
  reasoningEffort: string;
  analystReplicates: number;
  forecastBatchSize: number;
  maximumConcurrentModelCalls: number;
}

export interface SourceReference {
  provider: "nasdaq" | "sec";
  url: string;
  retrievedAt: string;
  sha256: string;
}

export interface EarningsCandidate {
  ticker: string;
  companyName: string;
  eventDate: string;
  marketCapUsd: number;
  capitalizationId: CapitalizationId;
  nasdaqSector: string;
  industry: string;
  sectorIds: SectorId[];
  consensusEps: number | null;
  estimateCount: number | null;
  actualEps: number | null;
  surprisePercent: number | null;
  cik: number;
  calendarSource: SourceReference;
}

export interface SecFiling {
  accessionNumber: string;
  acceptedAt: string;
  filingDate: string;
  form: string;
  items: string;
  primaryDocument: string;
}

export interface DailyPrice {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface HistoricalMetric {
  period: string;
  endDate: string;
  filedAt: string;
  value: number;
  unit: string;
  form: string;
}

export interface PreEventFundamentals {
  revenue: HistoricalMetric[];
  dilutedEps: HistoricalMetric[];
  netIncome: HistoricalMetric[];
  researchAndDevelopment: HistoricalMetric[];
}

export interface PreEventMarketFeatures {
  entryDate: string;
  entryClose: number;
  trailingReturn5d: number | null;
  trailingReturn20d: number | null;
  trailingReturn60d: number | null;
  realizedVolatility20d: number | null;
  realizedVolatility60d: number | null;
  drawdownFrom60dHigh: number | null;
  benchmarkTrailingReturn20d: number | null;
}

export interface EventOutcome {
  settlement1dDate: string;
  settlement1dClose: number;
  return1d: number;
  benchmarkReturn1d: number;
  marketAdjustedReturn1d: number;
  settlement10dDate: string | null;
  settlement10dClose: number | null;
  return10d: number | null;
  benchmarkReturn10d: number | null;
  marketAdjustedReturn10d: number | null;
  settlement40dDate: string | null;
  settlement40dClose: number | null;
  return40d: number | null;
  benchmarkReturn40d: number | null;
  marketAdjustedReturn40d: number | null;
}

export interface EventCase {
  id: string;
  studyId: string;
  ticker: string;
  companyName: string;
  cik: number;
  marketCapUsd: number;
  capitalizationId: CapitalizationId;
  nasdaqSector: string;
  industry: string;
  sectorIds: SectorId[];
  eventType: "earnings";
  eventDate: string;
  acceptedAt: string;
  eventSession: EventSession;
  informationCutoff: string;
  filing: SecFiling;
  consensusEps: number | null;
  estimateCount: number | null;
  actualEps: number | null;
  surprisePercent: number | null;
  fundamentals: PreEventFundamentals;
  priorFilings: SecFiling[];
  marketFeatures: PreEventMarketFeatures;
  outcome: EventOutcome;
  sources: SourceReference[];
  outcomeSources: SourceReference[];
  retrospectiveQuality: "reconstructed-point-in-time";
}

export interface ForecastPacket {
  caseId: string;
  studyId: string;
  ticker: string;
  companyName: string;
  sectorId: SectorId;
  industry: string;
  eventType: "earnings";
  eventDate: string;
  eventSession: EventSession;
  informationCutoff: string;
  consensusEps: number | null;
  estimateCount: number | null;
  fundamentals: PreEventFundamentals;
  marketFeatures: PreEventMarketFeatures;
  priorFilings: SecFiling[];
  sourceUrls: string[];
  leakageNotice: string;
}

export interface EventForecast {
  caseId: string;
  probabilityUp1d: number;
  probabilityUp10d: number;
  probabilityAbsolute2Percent1d: number;
  probabilityAbsolute5Percent1d: number;
  probabilityAbsolute5Percent10d: number;
  probabilityUp40d: number;
  probabilityAbsolute10Percent40d: number;
  expectedReturn1d: number;
  expectedReturn10d: number;
  expectedReturn40d: number;
  confidence: "low" | "medium" | "high";
  abstain: boolean;
  thesis: string;
  disconfirmingEvidence: string;
}

export interface ForecastBatch {
  forecasts: EventForecast[];
}

export interface LockedForecast extends EventForecast {
  studyId: string;
  sectorId: SectorId;
  model: string;
  reasoningEffort: string;
  graphNode: "synthesis";
  generatedAt: string;
  informationPolicy: "packet-only-no-web";
}
