import {
  calculateKelly,
  EMPIRICAL_CONTEXT,
  EVENT_EVIDENCE_SOURCES,
  minimumSupportedCompanyMoveMultiplier,
  resolveEmpiricalScenario,
} from "@event-lab/simulation";
import type {
  CapitalizationProfileId,
  EmpiricalProfileId,
  EmpiricalScenarioSelection,
  ScenarioDirection,
  ScenarioHorizon,
  ScenarioThreshold,
  ResearchScenarioManifest,
  SimulationInput,
} from "@event-lab/simulation";

import { formatPercent } from "../lib/format.js";

interface EmpiricalScenarioBuilderProps {
  selection: EmpiricalScenarioSelection;
  appliedManifest: ResearchScenarioManifest | null;
  onSelectionChange: (selection: EmpiricalScenarioSelection) => void;
  onApply: (patch: Partial<SimulationInput>) => void;
}

const formatProbability = (value: number) =>
  `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;

export const EmpiricalScenarioBuilder = ({
  selection,
  appliedManifest,
  onSelectionChange,
  onApply,
}: EmpiricalScenarioBuilderProps) => {
  const minimumMoveScale = (candidate: EmpiricalScenarioSelection) => {
    return Math.max(
      0.5,
      minimumSupportedCompanyMoveMultiplier(
        candidate.capitalizationId,
        candidate.horizon,
        candidate.threshold,
      ),
    );
  };
  const normalize = (candidate: EmpiricalScenarioSelection) => ({
    ...candidate,
    companyMoveMultiplier: Math.max(
      candidate.companyMoveMultiplier,
      minimumMoveScale(candidate),
    ),
  });
  const resolved = resolveEmpiricalScenario(selection);
  const set = <Key extends keyof EmpiricalScenarioSelection>(
    key: Key,
    value: EmpiricalScenarioSelection[Key],
  ) => onSelectionChange(normalize({ ...selection, [key]: value }));
  const selectedEventSources = EVENT_EVIDENCE_SOURCES.filter(
    (source) =>
      source.applicableProfiles === undefined ||
      source.applicableProfiles.includes(selection.profileId),
  );
  const minimumCompanyMoveScale = minimumMoveScale(selection);
  const draftIsLoaded =
    appliedManifest !== null &&
    appliedManifest.profileId === selection.profileId &&
    appliedManifest.capitalizationId === selection.capitalizationId &&
    appliedManifest.horizonTradingDays === selection.horizon &&
    appliedManifest.direction === selection.direction &&
    appliedManifest.threshold === selection.threshold &&
    appliedManifest.companyMoveMultiplier === selection.companyMoveMultiplier &&
    appliedManifest.modelProbabilityLift === selection.modelProbabilityLift;
  const sectorComparison = EMPIRICAL_CONTEXT.profiles.map((profile) => {
    const scenario = resolveEmpiricalScenario({
      ...selection,
      profileId: profile.id,
    });
    const kelly = calculateKelly(
      scenario.scenarioProbability,
      scenario.simulationPatch.probabilityHaircut!,
      scenario.simulationPatch.contractPurchasePrice!,
      scenario.simulationPatch.settlementPayout!,
      scenario.simulationPatch.roundTripCosts!,
    );
    return {
      scenario,
      conservativeKelly: kelly.conservative.actionableFraction,
      liftToCostBreakEven:
        scenario.modeledBreakEvenProbability -
        scenario.unconditionalContextFrequency,
    };
  });

  return (
    <section
      id="scenario-builder"
      className="scenario-builder"
      aria-labelledby="scenario-builder-title"
    >
      <div className="scenario-heading">
        <div>
          <span className="eyebrow">
            Empirical context · versioned defaults
          </span>
          <h2 id="scenario-builder-title">
            Compose the market question first.
          </h2>
        </div>
        <p>
          Sector, size, horizon, and payoff rule change the unconditional return
          frequency. Model skill and executable price remain separate evidence.
        </p>
      </div>

      <div className="scenario-grid">
        <div
          className="scenario-controls"
          aria-label="Empirical scenario controls"
        >
          <label>
            <span>Sector / industry proxy</span>
            <select
              value={selection.profileId}
              onChange={(event) =>
                set("profileId", event.target.value as EmpiricalProfileId)
              }
            >
              {EMPIRICAL_CONTEXT.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Capitalization context</span>
            <select
              value={selection.capitalizationId}
              onChange={(event) =>
                set(
                  "capitalizationId",
                  event.target.value as CapitalizationProfileId,
                )
              }
            >
              {EMPIRICAL_CONTEXT.capitalizationProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Terminal horizon</span>
            <select
              value={selection.horizon}
              onChange={(event) =>
                set("horizon", Number(event.target.value) as ScenarioHorizon)
              }
            >
              <option value={1}>1 trading day</option>
              <option value={10}>10 trading days</option>
            </select>
          </label>
          <label>
            <span>Outcome direction</span>
            <select
              value={selection.direction}
              onChange={(event) => {
                const direction = event.target.value as ScenarioDirection;
                onSelectionChange(
                  normalize({
                    ...selection,
                    direction,
                    threshold:
                      direction === "absolute" && selection.threshold === 0
                        ? 0.02
                        : selection.threshold,
                  }),
                );
              }}
            >
              <option value="up">Close up by at least</option>
              <option value="down">Close down by at least</option>
              <option value="absolute">Absolute move at least</option>
            </select>
          </label>
          <label>
            <span>Return threshold</span>
            <select
              value={selection.threshold}
              onChange={(event) =>
                set(
                  "threshold",
                  Number(event.target.value) as ScenarioThreshold,
                )
              }
            >
              {selection.direction === "absolute" ? null : (
                <option value={0}>0% direction</option>
              )}
              <option value={0.02}>2%</option>
              <option value={0.05}>5%</option>
              <option value={0.1}>10%</option>
            </select>
          </label>
          <label>
            <span>Company move scale</span>
            <div className="scenario-range-row">
              <input
                type="range"
                min={minimumCompanyMoveScale}
                max={3}
                step={0.05}
                value={selection.companyMoveMultiplier}
                aria-label="Company move scale"
                onChange={(event) =>
                  set("companyMoveMultiplier", Number(event.target.value))
                }
              />
              <output>{selection.companyMoveMultiplier.toFixed(2)}×</output>
            </div>
            <small>
              1.0× uses the sector-size proxy. For a ticker, use its
              matched-event return SD divided by the selected proxy return SD.
              The lower bound prevents unsupported extrapolation beyond the
              catalog&apos;s observed 10% tail.
            </small>
          </label>
          <label>
            <span>Model probability lift over prior</span>
            <div className="scenario-range-row">
              <input
                type="range"
                min={-0.1}
                max={0.2}
                step={0.005}
                value={selection.modelProbabilityLift}
                aria-label="Model probability lift over prior"
                onChange={(event) =>
                  set("modelProbabilityLift", Number(event.target.value))
                }
              />
              <output>
                {selection.modelProbabilityLift >= 0 ? "+" : ""}
                {(selection.modelProbabilityLift * 100).toFixed(1)} pp
              </output>
            </div>
            <small>
              Defaults to 0 pp. Only use a non-zero lift supported by stored,
              out-of-sample calibrated forecasts for the same question.
            </small>
          </label>
        </div>

        <div className="scenario-readout">
          <div className="scenario-question">
            <span>Resolved question</span>
            <strong>
              {resolved.profile.label} · {resolved.capitalization.id} ·{" "}
              {selection.horizon}d
            </strong>
            <p>
              Will the terminal return be{" "}
              {selection.direction === "absolute"
                ? "an absolute move"
                : selection.direction}{" "}
              of at least {formatPercent(selection.threshold)}?
            </p>
          </div>
          <dl className="scenario-metrics">
            <div>
              <dt>Jeffreys-smoothed context frequency</dt>
              <dd>
                {formatProbability(resolved.unconditionalContextFrequency)}
              </dd>
            </div>
            <div>
              <dt>Raw observed knot frequency</dt>
              <dd>
                {resolved.rawObservedFrequency === null
                  ? "— interpolated"
                  : formatProbability(resolved.rawObservedFrequency)}
              </dd>
            </div>
            <div>
              <dt>Scenario probability</dt>
              <dd>{formatProbability(resolved.scenarioProbability)}</dd>
            </div>
            <div>
              <dt>Probability-scaled hypothetical price</dt>
              <dd>${resolved.syntheticProbabilityScaledPrice.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Break-even under modeled costs</dt>
              <dd>{formatProbability(resolved.modeledBreakEvenProbability)}</dd>
            </div>
            <div>
              <dt>Scenario p minus modeled break-even</dt>
              <dd
                className={
                  resolved.scenarioProbabilityMinusModeledBreakEven > 0
                    ? "positive"
                    : "negative"
                }
              >
                {resolved.scenarioProbabilityMinusModeledBreakEven >= 0
                  ? "+"
                  : ""}
                {(
                  resolved.scenarioProbabilityMinusModeledBreakEven * 100
                ).toFixed(2)}{" "}
                pp
              </dd>
            </div>
            <div>
              <dt>Context sample</dt>
              <dd>{resolved.context.sampleSize.toLocaleString()} returns</dd>
            </div>
            <div>
              <dt>Horizon return volatility</dt>
              <dd>{formatPercent(resolved.context.standardDeviation)}</dd>
            </div>
            <div>
              <dt>Effective move scale</dt>
              <dd>{resolved.effectiveMoveMultiplier.toFixed(2)}×</dd>
            </div>
            <div>
              <dt>Evaluated proxy threshold</dt>
              <dd>
                {formatPercent(resolved.effectiveThreshold)} ·{" "}
                {resolved.interpolationStatus}
              </dd>
            </div>
          </dl>
          <div className="scenario-cost-ledger">
            <span>$100 binary research proxy</span>
            <p>
              Illustrative single-side XSPBX Customer fee $
              {resolved.referenceVenueFee.toFixed(2)} + explicit fill-cost
              stress ${resolved.slippageStressAllowance.toFixed(2)}. Broker and
              account-specific charges are excluded. No generally listed
              single-stock earnings binary is implied.
            </p>
          </div>
          <button
            className="apply-scenario"
            type="button"
            onClick={() => onApply(resolved.simulationPatch)}
          >
            Load synthetic research scenario
          </button>
          <span className="scenario-load-status" role="status">
            {draftIsLoaded
              ? `Loaded in lab · ${appliedManifest.datasetVersion}`
              : appliedManifest
                ? "Draft differs from the scenario currently loaded below"
                : "Custom lab inputs are active; this draft is not loaded"}
          </span>
          <p className="scenario-apply-note">
            Also loads research-only stress settings: 2 pp probability haircut,
            effective sample size 100, weekly logit SD 0.15, 35% cost CV,
            Poisson sequential opportunity throughput, and the displayed $0.50
            fill-cost allowance. Initial stake remains 0% until you choose a
            risk budget.
          </p>
        </div>
      </div>

      <div className="sector-comparison">
        <div className="sector-comparison-heading">
          <div>
            <span className="eyebrow">Like-for-like sensitivity</span>
            <h3>Compare every sector under the same assumed model lift.</h3>
          </div>
          <p>
            This compares economics, not LLM skill. A shared probability lift is
            applied to every unconditional proxy; only your matching
            out-of-sample forecasts can establish which sector deserves it.
          </p>
        </div>
        <div
          className="sector-table-scroll"
          role="region"
          aria-label="Cross-sector scenario comparison"
          tabIndex={0}
        >
          <table className="sector-table">
            <caption>
              Sector proxy sensitivity for the selected capitalization, horizon,
              direction, threshold, company scale, and model lift
            </caption>
            <thead>
              <tr>
                <th scope="col">Sector proxy</th>
                <th scope="col">Smoothed context frequency</th>
                <th scope="col">Return volatility</th>
                <th scope="col">Lift needed for proxy costs</th>
                <th scope="col">Scenario p − break-even</th>
                <th scope="col">Conservative Kelly</th>
                <th scope="col">
                  <span className="sr-only">Select sector</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sectorComparison.map(
                ({ scenario, conservativeKelly, liftToCostBreakEven }) => {
                  const selected = scenario.profile.id === selection.profileId;
                  return (
                    <tr
                      key={scenario.profile.id}
                      className={selected ? "is-selected" : undefined}
                    >
                      <th scope="row">
                        <span>{scenario.profile.label}</span>
                        <small>{scenario.profile.mappingQuality}</small>
                      </th>
                      <td>
                        {formatProbability(
                          scenario.unconditionalContextFrequency,
                        )}
                      </td>
                      <td>
                        {formatPercent(scenario.context.standardDeviation)}
                      </td>
                      <td>+{(liftToCostBreakEven * 100).toFixed(2)} pp</td>
                      <td
                        className={
                          scenario.scenarioProbabilityMinusModeledBreakEven > 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {scenario.scenarioProbabilityMinusModeledBreakEven >= 0
                          ? "+"
                          : ""}
                        {(
                          scenario.scenarioProbabilityMinusModeledBreakEven *
                          100
                        ).toFixed(2)}{" "}
                        pp
                      </td>
                      <td>{formatPercent(conservativeKelly)}</td>
                      <td>
                        <button
                          type="button"
                          className="sector-select"
                          disabled={selected}
                          onClick={() => set("profileId", scenario.profile.id)}
                        >
                          {selected ? "Selected" : "Use"}
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
        <p className="sector-comparison-note">
          Conservative Kelly subtracts the scenario&apos;s fixed 2 pp research
          haircut. Zero means the shared lift does not clear proxy costs plus
          that buffer; it is not a claim that the sector cannot be traded
          profitably.
        </p>
      </div>

      <aside className="scenario-boundaries" aria-label="Scenario limitations">
        <div>
          <span>Research-only boundary</span>
          <strong>
            These defaults are context and stress—not a trade ticket.
          </strong>
        </div>
        <ul>
          {resolved.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </aside>

      <div className="evidence-ledger">
        <div>
          <span>Data tier</span>
          <strong>Unconditional context—not event alpha</strong>
          <p>
            {resolved.profile.proxySystem} “{resolved.profile.proxyPortfolio}”
            portfolio; {resolved.profile.mappingQuality}. Sample 2000–2025.
            Ten-day observations overlap.
          </p>
        </div>
        {selectedEventSources.map((source) => (
          <div key={source.id}>
            <span>Event literature</span>
            <strong>{source.label}</strong>
            <p>{source.detail}</p>
            <a href={source.url} target="_blank" rel="noreferrer">
              Open source ↗
            </a>
          </div>
        ))}
        <div>
          <span>Agent guardrail</span>
          <strong>No prose-to-probability shortcut</strong>
          <p>
            An LLM research conclusion may define features or a thesis. It may
            not become a probability until a named model has stored predictions
            and matching out-of-sample calibration evidence.
          </p>
        </div>
      </div>
    </section>
  );
};
