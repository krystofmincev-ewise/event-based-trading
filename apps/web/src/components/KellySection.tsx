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
    | "winProbability"
    | "probabilityHaircut"
    | "contractPurchasePrice"
    | "settlementPayout"
    | "roundTripCosts"
    | "positionFraction"
  >;
  isRefreshing: boolean;
  onSelectFraction: (fraction: number) => void;
  onChangeProbability: (probability: number) => void;
}

const variantDescription: Record<KellyComparisonPoint["label"], string> = {
  "No stake": "Capital preservation baseline",
  "Current size": "Your selected target risk budget",
  "Conservative Kelly": "Kelly after the probability haircut",
  "Raw Kelly": "Kelly using the unadjusted probability estimate",
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
  const { economics } = kelly;
  const maximumTerminal = Math.max(
    ...comparison.map((point) => point.p95TerminalCapital),
    simulation.input.startingCapital,
  );
  const normalized = (capital: number) =>
    Math.max(0, Math.min(100, (capital / maximumTerminal) * 100));
  const kellyLanes = [
    {
      label: "Conservative Kelly",
      value: kelly.conservative.actionableFraction,
    },
    { label: "Raw Kelly", value: kelly.estimated.actionableFraction },
  ];
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
          <h2 id="kelly-title">Kelly, with contract costs and uncertainty.</h2>
          <p>
            Raw Kelly uses your probability estimate. Conservative Kelly first
            subtracts the explicit probability haircut. Both produce a dollar
            risk budget that is executed as whole contracts—not fractional
            trades.
          </p>
        </div>
        <aside>
          <span>Analytic identity</span>
          <code>f* = (bp − (1 − p)) / b</code>
          <code>break-even p = all-in cost / payout</code>
          <p>
            Here break-even is{" "}
            {(economics.breakEvenProbability * 100).toFixed(1)}%. A negative
            result means no long allocation; it does not automatically authorize
            the opposite contract.
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
          <span>Current held-to-settlement economics</span>
          <strong>
            ${currentAssumptions.contractPurchasePrice.toFixed(3)} purchase + $
            {currentAssumptions.roundTripCosts.toFixed(3)} costs → $
            {currentAssumptions.settlementPayout.toFixed(2)} payout ·{" "}
            {formatPercent(currentAssumptions.positionFraction)} bankroll at
            risk
          </strong>
        </div>
        <a href="#custom-lab">Edit assumptions ↑</a>
      </div>

      <div className="kelly-readout" aria-label="Kelly fraction results">
        <div>
          <span>All-in break-even</span>
          <strong>{formatPercent(economics.breakEvenProbability)}</strong>
          <small>Price + costs, divided by settlement payout</small>
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

      {kelly.conservative.expectedProfitPerContract <= 0 ? (
        <div className="no-edge-note" role="note">
          After the probability haircut, expected profit per contract is
          non-positive. Conservative Kelly therefore allocates 0%, even if the
          unadjusted estimate has an edge.
        </div>
      ) : null}

      <div
        className="kelly-comparison"
        aria-labelledby="kelly-comparison-title"
      >
        <div className="chart-heading">
          <div>
            <span className="eyebrow">
              Same paths, whole-contract execution
            </span>
            <h3 id="kelly-comparison-title">Finite-horizon outcome range</h3>
          </div>
          <p>
            Fractions set risk budgets; every event floors that budget to whole
            contracts. The Monte Carlo does not estimate Kelly.
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
        <span>Why 50% is not the edge threshold</span>
        <p>
          A 45% hit estimate can be positive-EV if an all-in contract costs 40%
          of its payout. Simply “doing the opposite” is not free: that side has
          its own executable quote, costs, payout rules, and probability.
        </p>
        <strong>
          The haircut is a transparent stress assumption, not statistical
          certainty or a recommendation.
        </strong>
      </div>
    </section>
  );
};
