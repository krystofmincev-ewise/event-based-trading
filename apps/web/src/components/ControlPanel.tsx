import {
  contractPriceToNetWinMultiple,
  estimateLabWork,
  LAB_OPERATION_BUDGET,
  netWinMultipleToContractPrice,
  payoutNotionalFraction,
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
          Enter a value from {minimum} to {maximum}.
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
  const allInPrice = netWinMultipleToContractPrice(input.netWinMultiple);
  const notionalFraction = payoutNotionalFraction(
    input.positionFraction,
    allInPrice,
  );
  const work = estimateLabWork(input);
  const exceedsWorkBudget = work.totalPathTrades > LAB_OPERATION_BUDGET;

  return (
    <aside className="control-panel" aria-label="Simulation controls">
      <div className="panel-kicker">
        <span>Input console</span>
        <span>v1 · IID binary</span>
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
          id="positionFraction"
          label="Current bankroll at risk"
          value={input.positionFraction}
          min={0}
          max={1}
          step={0.01}
          displayFactor={100}
          unit="%"
          description="Premium/capital at risk on every trade, as a fraction of current bankroll."
          onChange={setNumeric}
        />
        <NumericControl
          id="netWinMultiple"
          label="Net win profit multiple"
          value={input.netWinMultiple}
          min={0.01}
          max={20}
          step={0.01}
          unit="×"
          description="Net profit b per $1 staked; the original stake is returned separately."
          onChange={setNumeric}
        />
        <div className="price-helper" aria-label="Contract price conversion">
          <span>Equivalent $1 all-in price</span>
          <strong>${allInPrice.toFixed(3)}</strong>
          <span>Payout notional / bankroll</span>
          <strong>{(notionalFraction * 100).toFixed(1)}%</strong>
          <p>Notional f/c is distinct from the premium fraction f at risk.</p>
        </div>
      </Group>
      <Group title="Experiment design">
        <NumericControl
          id="tradesPerWeek"
          label="Trades per week"
          value={input.tradesPerWeek}
          min={0.25}
          max={20}
          step={0.25}
          description="Sequential opportunities; total trades round to a whole number and the realized rate is reported."
          onChange={setNumeric}
        />
        <NumericControl
          id="horizonWeeks"
          label="Horizon"
          value={input.horizonWeeks}
          min={1}
          max={104}
          step={1}
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
          {LAB_OPERATION_BUDGET.toLocaleString()} path-trades
        </strong>
        <p>
          {exceedsWorkBudget
            ? "Above the local safety limit. Reduce paths, trade frequency, or horizon before results can refresh."
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
        <code>win: W′ = W(1 + fb)</code>
        <code>loss: W′ = W(1 − f)</code>
      </div>
      <button
        className="reset-button"
        type="button"
        onClick={() =>
          onChange({
            ...input,
            netWinMultiple: contractPriceToNetWinMultiple(0.5),
            winProbability: 0.58,
            positionFraction: 0.08,
          })
        }
      >
        Reset core assumptions
      </button>
    </aside>
  );
};
