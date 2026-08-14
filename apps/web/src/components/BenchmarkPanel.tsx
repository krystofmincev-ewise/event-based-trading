import type { SimulationResult } from "@event-lab/simulation";
import { useState } from "react";

import { useNumberDraft } from "../hooks/useNumberDraft.js";
import { formatCurrency, formatPercent } from "../lib/format.js";

interface BenchmarkInputProps {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

const BenchmarkInput = ({
  id,
  label,
  value,
  minimum,
  maximum,
  onChange,
}: BenchmarkInputProps) => {
  const draft = useNumberDraft({
    value: Number((value * 100).toFixed(4)),
    minimum,
    maximum,
    onValidChange: (next) => onChange(next / 100),
  });
  return (
    <label htmlFor={id}>
      {label}
      <span className="benchmark-input-wrap">
        <input
          id={id}
          type="number"
          aria-label={label}
          min={minimum}
          max={maximum}
          step={0.5}
          value={draft.visibleValue}
          aria-describedby={draft.isValid ? undefined : `${id}-error`}
          aria-invalid={!draft.isValid || undefined}
          onFocus={draft.onFocus}
          onBlur={draft.onBlur}
          onChange={draft.onChange}
          onKeyDown={draft.onKeyDown}
        />
        <span aria-hidden="true">%</span>
      </span>
      {!draft.isValid ? (
        <small className="input-error" id={`${id}-error`} role="alert">
          Enter a value from {minimum}% to {maximum}%.
        </small>
      ) : null}
    </label>
  );
};

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
        <BenchmarkInput
          id="benchmark-drift"
          label="Annual arithmetic drift"
          value={annualReturn}
          minimum={-50}
          maximum={50}
          onChange={setAnnualReturn}
        />
        <BenchmarkInput
          id="benchmark-volatility"
          label="Annual volatility"
          value={annualVolatility}
          minimum={0}
          maximum={100}
          onChange={setAnnualVolatility}
        />
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
          <dt>Strategy median vs modeled median</dt>
          <dd>
            {formatPercent(result.metrics.terminalCapital.median / median - 1)}
          </dd>
        </div>
      </dl>
      <p className="benchmark-comparison-note">
        Relative difference between two independently modeled distribution
        medians—not paired outperformance.
      </p>
    </section>
  );
};
