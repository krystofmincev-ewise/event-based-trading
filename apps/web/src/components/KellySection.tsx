import type {
  KellyComparisonPoint,
  SimulationResult,
} from "@event-lab/simulation";

import { formatCurrency, formatPercent } from "../lib/format.js";

interface KellySectionProps {
  simulation: SimulationResult;
  comparison: KellyComparisonPoint[];
  onSelectFraction: (fraction: number) => void;
}

const variantDescription: Record<KellyComparisonPoint["label"], string> = {
  "No stake": "Capital preservation baseline",
  "Quarter Kelly": "75% haircut to model confidence",
  "Half Kelly": "50% haircut to model confidence",
  "Full Kelly": "Analytic log-growth optimum",
};

export const KellySection = ({
  simulation,
  comparison,
  onSelectFraction,
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

      <div className="kelly-readout" aria-label="Kelly fraction results">
        <div>
          <span>Raw Kelly</span>
          <strong>{formatPercent(kelly.rawFraction)}</strong>
          <small>Before [0%, 100%] action bounds</small>
        </div>
        {kellyLanes.map((lane) => (
          <div key={lane.label}>
            <span>{lane.label}</span>
            <strong>{formatPercent(lane.value)}</strong>
            <button type="button" onClick={() => onSelectFraction(lane.value)}>
              Use {lane.label.toLowerCase()}
            </button>
          </div>
        ))}
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
            <span className="eyebrow">
              Same paths, different confidence haircut
            </span>
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
        >
          <div className="kelly-table-head" role="row">
            <span role="columnheader">Variant</span>
            <span role="columnheader">p05 → median → p95 terminal</span>
            <span role="columnheader">Practical ruin</span>
            <span role="columnheader">Median max DD</span>
          </div>
          {comparison.map((point) => (
            <div className="kelly-row" role="row" key={point.label}>
              <div role="cell">
                <strong>{point.label}</strong>
                <span>
                  {formatPercent(point.fraction)} ·{" "}
                  {variantDescription[point.label]}
                </span>
              </div>
              <div className="kelly-range" role="cell">
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
              <strong className="risk-number" role="cell">
                {formatPercent(point.probabilityOfPracticalRuin)}
              </strong>
              <strong className="risk-number" role="cell">
                {formatPercent(point.medianMaxDrawdown)}
              </strong>
            </div>
          ))}
        </div>
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
