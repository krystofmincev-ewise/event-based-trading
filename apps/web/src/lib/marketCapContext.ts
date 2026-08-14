export interface MarketCapContextItem {
  id: "small" | "mid" | "large";
  label: string;
  eligibilityRange: string;
  proxy: string;
  threeYearStandardDeviation: number;
  volatilitySourceUrl: string;
}

export const MARKET_CAP_CONTEXT: readonly MarketCapContextItem[] = [
  {
    id: "small",
    label: "US small cap",
    eligibilityRange: "$1.2B–$8.0B",
    proxy: "IJR · S&P SmallCap 600",
    threeYearStandardDeviation: 0.1942,
    volatilitySourceUrl:
      "https://www.ishares.com/us/literature/fact-sheet/ijr-ishares-core-s-p-small-cap-etf-fund-fact-sheet-en-us.pdf",
  },
  {
    id: "mid",
    label: "US mid cap",
    eligibilityRange: "$8.0B–$22.7B",
    proxy: "IJH · S&P MidCap 400",
    threeYearStandardDeviation: 0.1585,
    volatilitySourceUrl:
      "https://www.ishares.com/us/literature/fact-sheet/ijh-ishares-core-s-p-mid-cap-etf-fund-fact-sheet-en-us.pdf",
  },
  {
    id: "large",
    label: "US large cap",
    eligibilityRange: "$22.7B+",
    proxy: "IVV · S&P 500",
    threeYearStandardDeviation: 0.1305,
    volatilitySourceUrl:
      "https://www.ishares.com/us/literature/fact-sheet/ivv-ishares-core-s-p-500-etf-fund-fact-sheet-en-us.pdf",
  },
] as const;
