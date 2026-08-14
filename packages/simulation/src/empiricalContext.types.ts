export type EmpiricalProfileId =
  | "communication-services"
  | "consumer-discretionary"
  | "consumer-staples"
  | "energy"
  | "financials"
  | "health-care"
  | "industrials"
  | "information-technology"
  | "materials"
  | "real-estate"
  | "utilities"
  | "pharma-biotech";

export type CapitalizationProfileId = "small" | "mid" | "large";
export type ScenarioHorizon = 1 | 10;
export type ScenarioDirection = "up" | "down" | "absolute";
export type ScenarioThreshold = 0 | 0.02 | 0.05 | 0.1;

export interface DirectionalThresholdRate {
  readonly up: number;
  readonly down: number;
  readonly absolute: number;
}

export interface EmpiricalReturnSummary {
  readonly sampleSize: number;
  readonly upProbability: number;
  readonly downProbability: number;
  readonly tieProbability: number;
  readonly meanReturn: number;
  readonly standardDeviation: number;
  readonly medianReturn: number;
  readonly medianAbsoluteReturn: number;
  readonly p90AbsoluteReturn: number;
  readonly p95AbsoluteReturn: number;
  readonly thresholdRates: Readonly<
    Record<"2" | "5" | "10", DirectionalThresholdRate>
  >;
}

export interface EmpiricalProfile {
  readonly id: EmpiricalProfileId;
  readonly label: string;
  readonly proxyPortfolio: string;
  readonly proxySystem: "Fama-French 12 Industry" | "Fama-French 49 Industry";
  readonly mappingQuality:
    | "closest-sic-proxy"
    | "partial-sic-proxy"
    | "industry-overlay";
  readonly horizons: Readonly<Record<"1" | "10", EmpiricalReturnSummary>>;
}

export interface CapitalizationProfile {
  readonly id: CapitalizationProfileId;
  readonly label: string;
  readonly proxyPortfolio: "Lo 30" | "Med 40" | "Hi 30";
  readonly horizons: Readonly<Record<"1" | "10", EmpiricalReturnSummary>>;
}

export interface EmpiricalContextDataset {
  readonly version: string;
  readonly generatedAt: string;
  readonly sampleStart: string;
  readonly sampleEnd: string;
  readonly returnType: "value-weighted daily portfolio total return";
  readonly tenDayMethod: "overlapping compounded 10-trading-day return";
  readonly sectorTaxonomy: "Fama-French SIC portfolios mapped approximately to GICS labels";
  readonly source: {
    readonly label: string;
    readonly url: string;
    readonly industry12Url: string;
    readonly industry49Url: string;
    readonly sizeUrl: string;
    readonly retrievalDate: string;
    readonly databaseVintage: string;
    readonly sha256: {
      readonly industry12: string;
      readonly industry49: string;
      readonly size: string;
    };
  };
  readonly profiles: readonly EmpiricalProfile[];
  readonly capitalizationProfiles: readonly CapitalizationProfile[];
}
