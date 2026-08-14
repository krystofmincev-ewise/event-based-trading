import { EMPIRICAL_CONTEXT_DATASET } from "./empiricalContext.generated.js";
import type {
  CapitalizationProfile,
  CapitalizationProfileId,
  EmpiricalProfile,
  EmpiricalProfileId,
  EmpiricalReturnSummary,
  ScenarioDirection,
  ScenarioHorizon,
  ScenarioThreshold,
} from "./empiricalContext.types.js";
import type { SimulationInput } from "./types.js";

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export const EMPIRICAL_CONTEXT = deepFreeze(EMPIRICAL_CONTEXT_DATASET);

export interface EmpiricalScenarioSelection {
  profileId: EmpiricalProfileId;
  capitalizationId: CapitalizationProfileId;
  horizon: ScenarioHorizon;
  direction: ScenarioDirection;
  threshold: ScenarioThreshold;
  companyMoveMultiplier: number;
  modelProbabilityLift: number;
}

export interface EvidenceSource {
  readonly id: string;
  readonly tier: "unconditional-context" | "event-literature" | "product-terms";
  readonly label: string;
  readonly detail: string;
  readonly url: string;
  readonly applicableProfiles?: readonly EmpiricalProfileId[];
}

export interface SyntheticTermsProvenance {
  readonly kind: "synthetic-context";
  readonly executable: false;
  readonly quoteTimestamp: null;
  readonly bidAskAvailable: false;
  readonly depthAvailable: false;
  readonly feeScope: "XSPBX customer single-side reference";
}

export interface ResolvedEmpiricalScenario {
  readonly selection: EmpiricalScenarioSelection;
  readonly profile: EmpiricalProfile;
  readonly capitalization: CapitalizationProfile;
  readonly context: EmpiricalReturnSummary;
  readonly capitalizationContext: EmpiricalReturnSummary;
  readonly capitalizationVolatilityMultiplier: number;
  readonly effectiveMoveMultiplier: number;
  readonly effectiveThreshold: number;
  readonly interpolationStatus:
    | "jeffreys-smoothed-knot"
    | "log-interpolated-smoothed";
  readonly rawObservedFrequency: number | null;
  readonly unconditionalContextFrequency: number;
  readonly scenarioProbability: number;
  readonly syntheticProbabilityScaledPrice: number;
  readonly referenceVenueFee: number;
  readonly slippageStressAllowance: number;
  readonly modeledBreakEvenProbability: number;
  readonly scenarioProbabilityMinusModeledBreakEven: number;
  readonly termsProvenance: SyntheticTermsProvenance;
  readonly sizingEligibility: "research-only";
  readonly simulationPatch: Readonly<Partial<SimulationInput>>;
  readonly sources: readonly EvidenceSource[];
  readonly warnings: readonly string[];
}

export type EmpiricalScenarioValidationResult =
  | { success: true; data: EmpiricalScenarioSelection }
  | { success: false; errors: string[] };

export const DEFAULT_EMPIRICAL_SCENARIO: EmpiricalScenarioSelection = {
  profileId: "information-technology",
  capitalizationId: "large",
  horizon: 1,
  direction: "up",
  threshold: 0,
  companyMoveMultiplier: 1,
  modelProbabilityLift: 0,
};

const sourceLinks: EvidenceSource[] = [
  {
    id: "fama-french",
    tier: "unconditional-context",
    label: "Fama–French public portfolio returns",
    detail:
      "Value-weighted daily SIC-industry and NYSE-size portfolio returns, summarized locally from 2000 through 2025.",
    url: EMPIRICAL_CONTEXT_DATASET.source.url,
  },
  {
    id: "sp-cap-bands",
    tier: "unconditional-context",
    label: "S&P U.S. index capitalization guidelines",
    detail:
      "Current descriptive labels: small $1.2B–$8.0B, mid $8.0B–$22.7B, large at least $22.7B; these are not the Fama–French portfolio breakpoints.",
    url: "https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf",
  },
  {
    id: "cboe-binary",
    tier: "product-terms",
    label: "Cboe XSP binary specifications",
    detail:
      "A currently listed index binary settles at $100 or $0. It is an index product, not a single-stock earnings contract.",
    url: "https://www.cboe.com/markets/prediction-markets/",
  },
  {
    id: "cboe-binary-fees",
    tier: "product-terms",
    label: "Cboe XSP binary customer fee schedule",
    detail:
      "Illustrative single-side Customer-capacity XSPBX transaction fees range from $0.04 to $0.30 per contract by premium band, effective June 15, 2026. Broker and account-specific charges are excluded.",
    url: "https://cdn.cboe.com/resources/regulation/rule_filings/approved/2026/SR-CBOE-2026-056.pdf",
  },
];

