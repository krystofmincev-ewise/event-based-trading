import type { SimulationResult } from "@event-lab/simulation";
import { useState } from "react";

import { formatCurrency, formatPercent } from "../lib/format.js";

export const BenchmarkPanel = ({ result }: { result: SimulationResult }) => {
  const [annualReturn, setAnnualReturn] = useState(0.08);
  const [annualVolatility, setAnnualVolatility] = useState(0.18);
  const years = result.metadata.horizonYears;
  const logDrift = annualReturn - 0.5 * annualVolatility ** 2;
  const median = result.input.startingCapital * Math.exp(logDrift * years);
  const expected =
    result.input.startingCapital * Math.exp(annualReturn * years);
  const spread = 1.644_853_626_951_472_2 * annualVolatility * Math.sqrt(years);
  const p05 =
    result.input.startingCapital * Math.exp(logDrift * years - spread);
  const p95 =
    result.input.startingCapital * Math.exp(logDrift * years + spread);

  return (
    <section className="benchmark-panel" aria-labelledby="benchmark-title">
      <div>
        <span className="eyebrow">Transparent offline context</span>
        <h3 id="benchmark-title">Modeled market-like benchmark</h3>
        <p>
          A configurable lognormal GBM reference over the same horizon. It is
          not actual or historical S&amp;P 500 data and is never subtracted in
          strategy Sharpe.
        </p>
      </div>
      <div className="benchmark-controls">
        <label>
          Annual arithmetic drift
          <span>
            <input
              type="number"
              min={-50}
              max={50}
              step={0.5}
              value={annualReturn * 100}
              onChange={(event) =>
                setAnnualReturn(Number(event.target.value) / 100)
              }
            />
            %
          </span>
        </label>
        <label>
          Annual volatility
          <span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={annualVolatility * 100}
              onChange={(event) =>
                setAnnualVolatility(Number(event.target.value) / 100)
              }
            />
            %
          </span>
        </label>
      </div>
      <dl className="benchmark-outcomes">
        <div>
          <dt>Expected terminal</dt>
          <dd>{formatCurrency(expected)}</dd>
        </div>
        <div>
          <dt>Median terminal</dt>
          <dd>{formatCurrency(median)}</dd>
        </div>
        <div>
          <dt>5th / 95th</dt>
          <dd>
            {formatCurrency(p05)} / {formatCurrency(p95)}
          </dd>
        </div>
        <div>
          <dt>Strategy median advantage</dt>
          <dd>
            {formatPercent(result.metrics.terminalCapital.median / median - 1)}
          </dd>
        </div>
      </dl>
    </section>
  );
};
