import type { EventCase, ForecastPacket, SectorId } from "./domain.js";
import { secFilingUrl } from "./providers/sec.js";

export const buildForecastPacket = (
  eventCase: EventCase,
  sectorId: SectorId,
): ForecastPacket => {
  const filingDateCutoff = eventCase.informationCutoff.slice(0, 10);
  const filedBeforeCutoff = (filing: { filedAt: string }) =>
    filing.filedAt < filingDateCutoff;
  const priorFilings = eventCase.priorFilings.filter(
    ({ acceptedAt }) => acceptedAt < eventCase.informationCutoff,
  );

  return {
    caseId: eventCase.id,
    studyId: eventCase.studyId,
    ticker: eventCase.ticker,
    companyName: eventCase.companyName,
    sectorId,
    industry: eventCase.industry,
    eventType: eventCase.eventType,
    eventDate: eventCase.eventDate,
    eventSession: eventCase.eventSession,
    informationCutoff: eventCase.informationCutoff,
    // Historical Nasdaq consensus snapshots were retrieved after these events.
    consensusEps: null,
    estimateCount: null,
    fundamentals: {
      revenue: eventCase.fundamentals.revenue.filter(filedBeforeCutoff),
      dilutedEps: eventCase.fundamentals.dilutedEps.filter(filedBeforeCutoff),
      netIncome: eventCase.fundamentals.netIncome.filter(filedBeforeCutoff),
      researchAndDevelopment:
        eventCase.fundamentals.researchAndDevelopment.filter(filedBeforeCutoff),
    },
    marketFeatures: eventCase.marketFeatures,
    priorFilings,
    sourceUrls: priorFilings.map((filing) =>
      secFilingUrl(eventCase.cik, filing),
    ),
    leakageNotice:
      "Outcome, actual EPS, surprise, post-cutoff documents, and post-retrieved consensus fields are omitted.",
  };
};