const eventEvidenceSources: EvidenceSource[] = [
  {
    id: "earnings-timing",
    tier: "event-literature",
    label: "Earnings announcement timing evidence",
    detail:
      "A 1998–2022 study contains 259,664 firm-quarters and shows that event timestamp alignment is material; it does not provide a sector-threshold grid.",
    url: "https://link.springer.com/article/10.1007/s11142-026-09959-y",
  },
  {
    id: "biopharma-news",
    tier: "event-literature",
    label: "Biopharma news stress evidence",
    detail:
      "503,107 releases from 1,012 companies: event-day abnormal returns for selected categories reached approximately +6% and −13%. These are selected category estimates—not raw returns, typical effects, probabilities, or 10-day outcomes. The study used licensed RavenPack and CRSP inputs.",
    url: "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0296927",
    applicableProfiles: ["pharma-biotech"],
  },
  {
    id: "clinical-trials",
    tier: "event-literature",
    label: "Clinical-trial event study",
    detail:
      "13,807 trials across 379 U.S. public companies; early biotech reacted more than large pharma, but observed features explained little of the dispersion.",
    url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272851",
    applicableProfiles: ["pharma-biotech"],
  },
];

export const EVENT_EVIDENCE_SOURCES = deepFreeze(eventEvidenceSources);

const getProfile = (id: EmpiricalProfileId): EmpiricalProfile => {
  const profile = EMPIRICAL_CONTEXT_DATASET.profiles.find(
    (candidate) => candidate.id === id,
  );
  if (!profile) throw new Error(`Unknown empirical profile: ${id}`);
  return profile;
};

const getCapitalization = (
  id: CapitalizationProfileId,
): CapitalizationProfile => {
  const profile = EMPIRICAL_CONTEXT_DATASET.capitalizationProfiles.find(
    (candidate) => candidate.id === id,
  );
  if (!profile) throw new Error(`Unknown capitalization profile: ${id}`);
  return profile;
};

export const capitalizationVolatilityMultiplierFor = (
  capitalizationId: CapitalizationProfileId,
  horizon: ScenarioHorizon,
): number => {
  const horizonKey = String(horizon) as "1" | "10";
  return (
    getCapitalization(capitalizationId).horizons[horizonKey].standardDeviation /
    getCapitalization("large").horizons[horizonKey].standardDeviation
  );
};

export const effectiveThresholdFor = (
  capitalizationId: CapitalizationProfileId,
  horizon: ScenarioHorizon,
  threshold: ScenarioThreshold,
  companyMoveMultiplier: number,
): number =>
  threshold === 0
    ? 0
    : threshold /
      (capitalizationVolatilityMultiplierFor(capitalizationId, horizon) *
        companyMoveMultiplier);

export const minimumSupportedCompanyMoveMultiplier = (
  capitalizationId: CapitalizationProfileId,
  horizon: ScenarioHorizon,
  threshold: ScenarioThreshold,
): number =>
  threshold === 0
    ? 0
    : threshold /
      (0.1 * capitalizationVolatilityMultiplierFor(capitalizationId, horizon));

const thresholdProbability = (
  summary: EmpiricalReturnSummary,
  direction: ScenarioDirection,
  threshold: number,
): number => {
  if (threshold > 0.1 + Number.EPSILON) {
    throw new RangeError(
      "The size-adjusted threshold exceeds the catalog's observed 10% tail boundary.",
    );
  }
  const rawZeroProbability =
    direction === "up"
      ? summary.upProbability
      : direction === "down"
        ? summary.downProbability
        : 1 - summary.tieProbability;
  const jeffreysSmooth = (rawRate: number) =>
    (rawRate * summary.sampleSize + 0.5) / (summary.sampleSize + 1);
  const zeroProbability = jeffreysSmooth(rawZeroProbability);
  if (threshold <= 0) return zeroProbability;
  const valueAt = (key: "2" | "5" | "10") =>
    jeffreysSmooth(summary.thresholdRates[key][direction]);
  const knots: Array<[number, number]> = [
    [0, zeroProbability],
    [0.02, valueAt("2")],
    [0.05, valueAt("5")],
    [0.1, valueAt("10")],
  ];
  const interpolateLog = (
    left: [number, number],
    right: [number, number],
    value: number,
  ) => {
    const weight = (value - left[0]) / (right[0] - left[0]);
    return Math.exp(
      Math.log(left[1]) * (1 - weight) + Math.log(right[1]) * weight,
    );
  };
  for (let index = 1; index < knots.length; index += 1) {
    if (threshold <= knots[index]![0]) {
      return interpolateLog(knots[index - 1]!, knots[index]!, threshold);
    }
  }
  return interpolateLog(knots.at(-2)!, knots.at(-1)!, threshold);
};

