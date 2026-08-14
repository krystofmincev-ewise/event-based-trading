import type {
  KellyComparisonPoint,
  SimulationInput,
  SimulationResult,
} from "@event-lab/simulation";

import { useNumberDraft } from "../hooks/useNumberDraft.js";
import { formatCurrency, formatPercent } from "../lib/format.js";

interface KellySectionProps {
  simulation: SimulationResult;
  comparison: KellyComparisonPoint[];
  currentAssumptions: Pick<
    SimulationInput,
    "winProbability" | "netWinMultiple" | "positionFraction"
  >;
  isRefreshing: boolean;
  onSelectFraction: (fraction: number) => void;
  onChangeProbability: (probability: number) => void;
}

const variantDescription: Record<KellyComparisonPoint["label"], string> = {
  "No stake": "Capital preservation baseline",
  "Quarter Kelly": "25% of the full-Kelly stake",
  "Half Kelly": "50% of the full-Kelly stake",
  "Full Kelly": "Analytic log-growth optimum",
};

export const KellySection = ({
  simulation,
  comparison,
  currentAssumptions,
  isRefreshing,
  onSelectFraction,
  onChangeProbability,
}: KellySectionProps) => {
  const { kelly } = simulation;
  const allInPrice = 1 / (simulation.input.netWinMultiple + 1);
  const maximumTerminal = Math.max(
    ...comparison.map((point) => point.p95TerminalCapital),
    simulation.input.startingCapital,
  );
  const normalized = (capital: number) =>
    Math.max(0, Math.min(100, (capital / maximumTerminal) * 100));
  const kellyLanes = [
    { label: "Quarter Kelly", value: kelly.quarterFraction },
    { label: "Half Kelly", value: kelly.halfFraction },
    { label: "Full Kelly", value: kelly.fullFraction },
  ];
  const currentPrice = 1 / (currentAssumptions.netWinMultiple + 1);
  const isApplied = (fraction: number) =>
    Math.abs(currentAssumptions.positionFraction - fraction) < 0.000001;
  const comparisonPathCount = comparison.find(
    (point) => point.label !== "No stake",
  )?.pathCount;
  const probabilityDraft = useNumberDraft({
    value: Number((currentAssumptions.winProbability * 100).toFixed(4)),
    minimum: 0,
    maximum: 100,
    onValidChange: (next) => onChangeProbability(next / 100),
  });

  return (
    <section id="kelly" className="kelly-section" aria-labelledby="kelly-title">
      <div className="kelly-intro">
        <div>
          <span className="eyebrow">Synchronized sizing study</span>
          <h2 id="kelly-title">Kelly, with the confidence dial exposed.</h2>
          <p>
            Kelly maximizes expected logarithmic growth only when probability
            and payout are stationary and known. In practice, estimation error
            and clustered outcomes make full Kelly dangerously brittle.
          </p>
        </div>
        <aside>
          <span>Analytic identity</span>
          <code>f* = (bp − (1 − p)) / b</code>
          <code>price form: (p − c) / (1 − c)</code>
          <p>
            Here c = {allInPrice.toFixed(3)}. A negative raw result means no
            long allocation; it does not automatically authorize shorting the
            opposite contract.
          </p>
        </aside>
      </div>

      <div className="kelly-assumptions" aria-label="Current Kelly assumptions">
        <div className="kelly-probability-control">
          <label htmlFor="kelly-win-probability">
            Kelly success probability
          </label>
          <div className="kelly-number-wrap">
            <input
              id="kelly-win-probability"
              type="number"
              min={0}
              max={100}
              step={1}
              value={probabilityDraft.visibleValue}
              aria-describedby={
                probabilityDraft.isValid
                  ? "kelly-probability-note"
                  : "kelly-probability-note kelly-probability-error"
              }
              aria-invalid={!probabilityDraft.isValid || undefined}
              onFocus={probabilityDraft.onFocus}
              onBlur={probabilityDraft.onBlur}
              onChange={probabilityDraft.onChange}
              onKeyDown={probabilityDraft.onKeyDown}
            />
            <span aria-hidden="true">%</span>
          </div>
          <small id="kelly-probability-note">
            Synchronized with custom lab
          </small>
          {!probabilityDraft.isValid ? (
            <small
              className="input-error"
              id="kelly-probability-error"
              role="alert"
            >
              Enter a probability from 0% to 100%.
            </small>
          ) : null}
        </div>
        <div className="kelly-current-payout">
          <span>Current payout assumption</span>
          <strong>
            +{currentAssumptions.netWinMultiple.toFixed(2)}× net · $
            {currentPrice.toFixed(3)} price ·{" "}
            {formatPercent(currentAssumptions.positionFraction)} bankroll at
            risk
          </strong>
        </div>
        <a href="#custom-lab">Edit assumptions ↑</a>
      </div>

      <div className="kelly-readout" aria-label="Kelly fraction results">
        <div>
          <span>Raw Kelly</span>
          <strong>{formatPercent(kelly.rawFraction)}</strong>
          <small>Before [0%, 100%] action bounds</small>
        </div>
        {kellyLanes.map((lane) => {
          const applied = isApplied(lane.value);
          return (
            <div
              className={applied ? "kelly-lane applied" : "kelly-lane"}
              key={lane.label}
            >
              <span>{lane.label}</span>
              <strong>{formatPercent(lane.value)}</strong>
              <button
                type="button"
                aria-pressed={applied}
                onClick={() => onSelectFraction(lane.value)}
              >
                {applied ? "Applied" : `Use ${lane.label.toLowerCase()}`}
              </button>
              {applied ? (
                <small className="applied-status" aria-live="polite">
                  {isRefreshing
                    ? "Applied · recomputing…"
                    : "Applied to custom lab"}
                </small>
              ) : null}
            </div>
          );
        })}
      </div>

      {kelly.edgePerUnitStaked <= 0 ? (
        <div className="no-edge-note" role="note">
          Under the synchronized assumptions, expected profit per unit staked is
          non-positive. The clamped actionable Kelly fraction is 0%.
        </div>
      ) : null}

      <div
        className="kelly-comparison"
        aria-labelledby="kelly-comparison-title"
      >
        <div className="chart-heading">
          <div>
            <span className="eyebrow">Same paths, fractional Kelly stakes</span>
            <h3 id="kelly-comparison-title">Finite-horizon outcome range</h3>
          </div>
          <p>
            The comparison visualizes risk around analytic fractions. It does
            not estimate or replace the Kelly optimum.
          </p>
        </div>
        <div
          className="kelly-table"
          role="table"
          aria-label="Kelly Monte Carlo comparison"
          tabIndex={0}
        >
          <div className="kelly-table-head" role="row">
            <span role="columnheader">Variant</span>
            <span role="columnheader">p05 → median → p95 terminal</span>
            <span role="columnheader">Practical ruin</span>
            <span role="columnheader">Median max DD</span>
          </div>
          {comparison.map((point) => (
            <div className="kelly-row" role="row" key={point.label}>
              <div role="cell" data-label="Variant">
                <strong>{point.label}</strong>
                <span>
                  {formatPercent(point.fraction)} ·{" "}
                  {variantDescription[point.label]}
                </span>
              </div>
              <div
                className="kelly-range"
                role="cell"
                data-label="Terminal range"
              >
                <div className="range-track" aria-hidden="true">
                  <span
                    className="range-band"
                    style={{
                      left: `${normalized(point.p05TerminalCapital)}%`,
                      width: `${Math.max(
                        1,
                        normalized(point.p95TerminalCapital) -
                          normalized(point.p05TerminalCapital),
                      )}%`,
                    }}
                  />
                  <span
                    className="range-median"
                    style={{
                      left: `${normalized(point.medianTerminalCapital)}%`,
                    }}
                  />
                </div>
                <span>
                  {formatCurrency(point.p05TerminalCapital)} ·{" "}
                  <strong>{formatCurrency(point.medianTerminalCapital)}</strong>{" "}
                  · {formatCurrency(point.p95TerminalCapital)}
                </span>
              </div>
              <strong
                className="risk-number"
                role="cell"
                data-label="Practical ruin"
              >
                {formatPercent(point.probabilityOfPracticalRuin)}
              </strong>
              <strong
                className="risk-number"
                role="cell"
                data-label="Median max drawdown"
              >
                {formatPercent(point.medianMaxDrawdown)}
              </strong>
            </div>
          ))}
        </div>
        <p className="sample-caption">
          n = {comparisonPathCount?.toLocaleString() ?? "—"} paths per staked
          variant · no-stake baseline is exact
        </p>
      </div>

      <div className="kelly-caution">
        <span>Why greed can lose with a positive edge</span>
        <p>
          At p = 60%, c = $0.50, and f = 80%, expected simple return is +16% per
          trade—yet expected log growth is about −0.291 per trade. Large losses
          damage the compounding base nonlinearly.
        </p>
        <strong>
          Fractional Kelly is a robustness control for model uncertainty. It is
          not a recommendation.
        </strong>
      </div>
    </section>
  );
};
