import {
  calculateKelly,
  deriveContractEconomics,
  estimateLabWork,
  LAB_OPERATION_BUDGET,
  wholeContractPosition,
} from "@event-lab/simulation";
import type { SimulationInput } from "@event-lab/simulation";
import type { ChangeEvent, ReactNode } from "react";

import { useNumberDraft } from "../hooks/useNumberDraft.js";

interface NumericControlProps {
  id: keyof SimulationInput;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  unit?: string;
  prefix?: string;
  displayFactor?: number;
  hideRange?: boolean;
  integerOnly?: boolean;
  formatSummary?: (value: number) => string;
  onChange: (key: keyof SimulationInput, value: number) => void;
}

const NumericControl = ({
  id,
  label,
  value,
  min,
  max,
  step,
  description,
  unit,
  prefix,
  displayFactor = 1,
  hideRange = false,
  integerOnly = false,
  formatSummary,
  onChange,
}: NumericControlProps) => {
  const displayValue = Number((value * displayFactor).toFixed(4));
  const minimum = min * displayFactor;
  const maximum = max * displayFactor;
  const numberDraft = useNumberDraft({
    value: displayValue,
    minimum,
    maximum,
    isAllowed: integerOnly ? Number.isInteger : () => true,
    onValidChange: (next) => onChange(id, next / displayFactor),
  });
  const updateRange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value) / displayFactor;
    if (Number.isFinite(next)) {
      onChange(id, next);
    }
  };
  return (
    <div className={`control-row${hideRange ? " number-only" : ""}`}>
      <div className="control-heading">
        <label htmlFor={`${id}-number`}>{label}</label>
        <span>
          {formatSummary
            ? formatSummary(displayValue)
            : `${prefix ?? ""}${displayValue}${unit ?? ""}`}
        </span>
      </div>
      <p id={`${id}-hint`}>{description}</p>
      <div className="paired-inputs">
        {hideRange ? null : (
          <input
            id={`${id}-range`}
            type="range"
            min={min * displayFactor}
            max={max * displayFactor}
            step={step * displayFactor}
            value={displayValue}
            aria-label={`${label} slider`}
            aria-describedby={`${id}-hint`}
            onChange={updateRange}
          />
        )}
        <div className={`number-wrap${prefix ? " has-prefix" : ""}`}>
          {prefix ? (
            <span className="input-prefix" aria-hidden="true">
              {prefix}
            </span>
          ) : null}
          <input
            id={`${id}-number`}
            type="number"
            min={min * displayFactor}
            max={max * displayFactor}
            step={step * displayFactor}
            value={numberDraft.visibleValue}
            aria-describedby={`${id}-hint${numberDraft.isValid ? "" : ` ${id}-error`}`}
            aria-invalid={!numberDraft.isValid || undefined}
            onFocus={numberDraft.onFocus}
            onBlur={numberDraft.onBlur}
            onChange={numberDraft.onChange}
            onKeyDown={numberDraft.onKeyDown}
          />
          {unit ? (
            <span className="input-suffix" aria-hidden="true">
              {unit}
            </span>
          ) : null}
        </div>
      </div>
      {!numberDraft.isValid ? (
        <small className="input-error" id={`${id}-error`} role="alert">
          Enter {integerOnly ? "a whole number" : "a value"} from {minimum} to{" "}
          {maximum}.
        </small>
      ) : null}
    </div>
  );
};

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <fieldset className="control-group">
    <legend>{title}</legend>
    {children}
  </fieldset>
);

interface ControlPanelProps {
  input: SimulationInput;
  onChange: (input: SimulationInput) => void;
}