const rawObservedFrequency = (
  summary: EmpiricalReturnSummary,
  direction: ScenarioDirection,
  threshold: number,
): number | null => {
  if (threshold === 0) {
    return direction === "up"
      ? summary.upProbability
      : direction === "down"
        ? summary.downProbability
        : 1 - summary.tieProbability;
  }
  if (threshold === 0.02 || threshold === 0.05 || threshold === 0.1) {
    const key = String(threshold * 100) as "2" | "5" | "10";
    return summary.thresholdRates[key][direction];
  }
  return null;
};

const cboeReferenceFee = (dollarPremium: number): number => {
  const premium = dollarPremium / 100;
  if (premium < 0.04 || premium > 0.96) return 0.04;
  if (premium <= 0.09 || premium >= 0.91) return 0.08;
  if (premium <= 0.24 || premium >= 0.76) return 0.2;
  return 0.3;
};

const clampProbability = (value: number) =>
  Math.min(0.999, Math.max(0.001, value));

export const resolveEmpiricalScenario = (
  selection: EmpiricalScenarioSelection,
): ResolvedEmpiricalScenario => {
  const profile = getProfile(selection.profileId);
  const capitalization = getCapitalization(selection.capitalizationId);
  const horizonKey = String(selection.horizon) as "1" | "10";
  const context = profile.horizons[horizonKey];
  const capitalizationContext = capitalization.horizons[horizonKey];
  const capitalizationVolatilityMultiplier =
    capitalizationVolatilityMultiplierFor(
      selection.capitalizationId,
      selection.horizon,
    );
  const effectiveMoveMultiplier =
    capitalizationVolatilityMultiplier * selection.companyMoveMultiplier;
  const effectiveThreshold = effectiveThresholdFor(
    selection.capitalizationId,
    selection.horizon,
    selection.threshold,
    selection.companyMoveMultiplier,
  );
  const unconditionalContextFrequency = thresholdProbability(
    context,
    selection.direction,
    effectiveThreshold,
  );
  const rawFrequency = rawObservedFrequency(
    context,
    selection.direction,
    effectiveThreshold,
  );
  const scenarioProbability = clampProbability(
    unconditionalContextFrequency + selection.modelProbabilityLift,
  );
  const syntheticProbabilityScaledPrice = unconditionalContextFrequency * 100;
  const referenceVenueFee = cboeReferenceFee(syntheticProbabilityScaledPrice);
  const slippageStressAllowance = 0.5;
  const totalReferenceCost = referenceVenueFee + slippageStressAllowance;
  const modeledBreakEvenProbability =
    (syntheticProbabilityScaledPrice + totalReferenceCost) / 100;
  const scenarioProbabilityMinusModeledBreakEven =
    scenarioProbability - modeledBreakEvenProbability;
  const interpolationStatus =
    rawFrequency === null
      ? "log-interpolated-smoothed"
      : "jeffreys-smoothed-knot";
  const applicableEventSources = EVENT_EVIDENCE_SOURCES.filter(
    (source) =>
      source.applicableProfiles === undefined ||
      source.applicableProfiles.includes(selection.profileId),
  );

  return deepFreeze({
    selection: { ...selection },
    profile,
    capitalization,
    context,
    capitalizationContext,
    capitalizationVolatilityMultiplier,
    effectiveMoveMultiplier,
    effectiveThreshold,
    interpolationStatus,
    rawObservedFrequency: rawFrequency,
    unconditionalContextFrequency,
    scenarioProbability,
    syntheticProbabilityScaledPrice,
    referenceVenueFee,
    slippageStressAllowance,
    modeledBreakEvenProbability,
    scenarioProbabilityMinusModeledBreakEven,
    termsProvenance: {
      kind: "synthetic-context",
      executable: false,
      quoteTimestamp: null,
      bidAskAvailable: false,
      depthAvailable: false,
      feeScope: "XSPBX customer single-side reference",
    },
    sizingEligibility: "research-only",
    simulationPatch: {
      winProbability: scenarioProbability,
      probabilityHaircut: 0.02,
      contractPurchasePrice: syntheticProbabilityScaledPrice,
      settlementPayout: 100,
      roundTripCosts: totalReferenceCost,
      eventsPerWeek: selection.horizon === 10 ? 0.5 : 2,
      opportunityArrival: "poisson",
      calibrationUncertaintyEnabled: true,
      calibrationEffectiveSampleSize: 100,
      weeklyProbabilityLogitStdDev: 0.15,
      executionCostCoefficientVariation: 0.35,
      researchScenarioManifest: {
        kind: "empirical-research-proxy",
        datasetVersion: EMPIRICAL_CONTEXT.version,
        profileId: selection.profileId,
        capitalizationId: selection.capitalizationId,
        horizonTradingDays: selection.horizon,
        direction: selection.direction,
        threshold: selection.threshold,
        companyMoveMultiplier: selection.companyMoveMultiplier,
        modelProbabilityLift: selection.modelProbabilityLift,
        termsExecutable: false,
        sizingEligibility: "research-only",
      },
    },
    sources: [...sourceLinks, ...applicableEventSources],
    warnings: [
      "This is unconditional diversified-portfolio context, not an earnings-event base rate or a single-company return forecast.",
      "Exact catalog knots use Jeffreys smoothing (count + 0.5)/(N + 1) while preserving the raw observed rate; in-between thresholds use disclosed log interpolation.",
      "The sector labels are approximate mappings from public Fama–French SIC portfolios, not licensed point-in-time GICS classifications.",
      "The capitalization adjustment assumes the distribution keeps its shape while scale changes with public size-portfolio volatility; it is not an observed joint sector-by-size cell.",
      "The probability-scaled contract price is synthetic and research-only. Replace it with a timestamped executable ask, exact payout, fees, and depth before sizing a candidate.",
      "The default model lift is zero because no out-of-sample LLM calibration evidence has been supplied.",
      "The Cboe fee is an illustrative single-side Customer-capacity XSPBX reference; broker and account-specific charges are excluded.",
      "The $0.50 slippage allowance and stochastic stress settings are transparent policy assumptions, not measured sector-specific execution costs.",
      "The simulator treats opportunities as sequential and resolved before capital is reused; the 10-day default reduces expected throughput to 0.5 per week but does not model concurrent open positions.",
    ],
  });
};

