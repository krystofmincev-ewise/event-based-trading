import {
  DEFAULT_EMPIRICAL_SCENARIO,
  DEFAULT_SIMULATION_INPUT,
  resolveEmpiricalScenario,
} from "@event-lab/simulation";
import type {
  EmpiricalScenarioSelection,
  SimulationInput,
} from "@event-lab/simulation";
import { useState } from "react";

import { AnalyticsDashboard } from "./components/AnalyticsDashboard.js";
import { ControlPanel } from "./components/ControlPanel.js";
import { EmpiricalScenarioBuilder } from "./components/EmpiricalScenarioBuilder.js";
import { Header } from "./components/Header.js";
import { KellySection } from "./components/KellySection.js";
import { MarketCapContext } from "./components/MarketCapContext.js";
import { MetricStrip } from "./components/MetricStrip.js";
import { Overview } from "./components/Overview.js";
import { useLabData } from "./hooks/useLabData.js";

const SCENARIO_DERIVED_INPUTS = [
  "winProbability",
  "probabilityHaircut",
  "contractPurchasePrice",
  "settlementPayout",
  "roundTripCosts",
  "eventsPerWeek",
  "opportunityArrival",
  "calibrationUncertaintyEnabled",
  "calibrationEffectiveSampleSize",
  "weeklyProbabilityLogitStdDev",
  "executionCostCoefficientVariation",
] as const satisfies readonly (keyof SimulationInput)[];

export const App = () => {
  const [scenarioSelection, setScenarioSelection] =
    useState<EmpiricalScenarioSelection>(DEFAULT_EMPIRICAL_SCENARIO);
  const [input, setInput] = useState<SimulationInput>(() => ({
    ...DEFAULT_SIMULATION_INPUT,
    ...resolveEmpiricalScenario(DEFAULT_EMPIRICAL_SCENARIO).simulationPatch,
    positionFraction: 0,
    pathCount: 1_000,
  }));
  const lab = useLabData(input);

  return (
    <div id="top" className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header status={lab.status} issueKind={lab.error?.kind} />
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              Monte Carlo research instrument · educational scenario analysis
            </span>
            <h1 id="hero-title">
              Size for the path,
              <br /> not the fantasy.
            </h1>
            <p>
              Explore how repeated binary event bets compound a bankroll—and why
              a positive edge can still produce brutal typical outcomes when the
              position is too large.
            </p>
          </div>
          <div className="hero-aside">
            <span>Model boundary</span>
            <p>
              Candidate sizing uses the acquisition cost, payout, fees/slippage,
              and whole contracts you supply. The composer&apos;s visibly
              labelled proxy terms are research defaults, not a live quote.
            </p>
          </div>
        </section>

        <EmpiricalScenarioBuilder
          selection={scenarioSelection}
          appliedManifest={input.researchScenarioManifest}
          onSelectionChange={setScenarioSelection}
          onApply={(patch) => setInput((current) => ({ ...current, ...patch }))}
        />

        <MarketCapContext />

        <section
          id="custom-lab"
          className="lab-layout"
          aria-labelledby="lab-title"
        >
          <ControlPanel
            input={input}
            onChange={(next) =>
              setInput((current) => ({
                ...next,
                researchScenarioManifest: SCENARIO_DERIVED_INPUTS.some(
                  (key) => current[key] !== next[key],
                )
                  ? null
                  : current.researchScenarioManifest,
              }))
            }
          />
          <div className="results-column">
            <div className="results-header">
              <div>
                <span className="eyebrow">Custom sizing lab</span>
                <h2 id="lab-title">Decision surface</h2>
              </div>
              <p>
                Every control recomputes the same seeded experiment after a
                short pause.
              </p>
            </div>

            {lab.error ? (
              <div
                className={
                  lab.data ? "error-state has-stale-data" : "error-state"
                }
                role="alert"
              >
                <strong>Simulation refresh failed</strong>
                <p>
                  {lab.error.message}{" "}
                  {lab.data
                    ? "The last successful result remains below as stale context."
                    : lab.error.kind === "input"
                      ? "Adjust the highlighted experiment inputs to continue."
                      : lab.error.kind === "unavailable"
                        ? "Start the local API on port 8787, then retry."
                        : lab.error.kind === "malformed"
                          ? "Restart the local app stack so the API and client share the same contract, then retry."
                          : "Review the inputs and retry."}
                </p>
                {lab.error.details.length > 0 ? (
                  <ul className="error-details">
                    {lab.error.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
                {lab.error.kind === "input" ? null : (
                  <button type="button" onClick={lab.retry}>
                    Retry simulation
                  </button>
                )}
              </div>
            ) : null}

            {lab.data ? (
              <div
                className={
                  lab.status === "loading" || lab.status === "error"
                    ? "results-stale"
                    : undefined
                }
                aria-busy={lab.status === "loading"}
                aria-label={
                  lab.status === "error"
                    ? "Stale results from the last successful simulation"
                    : lab.status === "loading"
                      ? "Results updating"
                      : undefined
                }
              >
                <MetricStrip result={lab.data.simulation} />
                <Overview result={lab.data.simulation} />
                <AnalyticsDashboard
                  simulation={lab.data.simulation}
                  exploration={lab.data.exploration}
                />
                <aside className="warning-ledger" aria-label="Model warnings">
                  <span>Known omissions</span>
                  <ul>
                    {lab.data.simulation.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </aside>
              </div>
            ) : !lab.error ? (
              <div className="loading-state" role="status">
                <span className="loading-line" />
                <span className="loading-line short" />
                <p>Building seeded paths and pathwise risk statistics…</p>
              </div>
            ) : null}
          </div>
        </section>

        {lab.data ? (
          <div
            className={lab.status === "ready" ? undefined : "kelly-stale"}
            aria-label={
              lab.status === "error"
                ? "Stale Kelly comparison from the last successful simulation"
                : lab.status === "loading"
                  ? "Kelly comparison updating"
                  : undefined
            }
          >
            <KellySection
              simulation={lab.data.simulation}
              comparison={lab.data.comparison}
              currentAssumptions={input}
              isRefreshing={
                lab.status === "loading" ||
                input.positionFraction !==
                  lab.data.simulation.input.positionFraction ||
                input.winProbability !==
                  lab.data.simulation.input.winProbability ||
                input.probabilityHaircut !==
                  lab.data.simulation.input.probabilityHaircut ||
                input.contractPurchasePrice !==
                  lab.data.simulation.input.contractPurchasePrice ||
                input.settlementPayout !==
                  lab.data.simulation.input.settlementPayout ||
                input.roundTripCosts !==
                  lab.data.simulation.input.roundTripCosts
              }
              onSelectFraction={(positionFraction) =>
                setInput((current) => ({
                  ...current,
                  positionFraction,
                }))
              }
              onChangeProbability={(winProbability) =>
                setInput((current) => ({
                  ...current,
                  winProbability,
                  researchScenarioManifest: null,
                }))
              }
            />
          </div>
        ) : null}

        <section id="methodology" className="disclaimer">
          <strong>Research context, not a recommendation.</strong>
          <p>
            No broker connection, execution, personal portfolio data, or live
            market feed. Outputs are educational simulations, not forecasts or
            personalized financial advice.
          </p>
        </section>
      </main>
      <footer>
        <span>Event Edge Lab · local-only model</span>
        <span>Seeded. Reproducible. Explicitly limited.</span>
      </footer>
    </div>
  );
};