export const ControlPanel = ({ input, onChange }: ControlPanelProps) => {
  const setNumeric = (key: keyof SimulationInput, value: number) => {
    onChange({ ...input, [key]: value });
  };
  const hasValidContract =
    input.contractPurchasePrice + input.roundTripCosts < input.settlementPayout;
  const economics = hasValidContract
    ? deriveContractEconomics(
        input.contractPurchasePrice,
        input.settlementPayout,
        input.roundTripCosts,
      )
    : null;
  const sizing = economics
    ? wholeContractPosition(
        input.startingCapital,
        input.positionFraction,
        economics.allInCost,
      )
    : null;
  const kelly = economics
    ? calculateKelly(
        input.winProbability,
        input.probabilityHaircut,
        input.contractPurchasePrice,
        input.settlementPayout,
        input.roundTripCosts,
      )
    : null;
  const work = estimateLabWork(input);
  const exceedsWorkBudget = work.totalPathTrades > LAB_OPERATION_BUDGET;

  return (
    <aside className="control-panel" aria-label="Simulation controls">
      <div className="panel-kicker">
        <span>Input console</span>
        <span>v2 · illustrative defaults</span>
      </div>
      <Group title="Contract assumptions">
        <NumericControl
          id="winProbability"
          label="Event hit probability"
          value={input.winProbability}
          min={0}
          max={1}
          step={0.01}
          displayFactor={100}
          unit="%"
          description="Your assumed probability that the abstract event contract pays out."
          onChange={setNumeric}
        />
        <NumericControl
          id="probabilityHaircut"
          label="Probability uncertainty haircut"
          value={input.probabilityHaircut}
          min={0}
          max={0.25}
          step={0.005}
          displayFactor={100}
          unit="%"
          description="Subtracted from your estimate before conservative Kelly sizing; this is an explicit judgment, not a confidence interval."
          onChange={setNumeric}
        />
        <NumericControl
          id="contractPurchasePrice"
          label="Executable contract purchase price"
          value={input.contractPurchasePrice}
          min={0.01}
          max={10_000}
          step={0.01}
          prefix="$"
          hideRange
          description="Executable ask or acquisition price per contract—not a midpoint."
          onChange={setNumeric}
        />
        <NumericControl
          id="settlementPayout"
          label="Settlement payout on a hit"
          value={input.settlementPayout}
          min={0.02}
          max={100_000}
          step={0.01}
          prefix="$"
          hideRange
          description="Total cash received per winning contract, including return of premium economics."
          onChange={setNumeric}
        />
        <NumericControl
          id="roundTripCosts"
          label="Fees + slippage per contract"
          value={input.roundTripCosts}
          min={0}
          max={1_000}
          step={0.001}
          prefix="$"
          hideRange
          description="Round-trip commissions, exchange fees, and a conservative fill/slippage allowance."
          onChange={setNumeric}
        />
        <NumericControl
          id="positionFraction"
          label="Target bankroll at risk"
          value={input.positionFraction}
          min={0}
          max={1}
          step={0.005}
          displayFactor={100}
          unit="%"
          description="Dollar risk budget per event. Execution floors it to a whole number of contracts."
          onChange={setNumeric}
        />
        {!hasValidContract ? (
          <p className="input-error" role="alert">
            Purchase price plus costs must be below the winning settlement
            payout.
          </p>
        ) : null}
        <div className="price-helper" aria-label="Contract price conversion">
          <span>All-in maximum loss</span>
          <strong>${economics?.allInCost.toFixed(3) ?? "—"}</strong>
          <span>Net win odds</span>
          <strong>
            {economics ? `${economics.netWinMultiple.toFixed(2)}×` : "—"}
          </strong>
          <span>All-in break-even</span>
          <strong>
            {economics
              ? `${(economics.breakEvenProbability * 100).toFixed(1)}%`
              : "—"}
          </strong>
          <span>EV / contract (estimate)</span>
          <strong>
            {kelly
              ? `$${kelly.estimated.expectedProfitPerContract.toFixed(3)}`
              : "—"}
          </strong>
          <span>Initial whole contracts</span>
          <strong>{sizing?.contractCount.toLocaleString() ?? "—"}</strong>
          <span>Initial deployed risk</span>
          <strong>
            {sizing ? `${(sizing.executedFraction * 100).toFixed(2)}%` : "—"}
          </strong>
          <p>
            Edge means estimated probability exceeds the all-in break-even—not
            that hit rate exceeds 50%. For example, 49% can have edge against a
            40% break-even. The opposite side needs its own quote.
          </p>
        </div>
      </Group>
      <Group title="Experiment design">
        <NumericControl
          id="eventsPerWeek"
          label="Whole events per week"
          value={input.eventsPerWeek}
          min={1}
          max={20}
          step={1}
          integerOnly
          description="Integer executed opportunities only; the model never creates half a trade."
          onChange={setNumeric}
        />
        <NumericControl
          id="horizonWeeks"
          label="Horizon"
          value={input.horizonWeeks}
          min={1}
          max={104}
          step={1}
          integerOnly
          unit=" wk"
          description="One week to two years. CAGR uses this calendar horizon."
          onChange={setNumeric}
        />
        <NumericControl
          id="startingCapital"
          label="Starting capital"
          value={input.startingCapital}
          min={100}
          max={1_000_000_000}
          step={100}
          integerOnly
          prefix="$"
          hideRange
          formatSummary={(capital) =>
            `$${capital.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          }
          description="Nominal scale only; percentage risk behavior is unchanged."
          onChange={setNumeric}
        />
        <NumericControl
          id="pathCount"
          label="Monte Carlo paths"
          value={input.pathCount}
          min={100}
          max={25_000}
          step={100}
          integerOnly
          description="More paths reduce sampling noise but take longer to recompute."
          onChange={setNumeric}
        />
        <label className="text-control" htmlFor="seed">
          <span>Deterministic seed</span>
          <input
            id="seed"
            value={input.seed}
            maxLength={100}
            onChange={(event) =>
              onChange({ ...input, seed: event.target.value })
            }
          />
          <small>Same inputs + seed produce the same result.</small>
        </label>
      </Group>
      <div
        className={
          exceedsWorkBudget ? "workload-budget over-budget" : "workload-budget"
        }
        role="status"
      >
        <span>Estimated local workload</span>
        <strong>
          {work.totalPathTrades.toLocaleString()} /{" "}
          {LAB_OPERATION_BUDGET.toLocaleString()} path-events
        </strong>
        <p>
          {exceedsWorkBudget
            ? "Above the local safety limit. Reduce paths, event frequency, or horizon before results can refresh."
            : "Includes the main run and labeled preview grids; reported sample counts are never downscaled silently."}
        </p>
      </div>
      <Group title="Risk definitions">
        <NumericControl
          id="ruinThresholdFraction"
          label="Practical ruin threshold"
          value={input.ruinThresholdFraction}
          min={0.001}
          max={0.2}
          step={0.001}
          displayFactor={100}
          unit="%"
          description="Path stops at or below this share of starting capital; remaining cash is retained."
          onChange={setNumeric}
        />
        <NumericControl
          id="severeDrawdownFraction"
          label="Severe drawdown line"
          value={input.severeDrawdownFraction}
          min={0.05}
          max={0.95}
          step={0.05}
          displayFactor={100}
          unit="%"
          description="Threshold used for the severe-drawdown breach probability."
          onChange={setNumeric}
        />
        <NumericControl
          id="annualRiskFreeRate"
          label="Annual risk-free rate"
          value={input.annualRiskFreeRate}
          min={-0.5}
          max={0.5}
          step={0.005}
          displayFactor={100}
          unit="%"
          description="Converted geometrically to a weekly rate for Sharpe and Sortino."
          onChange={setNumeric}
        />
      </Group>
      <div className="formula-block">
        <span>Capital recurrence</span>
        <code>n = floor(W × target f / all-in cost)</code>
        <code>win: W′ = W + n × net win profit</code>
        <code>loss: W′ = W − n × all-in cost</code>
      </div>
      <button
        className="reset-button"
        type="button"
        onClick={() =>
          onChange({
            ...input,
            winProbability: 0.54,
            probabilityHaircut: 0.03,
            positionFraction: 0.02,
            contractPurchasePrice: 0.49,
            settlementPayout: 1,
            roundTripCosts: 0.01,
          })
        }
      >
        Reset core assumptions
      </button>
    </aside>
  );
};
