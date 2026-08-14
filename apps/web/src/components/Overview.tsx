import type { SimulationResult } from "@event-lab/simulation";

import { formatCurrency, formatPercent, formatRatio } from "../lib/format.js";

export const Overview = ({ result }: { result: SimulationResult }) => {
  const { metrics, metadata } = result;
  const effectiveTradeRate = Number.isFinite(metadata.effectiveTradesPerWeek)
    ? `${metadata.effectiveTradesPerWeek.toFixed(2)}/wk`
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
        </dl>
        <p className="metric-method-note">
          Sharpe, Sortino, and volatility pool simulated end-of-week path
          observations and annualize by √52. IID scaling assumes no serial
          correlation.
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
            <dt>Trades</dt>
            <dd>
              {metadata.tradeCount.toLocaleString()} · {effectiveTradeRate}
            </dd>
          </div>
          <div>
            <dt>Requested rate</dt>
            <dd>{result.input.tradesPerWeek.toFixed(2)}/wk</dd>
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
