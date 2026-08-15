import { asArray, asRecord, asString } from "./parse.js";

const READOUT_KINDS = ["final-efficacy", "early-proof-of-concept"] as const;
const ENDPOINT_OUTCOMES = ["yes", "no", "ambiguous"] as const;
const ELIGIBILITY = ["eligible", "ineligible", "needs-adjudication"] as const;

export interface ClinicalTrialSeed {
  id: string;
  eventDate: string;
  ticker: string;
  program: string;
  phase: string;
  nctIds: string[];
  readoutKind: (typeof READOUT_KINDS)[number];
  sponsorReportedPrimaryEndpointMet: (typeof ENDPOINT_OUTCOMES)[number];
  postHocPositiveOnly: boolean;
  sourceUrls: string[];
  confirmatoryEligibility: (typeof ELIGIBILITY)[number];
}

const oneOf = <Value extends string>(
  value: unknown,
  values: readonly Value[],
  context: string,
): Value => {
  const candidate = asString(value, context);
  if (!values.some((allowed) => allowed === candidate)) {
    throw new Error(`${context} is unsupported: ${candidate}`);
  }
  return candidate as Value;
};

const stringArray = (value: unknown, context: string): string[] =>
  asArray(value, context).map((entry) => asString(entry, context));

const parseSeed = (value: unknown): ClinicalTrialSeed => {
  const row = asRecord(value, "Clinical seed");
  const eventDate = asString(row.eventDate, "eventDate");
  if (
    !/^2026-\d{2}-\d{2}$/.test(eventDate) ||
    eventDate < "2026-02-17" ||
    eventDate > "2026-08-14"
  ) {
    throw new Error(`eventDate is outside the locked window: ${eventDate}`);
  }
  const ticker = asString(row.ticker, "ticker");
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
    throw new Error(`ticker is invalid: ${ticker}`);
  }
  const nctIds = stringArray(row.nctIds, "nctIds");
  if (nctIds.some((nctId) => !/^NCT\d{8}$/.test(nctId))) {
    throw new Error(`Invalid NCT identifier for ${ticker}.`);
  }
  const sourceUrls = stringArray(row.sourceUrls, "sourceUrls");
  if (
    sourceUrls.length === 0 ||
    sourceUrls.some(
      (url) =>
        !url.startsWith("https://www.sec.gov/Archives/edgar/data/") ||
        URL.canParse(url) === false,
    )
  ) {
    throw new Error(`Every seed needs a valid SEC exhibit URL: ${ticker}.`);
  }
  if (typeof row.postHocPositiveOnly !== "boolean") {
    throw new Error(`postHocPositiveOnly must be boolean: ${ticker}.`);
  }
  return {
    id: asString(row.id, "id"),
    eventDate,
    ticker,
    program: asString(row.program, "program"),
    phase: asString(row.phase, "phase"),
    nctIds,
    readoutKind: oneOf(row.readoutKind, READOUT_KINDS, "readoutKind"),
    sponsorReportedPrimaryEndpointMet: oneOf(
      row.sponsorReportedPrimaryEndpointMet,
      ENDPOINT_OUTCOMES,
      "sponsorReportedPrimaryEndpointMet",
    ),
    postHocPositiveOnly: row.postHocPositiveOnly,
    sourceUrls,
    confirmatoryEligibility: oneOf(
      row.confirmatoryEligibility,
      ELIGIBILITY,
      "confirmatoryEligibility",
    ),
  };
};

export const parseClinicalTrialSeeds = (
  value: unknown,
): ClinicalTrialSeed[] => {
  const seeds = asArray(value, "Clinical seed collection").map(parseSeed);
  const ids = new Set(seeds.map(({ id }) => id));
  if (ids.size !== seeds.length) {
    throw new Error("Clinical seed IDs must be unique.");
  }
  return seeds;
};
