import type {
  ExplorationResult,
  SimulationResult,
} from "@event-lab/simulation";

import { formatPercent } from "../lib/format.js";
import { finiteDomain, linearScale } from "./chartUtils.js";

const WIDTH = 920;
const HEIGHT = 370;
const MARGIN = { top: 24, right: 25, bottom: 48, left: 72 };

interface FrontierChartProps {
  exploration: ExplorationResult;
  simulation: SimulationResult;
}

export const FrontierChart = ({
  exploration,
  simulation,
}: FrontierChartProps) => {
  const [minimumGrowth, maximumGrowth] = finiteDomain(
    exploration.sweep.map((point) => point.medianCagr),
  );
  const x = linearScale(0, 1, MARGIN.left, WIDTH - MARGIN.right);
  const y = linearScale(
    minimumGrowth,
    maximumGrowth,
    HEIGHT - MARGIN.bottom,
    MARGIN.top,
  );
  const kelly = simulation.kelly.fullFraction;

  return (
    <section
      className="chart-section chart-wide"
      aria-labelledby="frontier-title"
    >
      <div className="chart-heading">
        <div>
          <span className="eyebrow">Position-size sweep</span>
          <h3 id="frontier-title">Growth / fragility frontier</h3>
        </div>
        <p>
          Common random numbers hold outcomes fixed across fractions. Analytic
          Kelly is the authoritative log-growth optimum.
        </p>
      </div>
      <div className="svg-wrap">
        <svg
          className="analytics-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby="frontier-title frontier-description"
        >
          <desc id="frontier-description">
            Position fraction against median compound annual growth. Point color
            and size indicate fragility.
          </desc>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                className="chart-grid"
                x1={x(tick)}
                x2={x(tick)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
              />
              <text
                className="chart-axis"
                x={x(tick)}
                y={HEIGHT - 14}
                textAnchor="middle"
              >
                {formatPercent(tick, 0)}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((tick) => {
            const value =
              minimumGrowth + tick * (maximumGrowth - minimumGrowth);
            return (
              <g key={tick}>
                <line
                  className="chart-grid"
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y(value)}
                  y2={y(value)}
                />
                <text
                  className="chart-axis"
                  x={MARGIN.left - 10}
                  y={y(value) + 4}
                  textAnchor="end"
                >
                  {formatPercent(value)}
                </text>
              </g>
            );
          })}
          <line
            className="kelly-line"
            x1={x(kelly)}
            x2={x(kelly)}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
          />
          <text
            className="kelly-label"
            x={Math.min(x(kelly) + 6, WIDTH - 110)}
            y={MARGIN.top + 12}
          >
            Full Kelly {formatPercent(kelly)}
          </text>
          {exploration.sweep.map((point) => {
            const danger = Math.max(
              point.probabilityOfPracticalRuin,
              point.probabilityOfSevereDrawdown,
            );
            const hue = 155 - danger * 145;
            const isSelected =
              Math.abs(point.fraction - simulation.input.positionFraction) <
              0.000001;
            return (
              <circle
                className={
                  isSelected ? "frontier-point selected" : "frontier-point"
                }
                cx={x(point.fraction)}
                cy={y(point.medianCagr)}
                r={4 + danger * 7}
                fill={`hsl(${hue} 78% 62%)`}
                key={point.fraction}
              >
                <title>
                  Position {formatPercent(point.fraction)} · median CAGR{" "}
                  {formatPercent(point.medianCagr)} · ruin{" "}
                  {formatPercent(point.probabilityOfPracticalRuin)} · severe
                  drawdown {formatPercent(point.probabilityOfSevereDrawdown)}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="chart-legend">
        <span className="legend-selected">Current size</span>
        <span className="legend-safe">Lower fragility</span>
        <span className="legend-danger">Higher fragility</span>
        <span>
          n = {exploration.sweepPathCount.toLocaleString()} paths / fraction
        </span>
      </div>
    </section>
  );
};
