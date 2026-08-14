import { DEFAULT_SIMULATION_INPUT } from "@event-lab/simulation";
import type { SimulationInput } from "@event-lab/simulation";
import { useState } from "react";

import { AnalyticsDashboard } from "./components/AnalyticsDashboard.js";
import { ControlPanel } from "./components/ControlPanel.js";
import { Header } from "./components/Header.js";
import { MetricStrip } from "./components/MetricStrip.js";
import { Overview } from "./components/Overview.js";
import { useLabData } from "./hooks/useLabData.js";

export const App = () => {
  const [input, setInput] = useState<SimulationInput>(DEFAULT_SIMULATION_INPUT);
  const lab = useLabData(input);

  return (
    <div id="top" className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to results
      </a>
      <Header status={lab.status} />
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
              This is an abstract hit-probability + net-payout model. It does
              not infer an underlying asset path or price a barrier option.
            </p>
          </div>
        </section>

        <section
          id="custom-lab"
          className="lab-layout"
          aria-labelledby="lab-title"
        >
          <ControlPanel input={input} onChange={setInput} />
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
              <div className="error-state" role="alert">
                <strong>Local simulation unavailable</strong>
                <p>
                  {lab.error} Start the API on port 8787, then try the control
                  again.
                </p>
              </div>
            ) : null}

            {lab.data ? (
              <div
                className={
                  lab.status === "loading" ? "results-stale" : undefined
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
            ) : (
              <div className="loading-state" role="status">
                <span className="loading-line" />
                <span className="loading-line short" />
                <p>Building seeded paths and pathwise risk statistics…</p>
              </div>
            )}
          </div>
        </section>

        <section
          id="kelly"
          className="coming-section"
          aria-labelledby="kelly-title"
        >
          <span className="eyebrow">Growth-optimal sizing</span>
          <h2 id="kelly-title">Kelly comparison follows the risk surface.</h2>
          <p>
            Full, half, and quarter Kelly use the synchronized probability and
            payout assumptions above.
          </p>
        </section>

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
