import type { SimulationResult } from "@event-lab/simulation";
import { useState } from "react";

import { formatCurrency, formatPercent } from "../lib/format.js";
import {
  finiteDomain,
  linearScale,
  pathFromPoints,
  polygonFromBands,
} from "./chartUtils.js";
import { HorizontalScrollRegion } from "./HorizontalScrollRegion.js";

interface FanChartProps {
  result: SimulationResult;
  view: "nominal" | "percentage";
}

const WIDTH = 920;
const HEIGHT = 370;
const MARGIN = { top: 30, right: 24, bottom: 42, left: 70 };

export const FanChart = ({ result, view }: FanChartProps) => {
  const [selectedIndex, setSelectedIndex] = useState(result.fan.length - 1);
  const activeIndex = Math.min(selectedIndex, result.fan.length - 1);
  const active = result.fan[activeIndex]!;
  const convert = (capital: number) =>
    view === "nominal" ? capital : capital / result.input.startingCapital - 1;
  const allValues = result.fan.flatMap((point) => [
    convert(point.p05),
    convert(point.p25),
    convert(point.median),
    convert(point.p75),
    convert(point.p95),
  ]);
  const [minimum, maximum] = finiteDomain(allValues);
  const x = linearScale(
    0,
    result.input.horizonWeeks,
    MARGIN.left,
    WIDTH - MARGIN.right,
  );
  const y = linearScale(minimum, maximum, HEIGHT - MARGIN.bottom, MARGIN.top);
  const points = (key: "p05" | "p25" | "median" | "p75" | "p95") =>
    result.fan.map((point) => ({
      x: x(point.week),
      y: y(convert(point[key])),
    }));
  const formatter = view === "nominal" ? formatCurrency : formatPercent;
  const selectedX = x(active.week);

  return (
    <section className="chart-section chart-wide" aria-labelledby="fan-title">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">Path distribution</span>
          <h3 id="fan-title">Bankroll fan</h3>
        </div>
        <p>
          Pointwise bands show cross-path quantiles—not a single realizable
          trajectory.
        </p>
      </div>
      <div className="fan-readout" aria-live="polite">
        <span>Week {active.week.toFixed(1)}</span>
        <span>
          p05 <strong>{formatter(convert(active.p05))}</strong>
        </span>
        <span>
          median <strong>{formatter(convert(active.median))}</strong>
        </span>
        <span>
          p95 <strong>{formatter(convert(active.p95))}</strong>
        </span>
      </div>
      <HorizontalScrollRegion label="Bankroll fan chart" className="svg-wrap">
        <svg
          className="analytics-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby="fan-title fan-description"
        >
          <desc id="fan-description">
            Fan chart of 5th, 25th, median, 75th, and 95th percentile bankroll
            with six retained sample paths.
          </desc>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const tickY =
              MARGIN.top + tick * (HEIGHT - MARGIN.top - MARGIN.bottom);
            const value = maximum - tick * (maximum - minimum);
            return (
              <g key={tick}>
                <line
                  className="chart-grid"
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={tickY}
                  y2={tickY}
                />
                <text
                  className="chart-axis"
                  x={MARGIN.left - 10}
                  y={tickY + 4}
                  textAnchor="end"
                >
                  {formatter(value)}
                </text>
              </g>
            );
          })}
          <path
            className="fan-outer"
            d={polygonFromBands(points("p95"), points("p05"))}
          />
          <path
            className="fan-inner"
            d={polygonFromBands(points("p75"), points("p25"))}
          />
          {result.samplePaths.map((sample) => (
            <path
              className="sample-path"
              d={pathFromPoints(
                sample.points.map((point) => ({
                  x: x(point.week),
                  y: y(convert(point.capital)),
                })),
              )}
              key={sample.id}
            />
          ))}
          <path className="median-path" d={pathFromPoints(points("median"))} />
          <line
            className="crosshair"
            x1={selectedX}
            x2={selectedX}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
          />
          <circle
            className="active-point"
            cx={selectedX}
            cy={y(convert(active.median))}
            r="4"
          />
          {[0, result.input.horizonWeeks / 2, result.input.horizonWeeks].map(
            (tick) => (
              <text
                className="chart-axis"
                x={x(tick)}
                y={HEIGHT - 12}
                textAnchor="middle"
                key={tick}
              >
                {tick.toFixed(0)} wk
              </text>
            ),
          )}
        </svg>
      </HorizontalScrollRegion>
      <label className="chart-scrubber">
        <span>Inspect week</span>
        <input
          type="range"
          min={0}
          max={result.fan.length - 1}
          step={1}
          value={activeIndex}
          aria-label="Fan chart week"
          aria-valuetext={`Week ${active.week.toFixed(1)} of ${result.input.horizonWeeks}; median ${formatter(
            convert(active.median),
          )}`}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
        />
      </label>
      <div className="chart-legend" aria-label="Fan chart legend">
        <span className="legend-p95">p05–p95</span>
        <span className="legend-p75">p25–p75</span>
        <span className="legend-median">Median</span>
        <span className="legend-sample">Sample paths</span>
      </div>
    </section>
  );
};
