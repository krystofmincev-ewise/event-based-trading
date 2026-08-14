import type { SimulationResult } from "@event-lab/simulation";

import { formatCurrency, formatPercent, formatRatio } from "../lib/format.js";

export const Overview = ({ result }: { result: SimulationResult }) => {
  const { metrics, metadata } = result;
  const effectiveOpportunityRate = Number.isFinite(
    metadata.effectiveOpportunitiesPerWeek,
  )
    ? `${metadata.effectiveOpportunitiesPerWeek.toFixed(2)}/wk`
    : "—";
  return (
    <div className="overview-grid">
      <section className="result-table" aria-labelledby="return-title">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Terminal outcomes</span>
            <h2 id="return-title">Typical growth is not the mean</h2>
          </div>
          <span className="section-index">01</span>
        </div>
        <dl>
          <div>
            <dt>5th / 95th terminal</dt>
            <dd>
              {formatCurrency(metrics.terminalCapital.p05)} /{" "}
              {formatCurrency(metrics.terminalCapital.p95)}
            </dd>
          </div>
          <div>
            <dt>Median implied CAGR</dt>
            <dd>{formatPercent(metrics.impliedCagrFromMedianTerminal)}</dd>
          </div>
          <div>
            <dt>Expected-terminal implied CAGR</dt>
            <dd>{formatPercent(metrics.impliedCagrFromExpectedTerminal)}</dd>
          </div>
          <div>
            <dt>Probability of finishing below start</dt>
            <dd>{formatPercent(metrics.probabilityOfLoss)}</dd>
          </div>
        </dl>
      </section>
      <section className="result-table" aria-labelledby="risk-title">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Risk anatomy</span>
            <h2 id="risk-title">Compounding punishes oversizing</h2>
          </div>
          <span className="section-index">02</span>
        </div>
        <dl>
          <div>
            <dt>Severe drawdown probability</dt>
            <dd>{formatPercent(metrics.probabilityOfSevereDrawdown)}</dd>
          </div>
          <div>
            <dt>Annualized weekly volatility</dt>
            <dd>{formatPercent(metrics.annualized.annualizedVolatility)}</dd>
          </div>
          <div>
            <dt>Annualized pooled Sortino</dt>
            <dd>{formatRatio(metrics.annualized.sortino)}</dd>
          </div>
          <div>
            <dt>Simulated observations</dt>
            <dd>
              {metrics.annualized.sampleObservationCount.toLocaleString()}{" "}
              path-weeks
            </dd>
          </div>
          <div>
            <dt>No executable contract at end</dt>
            <dd>
              {formatPercent(metrics.probabilityOfZeroExecutablePositionAtEnd)}
            </dd>
          </div>
        </dl>
        <p className="metric-method-note">
          Sharpe, Sortino, and volatility pool simulated end-of-week path
          observations and annualize by √52. With regime stress enabled, this
          remains a simple annualization approximation rather than an IID claim.
        </p>
      </section>
      <aside className="run-tape" aria-label="Simulation metadata">
        <span>Run manifest</span>
        <dl>
          <div>
            <dt>Paths</dt>
            <dd>{metadata.pathCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Input provenance</dt>
            <dd>
              {result.input.researchScenarioManifest
                ? `${result.input.researchScenarioManifest.datasetVersion} · research-only synthetic terms`
                : "Custom inputs · quote provenance not verified"}
            </dd>
          </div>
          <div>
            <dt>Expected opportunities · realized p05–p95</dt>
            <dd>
              {metadata.expectedOpportunityCount.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}{" "}
              · {metadata.realizedOpportunityCount.p05.toFixed(0)}–
              {metadata.realizedOpportunityCount.p95.toFixed(0)}
            </dd>
          </div>
          <div>
            <dt>
              {result.input.opportunityArrival === "poisson"
                ? "Mean opportunities / week"
                : "Whole events / week"}
            </dt>
            <dd>
              {result.input.eventsPerWeek}/wk · realized{" "}
              {effectiveOpportunityRate}
            </dd>
          </div>
          <div>
            <dt>Latent probability mean · p05–p95</dt>
            <dd>
              {formatPercent(metadata.meanLatentWinProbability)} ·{" "}
              {formatPercent(metadata.latentWinProbability.p05)}–
              {formatPercent(metadata.latentWinProbability.p95)}
            </dd>
          </div>
          <div>
            <dt>Mean path-week probability</dt>
            <dd>{formatPercent(metadata.meanWeeklyWinProbability)}</dd>
          </div>
          <div>
            <dt>Initial contracts</dt>
            <dd>{metadata.initialWholeContractCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Initial deployed risk</dt>
            <dd>{formatPercent(metadata.initialExecutedFraction)}</dd>
          </div>
          <div>
            <dt>Eligible pre-stop attempts</dt>
            <dd>{metadata.eligiblePositionAttemptCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Mean executed risk / attempt</dt>
            <dd>
              {metadata.meanExecutedFractionPerEligibleAttempt === null
                ? "—"
                : formatPercent(
                    metadata.meanExecutedFractionPerEligibleAttempt,
                  )}
            </dd>
          </div>
          <div>
            <dt>Zero-contract rate / attempt</dt>
            <dd>
              {metadata.zeroContractRatePerEligibleAttempt === null
                ? "—"
                : formatPercent(metadata.zeroContractRatePerEligibleAttempt)}
            </dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd>{metadata.seed}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{metadata.simulationModel}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
};