export const validateEmpiricalScenarioSelection = (
  value: unknown,
): EmpiricalScenarioValidationResult => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false, errors: ["Request body must be an object."] };
  }
  const source = value as Record<string, unknown>;
  const errors: string[] = [];
  const profileIds = new Set(
    EMPIRICAL_CONTEXT_DATASET.profiles.map((profile) => profile.id),
  );
  const capitalizationIds = new Set(
    EMPIRICAL_CONTEXT_DATASET.capitalizationProfiles.map(
      (profile) => profile.id,
    ),
  );
  if (
    typeof source.profileId !== "string" ||
    !profileIds.has(source.profileId as EmpiricalProfileId)
  ) {
    errors.push("profileId must identify a published empirical profile.");
  }
  if (
    typeof source.capitalizationId !== "string" ||
    !capitalizationIds.has(source.capitalizationId as CapitalizationProfileId)
  ) {
    errors.push("capitalizationId must be small, mid, or large.");
  }
  if (source.horizon !== 1 && source.horizon !== 10) {
    errors.push("horizon must be 1 or 10 trading days.");
  }
  if (
    source.direction !== "up" &&
    source.direction !== "down" &&
    source.direction !== "absolute"
  ) {
    errors.push("direction must be up, down, or absolute.");
  }
  if (
    source.threshold !== 0 &&
    source.threshold !== 0.02 &&
    source.threshold !== 0.05 &&
    source.threshold !== 0.1
  ) {
    errors.push("threshold must be 0, 0.02, 0.05, or 0.1.");
  }
  if (source.direction === "absolute" && source.threshold === 0) {
    errors.push("absolute direction requires a positive threshold.");
  }
  if (
    typeof source.companyMoveMultiplier !== "number" ||
    !Number.isFinite(source.companyMoveMultiplier) ||
    source.companyMoveMultiplier < 0.25 ||
    source.companyMoveMultiplier > 5
  ) {
    errors.push("companyMoveMultiplier must be in [0.25, 5].");
  }
  if (
    typeof source.modelProbabilityLift !== "number" ||
    !Number.isFinite(source.modelProbabilityLift) ||
    source.modelProbabilityLift < -0.5 ||
    source.modelProbabilityLift > 0.5
  ) {
    errors.push("modelProbabilityLift must be in [-0.5, 0.5].");
  }
  if (errors.length === 0 && source.threshold !== 0) {
    const effectiveThreshold = effectiveThresholdFor(
      source.capitalizationId as CapitalizationProfileId,
      source.horizon as ScenarioHorizon,
      source.threshold as ScenarioThreshold,
      source.companyMoveMultiplier as number,
    );
    if (effectiveThreshold > 0.1 + Number.EPSILON) {
      errors.push(
        "The size-adjusted threshold exceeds the catalog's observed 10% tail boundary; increase companyMoveMultiplier or choose a lower threshold.",
      );
    }
  }
  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      profileId: source.profileId as EmpiricalProfileId,
      capitalizationId: source.capitalizationId as CapitalizationProfileId,
      horizon: source.horizon as ScenarioHorizon,
      direction: source.direction as ScenarioDirection,
      threshold: source.threshold as ScenarioThreshold,
      companyMoveMultiplier: source.companyMoveMultiplier as number,
      modelProbabilityLift: source.modelProbabilityLift as number,
    },
  };
};

export type * from "./empiricalContext.types.js";
